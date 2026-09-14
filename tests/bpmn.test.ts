import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { layoutProcess } from "bpmn-auto-layout";

import { buildBpmn } from "../lib/bpmn.ts";
import { sampleExtract } from "../lib/fixtures/sample-extract.ts";
import type { ProcessStep } from "../lib/schema.ts";

const step = (id: string, over: Partial<ProcessStep> = {}): ProcessStep => ({
  id,
  name: `Step ${id}`,
  actor: "Someone",
  processMinutes: 10,
  waitMinutes: 5,
  systems: [],
  valueClass: "value-add",
  handoffTo: null,
  reworkTo: null,
  notes: null,
  ...over,
});

const count = (xml: string, pattern: RegExp) => (xml.match(pattern) ?? []).length;
const flowNodes = /<bpmn:(task|startEvent|endEvent|exclusiveGateway) /g;
const sequenceFlows = /<bpmn:sequenceFlow /g;

describe("buildBpmn", () => {
  const { xml, taskIdFor } = buildBpmn(sampleExtract.steps);

  it("draws one task per step and maps every step to it", () => {
    assert.equal(count(xml, /<bpmn:task /g), sampleExtract.steps.length);
    for (const s of sampleExtract.steps) {
      assert.ok(xml.includes(`id="${taskIdFor.get(s.id)}"`), `no task for ${s.id}`);
    }
  });

  // userTask draws a person icon over the first letters of a wrapped label.
  it("uses plain tasks, not user tasks", () => {
    assert.equal(count(xml, /<bpmn:userTask /g), 0);
  });

  it("ends every terminal step", () => {
    const terminal = sampleExtract.steps.filter((s) => s.handoffTo === null).length;
    assert.equal(count(xml, /<bpmn:endEvent /g), terminal);
  });

  // s3-resolve-mismatch loops back to s2-match-po, then hands off to s4.
  it("turns a rework loop into a gateway with yes and no branches", () => {
    assert.equal(count(xml, /<bpmn:exclusiveGateway /g), 1);
    const back = taskIdFor.get("s2-match-po");
    const onward = taskIdFor.get("s4-manager-approval");
    assert.match(xml, new RegExp(`sourceRef="Gateway_3" targetRef="${back}" name="yes"`));
    assert.match(xml, new RegExp(`sourceRef="Gateway_3" targetRef="${onward}" name="no"`));
  });

  it("puts the actor in each task's label", () => {
    assert.ok(xml.includes('name="Cost centre manager approval&#10;(Cost centre manager)"'));
  });

  it("escapes names so the XML stays valid", () => {
    const out = buildBpmn([step("s1", { name: `R&D <review> "fast"`, actor: "O'Neil" })]).xml;
    assert.ok(out.includes("R&amp;D &lt;review&gt; &quot;fast&quot;"));
    assert.ok(out.includes("(O&apos;Neil)"));
    assert.ok(!out.includes("<review>"));
  });

  it("produces valid XML ids even when step ids are not XML names", () => {
    const out = buildBpmn([
      step("1 first", { handoffTo: "a:b/c" }),
      step("a:b/c", { reworkTo: "1 first" }),
    ]).xml;
    for (const [, id] of out.matchAll(/ id="([^"]+)"/g)) {
      assert.match(id, /^[A-Za-z_][\w.-]*$/, `invalid id ${id}`);
    }
  });

  it("still has a start when the whole process is a loop", () => {
    const out = buildBpmn([step("a", { handoffTo: "b" }), step("b", { handoffTo: "a" })]).xml;
    assert.match(out, /sourceRef="Start" targetRef="Task_1"/);
  });

  it("starts every branch that nothing hands off to", () => {
    const out = buildBpmn([
      step("a", { handoffTo: "c" }),
      step("b", { handoffTo: "c" }),
      step("c"),
    ]).xml;
    assert.equal(count(out, /sourceRef="Start"/g), 2);
  });
});

// The XML is only useful if the layout engine accepts it and positions all of it.
describe("buildBpmn output through bpmn-auto-layout", () => {
  const laidOut = async (steps: ProcessStep[]) => {
    const { xml } = buildBpmn(steps);
    const result = await layoutProcess(xml);
    return { xml, result };
  };

  const cases: Array<[string, ProcessStep[]]> = [
    ["the bundled example", sampleExtract.steps],
    ["a single step", [step("only")]],
    ["a process that is one loop", [step("a", { handoffTo: "b" }), step("b", { handoffTo: "a" })]],
    ["a step that hands off to itself", [step("a", { handoffTo: "a" })]],
    ["a rework loop on the last step", [step("a", { handoffTo: "b" }), step("b", { reworkTo: "a" })]],
  ];

  for (const [label, steps] of cases) {
    it(`lays out ${label}, positioning every node and flow`, async () => {
      const { xml, result } = await laidOut(steps);
      assert.equal(typeof result, "string");
      assert.equal(count(result, /<bpmndi:BPMNShape /g), count(xml, flowNodes));
      assert.equal(count(result, /<bpmndi:BPMNEdge /g), count(xml, sequenceFlows));
    });
  }
});
