import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import {
  ProcessStepsSchema,
  computeMetrics,
  formatIssues,
  type ProcessStep,
} from "../lib/schema.ts";

const step = (id: string, over: Partial<ProcessStep> = {}) => ({
  id,
  name: `Step ${id}`,
  actor: "Someone",
  processMinutes: 10,
  waitMinutes: 5,
  systems: ["email"],
  valueClass: "value-add",
  handoffTo: null,
  reworkTo: null,
  notes: null,
  ...over,
});

describe("ProcessStepsSchema", () => {
  it("accepts a well-formed process", () => {
    const r = ProcessStepsSchema.safeParse([
      step("s1", { handoffTo: "s2" }),
      step("s2"),
    ]);
    assert.equal(r.success, true);
  });

  it("rejects duplicate step ids", () => {
    const r = ProcessStepsSchema.safeParse([step("s1"), step("s1")]);
    assert.equal(r.success, false);
    assert.ok(formatIssues(r.error!).some((m) => m.includes("duplicate step id")));
  });

  it("rejects handoffTo pointing at a step that does not exist", () => {
    const r = ProcessStepsSchema.safeParse([step("s1", { handoffTo: "nope" })]);
    assert.equal(r.success, false);
    assert.ok(
      formatIssues(r.error!).some((m) => m.includes("references unknown step id")),
    );
  });

  it("rejects reworkTo pointing at a step that does not exist", () => {
    const r = ProcessStepsSchema.safeParse([step("s1", { reworkTo: "gone" })]);
    assert.equal(r.success, false);
  });

  it("allows a rework loop to a real step", () => {
    const r = ProcessStepsSchema.safeParse([
      step("s1", { handoffTo: "s2" }),
      step("s2", { reworkTo: "s1" }),
    ]);
    assert.equal(r.success, true);
  });

  // The failure modes actually observed from free models.
  it("rejects a duration given as a string", () => {
    const r = ProcessStepsSchema.safeParse([
      step("s1", { processMinutes: "about 20" as unknown as number }),
    ]);
    assert.equal(r.success, false);
  });

  it("rejects an id given as a number", () => {
    const r = ProcessStepsSchema.safeParse([step(1 as unknown as string)]);
    assert.equal(r.success, false);
  });

  it("rejects systems given as a string instead of an array", () => {
    const r = ProcessStepsSchema.safeParse([
      step("s1", { systems: "SAP, email" as unknown as string[] }),
    ]);
    assert.equal(r.success, false);
  });

  it("rejects an invented value class", () => {
    const r = ProcessStepsSchema.safeParse([
      step("s1", { valueClass: "sort-of-useful" as ProcessStep["valueClass"] }),
    ]);
    assert.equal(r.success, false);
  });

  it("rejects negative minutes", () => {
    const r = ProcessStepsSchema.safeParse([step("s1", { waitMinutes: -5 })]);
    assert.equal(r.success, false);
  });

  it("rejects an empty process", () => {
    assert.equal(ProcessStepsSchema.safeParse([]).success, false);
  });

  it("reports every problem at once, not just the first", () => {
    const r = ProcessStepsSchema.safeParse([
      step("s1", { handoffTo: "missing-a" }),
      step("s1", { reworkTo: "missing-b" }),
    ]);
    assert.equal(r.success, false);
    assert.ok(formatIssues(r.error!).length >= 3);
  });
});

describe("computeMetrics", () => {
  it("sums process and wait time and divides them", () => {
    const steps = ProcessStepsSchema.parse([
      step("s1", { processMinutes: 10, waitMinutes: 0, handoffTo: "s2" }),
      step("s2", { processMinutes: 30, waitMinutes: 60, systems: ["SAP"] }),
    ]);
    const m = computeMetrics(steps);
    assert.equal(m.processTimeMinutes, 40);
    assert.equal(m.leadTimeMinutes, 100);
    assert.equal(m.flowEfficiency, 0.4);
    assert.equal(m.stepCount, 2);
    assert.equal(m.handoffCount, 1);
    assert.equal(m.systemCount, 2);
  });

  it("does not divide by zero when every duration is zero", () => {
    const steps = ProcessStepsSchema.parse([
      step("s1", { processMinutes: 0, waitMinutes: 0 }),
    ]);
    assert.equal(computeMetrics(steps).flowEfficiency, 0);
  });
});

describe("the bundled example", () => {
  it("parses and its metrics are internally consistent", () => {
    const { steps, metrics } = sampleExtract;
    assert.deepEqual(metrics, computeMetrics(steps));
    assert.equal(
      metrics.leadTimeMinutes,
      steps.reduce((n, s) => n + s.processMinutes + s.waitMinutes, 0),
    );
  });
});
