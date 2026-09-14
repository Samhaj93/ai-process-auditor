import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleDiagnose } from "../lib/fixtures/sample-diagnose.ts";
import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import { diagnoseWarnings } from "../lib/quality.ts";
import type { Bottleneck, WasteFinding } from "../lib/schema.ts";

// Fixture: lead time 5,658 min, of which 12 min is value-add work.
// s4-manager-approval takes 6 + 1,440 = 1,446 min in total.
const steps = sampleExtract.steps;
const codes = (bottlenecks: Bottleneck[], wastes: WasteFinding[]) =>
  diagnoseWarnings(steps, { bottlenecks, wastes }).map((w) => w.code);

const b = (stepId: string, impactMinutes: number): Bottleneck => ({
  stepId,
  type: "approval",
  severity: "high",
  evidence: "waits overnight",
  impactMinutes,
});
const w = (estimatedMinutes: number): WasteFinding => ({
  category: "waiting",
  stepIds: ["s4-manager-approval"],
  description: "Queue time.",
  estimatedMinutes,
});

describe("diagnoseWarnings", () => {
  it("raises nothing for grounded findings", () => {
    assert.deepEqual(codes([b("s4-manager-approval", 1440)], [w(1440)]), []);
  });

  it("raises nothing for the bundled example", () => {
    assert.deepEqual(diagnoseWarnings(steps, sampleDiagnose), []);
  });

  it("flags a bottleneck claiming more delay than its step takes", () => {
    assert.deepEqual(codes([b("s4-manager-approval", 1447)], []), ["impact-exceeds-step"]);
  });

  it("allows impact equal to the whole step", () => {
    assert.deepEqual(codes([b("s4-manager-approval", 1446)], []), []);
  });

  // What the model actually did: claimed all 5,580 waiting minutes. Optimistic,
  // but still within what is recoverable (5,658 - 12 = 5,646), so no warning.
  it("does not flag optimistic recovery that is still possible", () => {
    assert.deepEqual(codes([b("s4-manager-approval", 1440)], [w(5580), w(66)]), []);
  });

  it("flags recovery that exceeds all non-value-adding time", () => {
    assert.deepEqual(codes([b("s4-manager-approval", 1440)], [w(5580), w(67)]), [
      "recovery-exceeds-possible",
    ]);
  });

  it("flags finding nothing in a process that mostly waits", () => {
    assert.deepEqual(codes([], []), ["no-findings"]);
  });
});
