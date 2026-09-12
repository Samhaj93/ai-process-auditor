// The contract between analysis and rendering.
// The model fills this shape. The UI reads this shape. Nothing else crosses.

export type ValueClass = "value-add" | "business-non-value-add" | "non-value-add";

export type WasteCategory =
  | "defects"
  | "overproduction"
  | "waiting"
  | "non-utilised-talent"
  | "transportation"
  | "inventory"
  | "motion"
  | "extra-processing";

export type BottleneckType =
  | "capacity"
  | "handoff"
  | "approval"
  | "rework-loop"
  | "system"
  | "information";

export type Severity = "low" | "medium" | "high" | "critical";

export type RedesignAction =
  | "eliminate"
  | "automate"
  | "merge"
  | "parallelise"
  | "reorder"
  | "standardise";

/** One discrete step in the as-is process. */
export interface ProcessStep {
  id: string;                  // stable slug, e.g. "s3-manager-approval"
  name: string;
  actor: string;               // role or team performing the step
  processMinutes: number;      // hands-on time
  waitMinutes: number;         // queue/idle time before this step starts
  systems: string[];           // tools touched, e.g. ["SAP", "email"]
  valueClass: ValueClass;
  handoffTo: string | null;    // id of the next step, null if terminal
  reworkTo: string | null;     // id this step can loop back to, if any
  notes: string | null;
}

/** Aggregate figures derived from steps. Computed, not guessed. */
export interface ProcessMetrics {
  leadTimeMinutes: number;      // sum of processMinutes + waitMinutes
  processTimeMinutes: number;   // sum of processMinutes
  flowEfficiency: number;       // processTime / leadTime, 0–1
  stepCount: number;
  handoffCount: number;
  systemCount: number;
}

export interface Bottleneck {
  stepId: string;
  type: BottleneckType;
  severity: Severity;
  evidence: string;             // what in the description supports this
  impactMinutes: number;        // lead time attributable to this bottleneck
}

export interface WasteFinding {
  category: WasteCategory;
  stepIds: string[];
  description: string;
  estimatedMinutes: number;     // recoverable time, per process instance
}

export interface RedesignChange {
  action: RedesignAction;
  targetStepIds: string[];
  description: string;
  rationale: string;
  expectedSavingMinutes: number;
  effort: "low" | "medium" | "high";
  risk: string | null;
}

export interface Redesign {
  summary: string;
  changes: RedesignChange[];
  projectedMetrics: ProcessMetrics;   // the to-be state
}

export interface AuditMeta {
  processName: string;
  auditedAt: string;            // ISO 8601
  provider: string;             // which provider ran it
  model: string;
  sourceLength: number;         // chars of input, for reproducibility
}

/** The whole audit. This is the only object the UI ever receives. */
export interface ProcessAudit {
  meta: AuditMeta;
  steps: ProcessStep[];
  metrics: ProcessMetrics;
  bottlenecks: Bottleneck[];
  wastes: WasteFinding[];
  bpmnXml: string | null;       // BPMN 2.0 XML, null if modelling stage skipped
  redesign: Redesign | null;    // null if redesign stage skipped
}

/** Stage 1 output — the only stage that must succeed. */
export type ExtractResult = Pick<ProcessAudit, "steps" | "metrics">;

/** Stage 2 output. */
export type DiagnoseResult = Pick<ProcessAudit, "bottlenecks" | "wastes">;

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
