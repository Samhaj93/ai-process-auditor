import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import { sampleRedesign } from "../lib/fixtures/sample-redesign.ts";
import { redesignWarnings } from "../lib/quality.ts";
import {
  computeMetrics,
  type ProcessStep,
  type Redesign,
  type RedesignChange,
} from "../lib/schema.ts";

const asIs = sampleExtract.steps; // lead 5,658 min

const redesign = (steps: ProcessStep[], changes: RedesignChange[]): Redesign => ({
  summary: "Test.",
  changes,
  steps,
  projectedMetrics: computeMetrics(steps),
});

const change = (over: Partial<RedesignChange>): RedesignChange => ({
  action: "automate",
  targetStepIds: ["s4-manager-approval"],
  description: "x",
  rationale: "y",
  expectedSavingMinutes: 0,
  effort: "low",
  risk: null,
  ...over,
});

const codes = (r: Redesign) => redesignWarnings(asIs, r).map((w) => w.code);

describe("redesignWarnings", () => {
  it("raises nothing for the bundled example", () => {
    assert.deepEqual(redesignWarnings(asIs, sampleRedesign), []);
  });

  it("flags a redesign that does not shorten the process", () => {
    const same = redesign(structuredClone(asIs), [change({ expectedSavingMinutes: 0 })]);
    assert.ok(codes(same).includes("no-improvement"));
  });

  it("flags claimed savings far from what the redesigned steps show", () => {
    const r = { ...sampleRedesign, changes: [change({ expectedSavingMinutes: 10000 })] };
    assert.ok(codes(r).includes("savings-mismatch"));
  });

  it("tolerates a small gap between claimed and actual savings", () => {
    const actual = 5658 - sampleRedesign.projectedMetrics.leadTimeMinutes;
    const r = { ...sampleRedesign, changes: [change({ expectedSavingMinutes: actual + 50 })] };
    assert.ok(!codes(r).includes("savings-mismatch"));
  });

  it("flags eliminating a value-add step", () => {
    const r = {
      ...sampleRedesign,
      changes: [
        ...sampleRedesign.changes,
        change({ action: "eliminate", targetStepIds: ["s6-payment-run"] }),
      ],
    };
    assert.ok(codes(r).includes("value-add-removed"));
  });

  it("flags a value-add step that silently disappears", () => {
    const steps = structuredClone(sampleRedesign.steps).filter(
      (s) => s.id !== "s7-remittance-advice",
    );
    steps.find((s) => s.id === "s6-payment-run")!.handoffTo = "s8-archive";
    assert.ok(codes(redesign(steps, sampleRedesign.changes)).includes("value-add-removed"));
  });

  it("does not flag a value-add step that was merged into another", () => {
    const steps = structuredClone(sampleRedesign.steps).filter(
      (s) => s.id !== "s7-remittance-advice",
    );
    steps.find((s) => s.id === "s6-payment-run")!.handoffTo = "s8-archive";
    const merge = change({
      action: "merge",
      targetStepIds: ["s6-payment-run", "s7-remittance-advice"],
    });
    assert.ok(
      !codes(redesign(steps, [...sampleRedesign.changes, merge])).includes("value-add-removed"),
    );
  });
});
