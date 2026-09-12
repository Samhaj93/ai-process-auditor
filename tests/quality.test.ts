import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import { auditWarnings } from "../lib/quality.ts";
import { computeMetrics, type ProcessStep } from "../lib/schema.ts";

const step = (id: string, over: Partial<ProcessStep> = {}): ProcessStep => ({
  id,
  name: `Step ${id}`,
  actor: "Someone",
  processMinutes: 10,
  waitMinutes: 30,
  systems: [],
  valueClass: "value-add",
  handoffTo: null,
  reworkTo: null,
  notes: null,
  ...over,
});

const result = (steps: ProcessStep[]) => ({ steps, metrics: computeMetrics(steps) });
const codes = (steps: ProcessStep[]) => auditWarnings(result(steps)).map((w) => w.code);

describe("auditWarnings", () => {
  it("raises nothing for a plausible process", () => {
    assert.deepEqual(auditWarnings(sampleExtract), []);
  });

  // The exact failure observed from the free model: valid JSON, every wait zeroed.
  it("flags a process with no waiting time at all", () => {
    const steps = [step("s1", { waitMinutes: 0, handoffTo: "s2" }), step("s2", { waitMinutes: 0 })];
    assert.equal(computeMetrics(steps).flowEfficiency, 1);
    assert.deepEqual(codes(steps), ["no-wait-time"]);
  });

  it("does not flag when at least one step waits", () => {
    const steps = [step("s1", { waitMinutes: 0, handoffTo: "s2" }), step("s2", { waitMinutes: 5 })];
    assert.deepEqual(codes(steps), []);
  });

  it("flags a process with no hands-on time", () => {
    const steps = [step("s1", { processMinutes: 0, handoffTo: "s2" }), step("s2", { processMinutes: 0 })];
    assert.deepEqual(codes(steps), ["no-process-time"]);
  });

  it("flags a single-step extraction", () => {
    assert.deepEqual(codes([step("s1")]), ["single-step"]);
  });

  it("reports every problem together", () => {
    const steps = [step("s1", { waitMinutes: 0, processMinutes: 0 })];
    assert.deepEqual(codes(steps), ["no-wait-time", "no-process-time", "single-step"]);
  });

  it("messages are plain sentences a user can act on", () => {
    for (const w of auditWarnings(result([step("s1", { waitMinutes: 0, processMinutes: 0 })]))) {
      assert.ok(w.message.length > 30);
      assert.ok(!/undefined|null|NaN/.test(w.message));
    }
  });
});
