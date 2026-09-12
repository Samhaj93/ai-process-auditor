// Plausibility checks on a finished extraction.
//
// Separate from the schema on purpose. The schema decides whether a response
// is *shaped* correctly; this decides whether it is *believable*. A model can
// return perfectly valid JSON that says a process has no waiting time at all,
// which reads as 100% flow efficiency — confidently wrong, and worse than an
// error, because nothing looks broken.
//
// Observed on free models roughly one run in three.
//
// Derived from the audit, not stored in it: a pure function of ExtractResult,
// like computeMetrics, so the JSON contract is unchanged.

import type { ExtractResult } from "./schema.ts";

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
