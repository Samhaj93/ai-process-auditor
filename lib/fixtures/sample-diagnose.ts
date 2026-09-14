// Hand-written stage 2 findings for the invoice example, so bottlenecks and
// waste can be seen with no key and no network. Validated against the example's
// own steps at module load, so a finding pointing at a missing step fails loudly.

import { diagnoseResultSchemaFor, type DiagnoseResult } from "../schema.ts";
import { sampleExtract } from "./sample-extract.ts";

export const sampleDiagnose: DiagnoseResult = diagnoseResultSchemaFor(
  sampleExtract.steps,
).parse({
  bottlenecks: [
    {
      stepId: "s6-payment-run",
      type: "capacity",
      severity: "critical",
      evidence: "Waits 2,880 min because payment runs execute only twice weekly.",
      impactMinutes: 2880,
    },
    {
      stepId: "s4-manager-approval",
      type: "approval",
      severity: "critical",
      evidence: "Waits 1,440 min in an approval queue that is cleared overnight as a rule.",
      impactMinutes: 1440,
    },
    {
      stepId: "s3-resolve-mismatch",
      type: "rework-loop",
      severity: "high",
      evidence: "Loops back to purchase order matching for roughly a third of invoices, after a 480 min wait.",
      impactMinutes: 480,
    },
    {
      stepId: "s5-finance-review",
      type: "handoff",
      severity: "medium",
      evidence: "Waits 360 min between manager approval and finance review.",
      impactMinutes: 360,
    },
  ],
  wastes: [
    {
      category: "waiting",
      stepIds: ["s2-match-po", "s4-manager-approval", "s5-finance-review", "s6-payment-run"],
      description: "Invoices sit in queues and wait for batched payment runs.",
      estimatedMinutes: 3600,
    },
    {
      category: "defects",
      stepIds: ["s3-resolve-mismatch"],
      description: "Price and quantity mismatches send a third of invoices back for rework.",
      estimatedMinutes: 170,
    },
    {
      category: "transportation",
      stepIds: ["s4-manager-approval", "s5-finance-review"],
      description: "Invoices pass between AP, the cost centre manager and finance for sequential sign-off.",
      estimatedMinutes: 20,
    },
    {
      category: "extra-processing",
      stepIds: ["s8-archive"],
      description: "Supporting documents are stored twice, in SAP and in SharePoint.",
      estimatedMinutes: 3,
    },
  ],
});
