// The contract between analysis and rendering.
// The model fills this shape. The UI reads this shape. Nothing else crosses.
//
// Schemas are the source of truth; every type below is derived with z.infer.
// Convention: `XSchema` is the runtime value, `X` the type inferred from it.

import { z } from "zod";

export const ValueClassSchema = z.enum([
  "value-add",
  "business-non-value-add",
  "non-value-add",
]);
export type ValueClass = z.infer<typeof ValueClassSchema>;

/** The eight DOWNTIME categories. The enum is what stops a ninth being invented. */
export const WasteCategorySchema = z.enum([
  "defects",
  "overproduction",
  "waiting",
  "non-utilised-talent",
  "transportation",
  "inventory",
  "motion",
  "extra-processing",
]);
export type WasteCategory = z.infer<typeof WasteCategorySchema>;

export const BottleneckTypeSchema = z.enum([
  "capacity",
  "handoff",
  "approval",
  "rework-loop",
  "system",
  "information",
]);
export type BottleneckType = z.infer<typeof BottleneckTypeSchema>;

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const RedesignActionSchema = z.enum([
  "eliminate",
  "automate",
  "merge",
  "parallelise",
  "reorder",
  "standardise",
]);
export type RedesignAction = z.infer<typeof RedesignActionSchema>;

/** Minutes reported by the model. Finite and non-negative, or the metrics row becomes NaN. */
const minutes = z.number().finite().nonnegative();

/** One discrete step in the as-is process. */
export const ProcessStepSchema = z.object({
  id: z.string().min(1), // stable slug, e.g. "s3-manager-approval"
  name: z.string().min(1),
  actor: z.string().min(1), // role or team performing the step
  processMinutes: minutes, // hands-on time
  waitMinutes: minutes, // queue/idle time before this step starts
  systems: z.array(z.string().min(1)), // tools touched, e.g. ["SAP", "email"]
  valueClass: ValueClassSchema,
  handoffTo: z.string().nullable(), // id of the next step, null if terminal
  reworkTo: z.string().nullable(), // id this step can loop back to, if any
  notes: z.string().nullable(),
});
export type ProcessStep = z.infer<typeof ProcessStepSchema>;

/**
 * The steps array, carrying the two checks that cannot live on a single step.
 *
 * Exported standalone and validated directly. Never derive this from
 * ProcessAuditSchema with .pick() — on zod 4 that compiles and silently drops
 * every check below, which is worse than failing.
 */
export const ProcessStepsSchema = z
  .array(ProcessStepSchema)
  .min(1, "A process must have at least one step")
  .superRefine((steps, ctx) => {
    const seen = new Set<string>();
    for (const [i, step] of steps.entries()) {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "id"],
          message: `duplicate step id "${step.id}"`,
        });
      }
      seen.add(step.id);
    }

    for (const [i, step] of steps.entries()) {
      for (const field of ["handoffTo", "reworkTo"] as const) {
        const target = step[field];
        if (target !== null && !seen.has(target)) {
          ctx.addIssue({
            code: "custom",
            path: [i, field],
            message: `references unknown step id "${target}"`,
          });
        }
      }
    }
  });

/** Aggregate figures derived from steps. Computed, not guessed. */
export const ProcessMetricsSchema = z.object({
  leadTimeMinutes: minutes, // sum of processMinutes + waitMinutes
  processTimeMinutes: minutes, // sum of processMinutes
  flowEfficiency: z.number().min(0).max(1), // processTime / leadTime, 0–1
  stepCount: z.number().int().nonnegative(),
  handoffCount: z.number().int().nonnegative(),
  systemCount: z.number().int().nonnegative(),
});
export type ProcessMetrics = z.infer<typeof ProcessMetricsSchema>;

export const BottleneckSchema = z.object({
  stepId: z.string().min(1),
  type: BottleneckTypeSchema,
  severity: SeveritySchema,
  evidence: z.string(), // what in the description supports this
  impactMinutes: minutes, // lead time attributable to this bottleneck
});
export type Bottleneck = z.infer<typeof BottleneckSchema>;

export const WasteFindingSchema = z.object({
  category: WasteCategorySchema,
  stepIds: z.array(z.string().min(1)),
  description: z.string(),
  estimatedMinutes: minutes, // recoverable time, per process instance
});
export type WasteFinding = z.infer<typeof WasteFindingSchema>;

export const RedesignChangeSchema = z.object({
  action: RedesignActionSchema,
  targetStepIds: z.array(z.string().min(1)),
  description: z.string(),
  rationale: z.string(),
  expectedSavingMinutes: minutes,
  effort: z.enum(["low", "medium", "high"]),
  risk: z.string().nullable(),
});
export type RedesignChange = z.infer<typeof RedesignChangeSchema>;

/**
 * Stage 4, as the model returns it: the changes, and the complete redesigned
 * process as steps. No figures. Projected metrics are computed from the steps,
 * never supplied by the model.
 */
export const RedesignProposalSchema = z.object({
  summary: z.string().min(1),
  changes: z.array(RedesignChangeSchema).min(1),
  steps: ProcessStepsSchema, // the to-be process
});
export type RedesignProposal = z.infer<typeof RedesignProposalSchema>;

/** Stage 4, as stored and rendered: the proposal plus figures computed from its steps. */
export const RedesignSchema = z.object({
  summary: z.string().min(1),
  changes: z.array(RedesignChangeSchema).min(1),
  steps: ProcessStepsSchema,
  projectedMetrics: ProcessMetricsSchema, // computeMetrics(steps), never the model's
});
export type Redesign = z.infer<typeof RedesignSchema>;

/**
 * Stage 4 validation for one request. On top of the shape, including the
 * redesigned steps' own id checks, every change must target a step that exists
 * in the current process.
 *
 * Built per request, like diagnoseResultSchemaFor, and for the same reason.
 */
export function redesignProposalSchemaFor(currentSteps: ProcessStep[]) {
  const ids = new Set(currentSteps.map((s) => s.id));
  return RedesignProposalSchema.superRefine((proposal, ctx) => {
    for (const [i, change] of proposal.changes.entries()) {
      for (const [j, id] of change.targetStepIds.entries()) {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["changes", i, "targetStepIds", j],
            message: `references unknown step id "${id}"`,
          });
        }
      }
    }
  });
}

export const AuditMetaSchema = z.object({
  processName: z.string().min(1),
  auditedAt: z.iso.datetime(), // ISO 8601
  provider: z.string().min(1), // which provider ran it
  model: z.string().min(1),
  sourceLength: z.number().int().nonnegative(), // chars of input, for reproducibility
});
export type AuditMeta = z.infer<typeof AuditMetaSchema>;

/** The whole audit. This is the only object the UI ever receives. */
export const ProcessAuditSchema = z.object({
  meta: AuditMetaSchema,
  steps: ProcessStepsSchema,
  metrics: ProcessMetricsSchema,
  bottlenecks: z.array(BottleneckSchema),
  wastes: z.array(WasteFindingSchema),
  bpmnXml: z.string().nullable(), // BPMN 2.0 XML, null if modelling stage skipped
  redesign: RedesignSchema.nullable(), // null if redesign stage skipped
});
export type ProcessAudit = z.infer<typeof ProcessAuditSchema>;

/** Stage 1 output — the only stage that must succeed. */
export const ExtractResultSchema = z.object({
  steps: ProcessStepsSchema,
  metrics: ProcessMetricsSchema,
});
export type ExtractResult = z.infer<typeof ExtractResultSchema>;

/** Stage 2 output. */
export const DiagnoseResultSchema = z.object({
  bottlenecks: z.array(BottleneckSchema),
  wastes: z.array(WasteFindingSchema),
});
export type DiagnoseResult = z.infer<typeof DiagnoseResultSchema>;

/**
 * Stage 2 validation for one request. On top of the shape, every step id the
 * result mentions must exist in the steps it was given, and no step may carry
 * two bottlenecks, since the UI marks a bottleneck on the step's own row.
 *
 * Built per request because the valid ids differ per process. .superRefine
 * returns a new schema, so the shared DiagnoseResultSchema is never modified;
 * tests/diagnose.test.ts guards that.
 */
export function diagnoseResultSchemaFor(steps: ProcessStep[]) {
  const ids = new Set(steps.map((s) => s.id));
  return DiagnoseResultSchema.superRefine((result, ctx) => {
    const marked = new Set<string>();
    for (const [i, b] of result.bottlenecks.entries()) {
      if (!ids.has(b.stepId)) {
        ctx.addIssue({
          code: "custom",
          path: ["bottlenecks", i, "stepId"],
          message: `references unknown step id "${b.stepId}"`,
        });
      } else if (marked.has(b.stepId)) {
        ctx.addIssue({
          code: "custom",
          path: ["bottlenecks", i, "stepId"],
          message: `second bottleneck on step "${b.stepId}"`,
        });
      }
      marked.add(b.stepId);
    }
    for (const [i, w] of result.wastes.entries()) {
      for (const [j, id] of w.stepIds.entries()) {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["wastes", i, "stepIds", j],
            message: `references unknown step id "${id}"`,
          });
        }
      }
    }
  });
}

/** Derive metrics from steps. Never let the model compute these. */
export function computeMetrics(steps: ProcessStep[]): ProcessMetrics {
  const processTimeMinutes = steps.reduce((n, s) => n + s.processMinutes, 0);
  const leadTimeMinutes = steps.reduce((n, s) => n + s.processMinutes + s.waitMinutes, 0);
  return {
    leadTimeMinutes,
    processTimeMinutes,
    flowEfficiency: leadTimeMinutes > 0 ? processTimeMinutes / leadTimeMinutes : 0,
    stepCount: steps.length,
    handoffCount: steps.filter((s) => s.handoffTo !== null).length,
    systemCount: new Set(steps.flatMap((s) => s.systems)).size,
  };
}

/** Flatten zod issues into one line each. Surfaced verbatim; never coerced away. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
