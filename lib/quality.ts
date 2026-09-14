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
