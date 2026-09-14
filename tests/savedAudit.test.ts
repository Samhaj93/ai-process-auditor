import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sampleDiagnose } from "../lib/fixtures/sample-diagnose.ts";
import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import { sampleRedesign } from "../lib/fixtures/sample-redesign.ts";
import { buildSavedAudit, parseSavedAudit } from "../lib/savedAudit.ts";
import { computeMetrics } from "../lib/schema.ts";

/** What a file on disk becomes once read back. */
const asFile = (value: unknown) => JSON.parse(JSON.stringify(value));

const full = { extract: sampleExtract, diagnosis: sampleDiagnose, redesign: sampleRedesign };

function errorsOf(json: unknown): string[] {
  const r = parseSavedAudit(json);
  assert.equal(r.ok, false, "expected the file to be rejected");
  return r.ok ? [] : r.errors;
}

describe("saving and opening a result", () => {
  it("opens a downloaded result exactly as it was saved", () => {
    const r = parseSavedAudit(asFile(buildSavedAudit(full, "<bpmn />")));
    assert.ok(r.ok);
    assert.deepEqual(r.value, full);
  });

  it("opens a result saved before bottlenecks and waste were found", () => {
    const saved = { extract: sampleExtract, diagnosis: null, redesign: null };
    const r = parseSavedAudit(asFile(buildSavedAudit(saved, null)));
    assert.ok(r.ok);
    assert.equal(r.value.diagnosis, null);
    assert.equal(r.value.redesign, null);
  });

  it("keeps findings that came back empty, rather than treating them as missing", () => {
    const empty = { bottlenecks: [], wastes: [] };
    const saved = { extract: sampleExtract, diagnosis: empty, redesign: null };
    const r = parseSavedAudit(asFile(buildSavedAudit(saved, null)));
    assert.ok(r.ok);
    assert.deepEqual(r.value.diagnosis, empty);
  });

  // Figures are derived. A hand-edited file cannot make them say something its steps do not.
  it("recalculates every figure from the steps instead of trusting the file", () => {
    const file = asFile(buildSavedAudit(full, null));
    file.metrics.flowEfficiency = 0.99;
    file.redesign.projectedMetrics.leadTimeMinutes = 1;
    const r = parseSavedAudit(file);
    assert.ok(r.ok);
    assert.deepEqual(r.value.extract.metrics, computeMetrics(sampleExtract.steps));
    assert.deepEqual(r.value.redesign?.projectedMetrics, computeMetrics(sampleRedesign.steps));
  });
});

describe("rejecting a file", () => {
  for (const [label, json] of [
    ["an array", []],
    ["a string", "hello"],
    ["null", null],
    ["an unrelated JSON object", { name: "not ours" }],
  ] as const) {
    it(`says plainly when it is ${label}`, () => {
      assert.deepEqual(errorsOf(json), ["This file is not a saved result from AI Process Auditor."]);
    });
  }

  it("lists what is wrong with the steps", () => {
    const file = asFile(buildSavedAudit(full, null));
    file.steps[2].processMinutes = "twenty";
    const errors = errorsOf(file);
    assert.equal(errors[0], "The steps in this file are not valid:");
    assert.ok(errors.some((e) => e.startsWith("2.processMinutes")));
  });

  it("rejects findings that point at a step the file does not have", () => {
    const file = asFile(buildSavedAudit(full, null));
    file.bottlenecks[0].stepId = "s99-invented";
    assert.equal(errorsOf(file)[0], "The bottlenecks and waste in this file are not valid:");
  });

  it("rejects a redesign change aimed at a step the file does not have", () => {
    const file = asFile(buildSavedAudit(full, null));
    file.redesign.changes[0].targetStepIds = ["s99-invented"];
    assert.equal(errorsOf(file)[0], "The redesign in this file is not valid:");
  });

  it("rejects a redesign with no findings behind it", () => {
    const file = asFile(buildSavedAudit(full, null));
    delete file.bottlenecks;
    delete file.wastes;
    assert.match(errorsOf(file)[0], /redesign but no bottlenecks or waste/);
  });

  it("rejects more steps than the app accepts", () => {
    const file = asFile(buildSavedAudit(full, null));
    file.steps = Array.from({ length: 61 }, (_, i) => ({ ...file.steps[0], id: `s${i}` }));
    assert.match(errorsOf(file)[0], /Too many steps — 61/);
  });
});
