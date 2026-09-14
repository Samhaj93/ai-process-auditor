import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import { sampleRedesign } from "../lib/fixtures/sample-redesign.ts";
import {
  RedesignProposalSchema,
  computeMetrics,
  formatIssues,
  redesignProposalSchemaFor,
} from "../lib/schema.ts";

const asIs = sampleExtract.steps;

// A valid proposal to break one piece at a time.
const proposal = () => ({
  summary: sampleRedesign.summary,
  changes: structuredClone(sampleRedesign.changes),
  steps: structuredClone(sampleRedesign.steps),
});

describe("redesignProposalSchemaFor", () => {
  it("accepts the bundled example", () => {
    assert.equal(redesignProposalSchemaFor(asIs).safeParse(proposal()).success, true);
  });

  it("rejects a change aimed at a step the current process does not have", () => {
    const p = proposal();
    p.changes[0].targetStepIds = ["s99-invented"];
    const r = redesignProposalSchemaFor(asIs).safeParse(p);
    assert.equal(r.success, false);
    assert.ok(formatIssues(r.error!).some((m) => m.includes('unknown step id "s99-invented"')));
  });

  it("rejects redesigned steps that hand off to a step that does not exist", () => {
    const p = proposal();
    p.steps[0].handoffTo = "nowhere";
    assert.equal(redesignProposalSchemaFor(asIs).safeParse(p).success, false);
  });

  it("rejects an invented action", () => {
    const p = proposal();
    (p.changes[0] as { action: string }).action = "outsource";
    assert.equal(redesignProposalSchemaFor(asIs).safeParse(p).success, false);
  });

  it("rejects a redesign with no changes", () => {
    const p = proposal();
    p.changes = [];
    assert.equal(redesignProposalSchemaFor(asIs).safeParse(p).success, false);
  });

  it("allows new step ids in the redesigned process", () => {
    const p = proposal();
    p.steps[7].id = "s8-single-archive";
    p.steps[6].handoffTo = "s8-single-archive";
    assert.equal(redesignProposalSchemaFor(asIs).safeParse(p).success, true);
  });

  // Built per request. Building one must not change the shared schema.
  it("does not modify the shared schema", () => {
    redesignProposalSchemaFor([{ ...asIs[0], id: "only-this-id" }]);
    assert.equal(RedesignProposalSchema.safeParse(proposal()).success, true);
  });
});

describe("the bundled redesign", () => {
  it("has its projected figures computed from its steps", () => {
    assert.deepEqual(sampleRedesign.projectedMetrics, computeMetrics(sampleRedesign.steps));
  });

  it("claims exactly the lead-time saving its steps show", () => {
    const claimed = sampleRedesign.changes.reduce((n, c) => n + c.expectedSavingMinutes, 0);
    const actual =
      computeMetrics(asIs).leadTimeMinutes - sampleRedesign.projectedMetrics.leadTimeMinutes;
    assert.equal(claimed, actual);
  });
});
