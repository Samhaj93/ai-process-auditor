// Plausibility checks on finished results.
//
// Separate from the schema on purpose. The schema decides whether a response
// is *shaped* correctly; this decides whether it is *believable*. A model can
// return perfectly valid JSON that says a process has no waiting time at all,
// which reads as 100% flow efficiency — confidently wrong, and worse than an
// error, because nothing looks broken.
//
// Observed on free models roughly one run in three.
//
// Derived from results, not stored in them: pure functions, like
// computeMetrics, so the JSON contract is unchanged.

import {
  computeMetrics,
  type DiagnoseResult,
  type ExtractResult,
  type ProcessStep,
  type Redesign,
  type RedesignChange,
} from "./schema.ts";

export interface AuditWarning {
  code: "no-wait-time" | "no-process-time" | "single-step";
  message: string;
}

export function auditWarnings({ steps }: ExtractResult): AuditWarning[] {
  const warnings: AuditWarning[] = [];
  if (steps.length === 0) return warnings;

  if (steps.every((s) => s.waitMinutes === 0)) {
    warnings.push({
      code: "no-wait-time",
      message:
        "No waiting time was found, so flow efficiency reads 100%. If your description mentions queues, overnight waits, batching or approvals sitting with someone, the model missed them.",
    });
  }

  if (steps.every((s) => s.processMinutes === 0)) {
    warnings.push({
      code: "no-process-time",
      message:
        "No hands-on working time was found, so the figures below are not meaningful.",
    });
  }

  if (steps.length === 1) {
    warnings.push({
      code: "single-step",
      message:
        "Only one step was extracted. A process described in a sentence or two may not give the model enough to work with.",
    });
  }

  return warnings;
}

export interface DiagnoseWarning {
  code: "impact-exceeds-step" | "recovery-exceeds-possible" | "no-findings";
  message: string;
}

/**
 * Plausibility checks on stage 2 findings, against the steps they describe.
 * Each fires only on figures that cannot be true, not on merely optimistic ones:
 * the model claiming every waiting minute is recoverable is optimistic, and
 * passes.
 */
export function diagnoseWarnings(
  steps: ProcessStep[],
  { bottlenecks, wastes }: DiagnoseResult,
): DiagnoseWarning[] {
  const warnings: DiagnoseWarning[] = [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  const metrics = computeMetrics(steps);

  // A bottleneck cannot delay a step by more than the step takes in total.
  const overstated = bottlenecks.filter((b) => {
    const step = byId.get(b.stepId);
    return step !== undefined && b.impactMinutes > step.processMinutes + step.waitMinutes;
  });
  if (overstated.length > 0) {
    warnings.push({
      code: "impact-exceeds-step",
      message:
        overstated.length === 1
          ? "One bottleneck claims more delay than its step takes in total, so its impact figure is overstated."
          : `${overstated.length} bottlenecks claim more delay than their steps take in total, so those impact figures are overstated.`,
    });
  }

  // Value-add work is the part of lead time that removing waste cannot recover.
  const valueAddMinutes = steps
    .filter((s) => s.valueClass === "value-add")
    .reduce((n, s) => n + s.processMinutes, 0);
  const recoverable = metrics.leadTimeMinutes - valueAddMinutes;
  const claimed = wastes.reduce((n, w) => n + w.estimatedMinutes, 0);
  if (claimed > recoverable) {
    warnings.push({
      code: "recovery-exceeds-possible",
      message: `The waste findings claim ${claimed.toLocaleString()} recoverable minutes, but only ${recoverable.toLocaleString()} minutes of this process are not value-adding work. Some findings overlap or are overstated.`,
    });
  }

  if (bottlenecks.length === 0 && wastes.length === 0 && metrics.flowEfficiency < 0.5) {
    warnings.push({
      code: "no-findings",
      message:
        "No bottlenecks or waste were found, yet most of this process's time is spent waiting. The model probably missed them.",
    });
  }

  return warnings;
}

export interface RedesignWarning {
  code: "no-improvement" | "savings-mismatch" | "value-add-removed";
  message: string;
}

/**
 * Plausibility checks on a stage 4 redesign, against the process it replaces.
 * The projected figures are computed from the redesigned steps, so they are
 * consistent with each other. What can be wrong is the proposal itself.
 */
export function redesignWarnings(current: ProcessStep[], redesign: Redesign): RedesignWarning[] {
  const warnings: RedesignWarning[] = [];
  const before = computeMetrics(current);
  // Recomputed rather than read from projectedMetrics, which arrived from the browser.
  const after = computeMetrics(redesign.steps);
  const saved = before.leadTimeMinutes - after.leadTimeMinutes;

  if (saved <= 0) {
    warnings.push({
      code: "no-improvement",
      message:
        "The redesigned process is no faster than the current one, so these changes would not shorten lead time.",
    });
  }

  // Per-change savings are the model's estimates. Small gaps are expected; a
  // large one means those estimates cannot be taken at face value.
  const claimed = redesign.changes.reduce((n, c) => n + c.expectedSavingMinutes, 0);
  if (Math.abs(claimed - saved) > Math.max(60, Math.abs(saved) * 0.25)) {
    warnings.push({
      code: "savings-mismatch",
      message: `The changes claim ${claimed.toLocaleString()} minutes saved, but the redesigned steps save ${Math.max(saved, 0).toLocaleString()}. The saving shown for each change is unreliable.`,
    });
  }

  // Value-add work is what the customer pays for. Merging it into another step
  // is fine; eliminating it, or letting it vanish without a merge, is not.
  const kept = new Set(redesign.steps.map((s) => s.id));
  const targetedBy = (action: RedesignChange["action"]) =>
    new Set(
      redesign.changes.filter((c) => c.action === action).flatMap((c) => c.targetStepIds),
    );
  const merged = targetedBy("merge");
  const eliminated = targetedBy("eliminate");
  const removed = current.filter(
    (s) =>
      s.valueClass === "value-add" &&
      (eliminated.has(s.id) || (!kept.has(s.id) && !merged.has(s.id))),
  );
  if (removed.length > 0) {
    warnings.push({
      code: "value-add-removed",
      message: `The redesign removes value-adding work: ${removed
        .map((s) => s.name)
        .join(", ")}. That is the work the customer pays for, so check this change.`,
    });
  }

  return warnings;
}
