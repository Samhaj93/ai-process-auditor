import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import {
  DiagnoseResultSchema,
  diagnoseResultSchemaFor,
  formatIssues,
} from "../lib/schema.ts";

const steps = sampleExtract.steps;

const bottleneck = (stepId: string) => ({
  stepId,
  type: "approval",
  severity: "high",
  evidence: "waitMinutes 1440, sits overnight",
  impactMinutes: 1440,
});
const waste = (stepIds: string[]) => ({
  category: "waiting",
  stepIds,
  description: "Work sits in the approval queue.",
  estimatedMinutes: 600,
});

describe("diagnoseResultSchemaFor", () => {
  it("accepts findings that point at real steps", () => {
    const r = diagnoseResultSchemaFor(steps).safeParse({
      bottlenecks: [bottleneck("s4-manager-approval")],
      wastes: [waste(["s4-manager-approval", "s6-payment-run"])],
    });
    assert.equal(r.success, true);
  });

  it("accepts a process with nothing to report", () => {
    assert.equal(
      diagnoseResultSchemaFor(steps).safeParse({ bottlenecks: [], wastes: [] }).success,
      true,
    );
  });

  it("rejects a bottleneck on a step that does not exist", () => {
    const r = diagnoseResultSchemaFor(steps).safeParse({
      bottlenecks: [bottleneck("s99-invented")],
      wastes: [],
    });
    assert.equal(r.success, false);
    assert.ok(formatIssues(r.error!).some((m) => m.includes('unknown step id "s99-invented"')));
  });

  it("rejects a waste that points at a step that does not exist", () => {
    const r = diagnoseResultSchemaFor(steps).safeParse({
      bottlenecks: [],
      wastes: [waste(["s4-manager-approval", "made-up"])],
    });
    assert.equal(r.success, false);
    assert.ok(formatIssues(r.error!).some((m) => m.startsWith("wastes.0.stepIds.1")));
  });

  it("rejects two bottlenecks on the same step", () => {
    const r = diagnoseResultSchemaFor(steps).safeParse({
      bottlenecks: [bottleneck("s4-manager-approval"), bottleneck("s4-manager-approval")],
      wastes: [],
    });
    assert.equal(r.success, false);
    assert.ok(formatIssues(r.error!).some((m) => m.includes("second bottleneck")));
  });

  it("rejects an invented waste category", () => {
    const r = diagnoseResultSchemaFor(steps).safeParse({
      bottlenecks: [],
      wastes: [{ ...waste(["s1-receive-invoice"]), category: "bureaucracy" }],
    });
    assert.equal(r.success, false);
  });

  // Schemas are built per request. If building one changed the shared schema,
  // every later request would be checked against an earlier process's step ids.
  it("does not modify the shared schema", () => {
    diagnoseResultSchemaFor([{ ...steps[0], id: "only-this-id" }]);
    const r = DiagnoseResultSchema.safeParse({
      bottlenecks: [bottleneck("anything-at-all")],
      wastes: [],
    });
    assert.equal(r.success, true);
  });

  it("keeps two requests' step ids apart", () => {
    const forA = diagnoseResultSchemaFor([{ ...steps[0], id: "a" }]);
    const forB = diagnoseResultSchemaFor([{ ...steps[0], id: "b" }]);
    const aOnly = { bottlenecks: [bottleneck("a")], wastes: [] };
    assert.equal(forA.safeParse(aOnly).success, true);
    assert.equal(forB.safeParse(aOnly).success, false);
  });
});
