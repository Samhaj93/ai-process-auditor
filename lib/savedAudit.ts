// Saving a result, and opening it again.
//
// A saved file is untrusted input: it may be hand-edited, truncated, or not
// from this app at all. It goes through the same validation as a fresh model
// response, and every figure in it is recomputed from its steps rather than
// read back. Metrics are derived, so the steps are the only thing a file can
// be trusted to supply.

import { MAX_STEPS } from "./limits.ts";
import {
  ProcessStepsSchema,
  computeMetrics,
  diagnoseResultSchemaFor,
  formatIssues,
  redesignProposalSchemaFor,
  type DiagnoseResult,
  type ExtractResult,
  type Redesign,
} from "./schema.ts";

/** Far above any real result: the worked example saves to about 20 KB. */
export const MAX_SAVED_FILE_BYTES = 2_000_000;

export interface SavedAudit {
  extract: ExtractResult;
  diagnosis: DiagnoseResult | null;
  redesign: Redesign | null;
}

/** What Download JSON writes. parseSavedAudit reads this same shape back. */
export function buildSavedAudit(audit: SavedAudit, bpmnXml: string | null) {
  return {
    ...audit.extract,
    ...(audit.diagnosis ?? {}),
    bpmnXml,
    redesign: audit.redesign,
  };
}

type Parsed = { ok: true; value: SavedAudit } | { ok: false; errors: string[] };

export function parseSavedAudit(json: unknown): Parsed {
  if (typeof json !== "object" || json === null || Array.isArray(json) || !("steps" in json)) {
    return { ok: false, errors: ["This file is not a saved result from AI Process Auditor."] };
  }
  const file = json as Record<string, unknown>;

  if (Array.isArray(file.steps) && file.steps.length > MAX_STEPS) {
    return { ok: false, errors: [`Too many steps — ${file.steps.length}, maximum ${MAX_STEPS}.`] };
  }
  const steps = ProcessStepsSchema.safeParse(file.steps);
  if (!steps.success) {
    return {
      ok: false,
      errors: ["The steps in this file are not valid:", ...formatIssues(steps.error)],
    };
  }

  // A result saved before diagnosis finished has no findings at all, which is
  // different from findings that were run and came back empty.
  let diagnosis: DiagnoseResult | null = null;
  if (file.bottlenecks !== undefined || file.wastes !== undefined) {
    const findings = diagnoseResultSchemaFor(steps.data).safeParse({
      bottlenecks: file.bottlenecks,
      wastes: file.wastes,
    });
    if (!findings.success) {
      return {
        ok: false,
        errors: [
          "The bottlenecks and waste in this file are not valid:",
          ...formatIssues(findings.error),
        ],
      };
    }
    diagnosis = findings.data;
  }

  let redesign: Redesign | null = null;
  if (file.redesign !== undefined && file.redesign !== null) {
    if (!diagnosis) {
      return {
        ok: false,
        errors: ["This file has a redesign but no bottlenecks or waste, so it cannot be opened."],
      };
    }
    // The proposal schema has no projectedMetrics, so any figures in the file are dropped here.
    const proposal = redesignProposalSchemaFor(steps.data).safeParse(file.redesign);
    if (!proposal.success) {
      return {
        ok: false,
        errors: ["The redesign in this file is not valid:", ...formatIssues(proposal.error)],
      };
    }
    redesign = { ...proposal.data, projectedMetrics: computeMetrics(proposal.data.steps) };
  }

  return {
    ok: true,
    value: {
      extract: { steps: steps.data, metrics: computeMetrics(steps.data) },
      diagnosis,
      redesign,
    },
  };
}
