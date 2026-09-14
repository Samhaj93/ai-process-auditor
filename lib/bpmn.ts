// Stage 3: the process as BPMN 2.0 XML, built from the steps in code.
//
// Deliberately not a model call. The steps already hold everything a diagram
// needs (order, rework loops, who does each step), so building the XML is
// deterministic: always valid, instant, and it spends none of the free daily
// requests. The free default model got stage 2 right in 4 of 12 attempts, and
// a drawable BPMN file also needs a position for every shape, which is exactly
// what language models get wrong.
//
// The output has no layout (no BPMNDI section). bpmn-auto-layout adds that in
// the browser, in app/components/ProcessDiagram.tsx.
//
// No swimlanes: bpmn-auto-layout 1.3.0 silently drops lane and pool shapes, so
// the actor is written into each task's label instead.

import type { ProcessStep } from "./schema.ts";

export interface BpmnModel {
  xml: string;
  /** BPMN element id for each step id, used to mark bottlenecks on the diagram. */
  taskIdFor: Map<string, string>;
}

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);

interface FlowNode {
  // Plain task, not userTask: userTask's person icon sits over the first letters
  // of a wrapped label, and the actor is already written into the label.
  tag: "startEvent" | "task" | "exclusiveGateway" | "endEvent";
  id: string;
  /** Already XML-escaped. */
  label: string;
}

interface SequenceFlow {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export function buildBpmn(steps: ProcessStep[]): BpmnModel {
  // Element ids come from positions, not step ids. The schema lets a step id be
  // any text, and a BPMN id must be a valid XML name.
  const taskIdFor = new Map(steps.map((s, i) => [s.id, `Task_${i + 1}`]));
  const taskId = (stepId: string) => taskIdFor.get(stepId) as string;

  const nodes: FlowNode[] = [{ tag: "startEvent", id: "Start", label: "Start" }];
  const flows: SequenceFlow[] = [];
  const connect = (source: string, target: string, label?: string) =>
    flows.push({ id: `Flow_${flows.length + 1}`, source, target, label });

  // Start at every step nothing hands off to. A process that is entirely one
  // loop has no such step, so it starts at the first step instead.
  const handedTo = new Set(
    steps.map((s) => s.handoffTo).filter((id): id is string => id !== null),
  );
  const roots = steps.filter((s) => !handedTo.has(s.id));
  for (const root of roots.length > 0 ? roots : steps.slice(0, 1)) {
    connect("Start", taskId(root.id));
  }

  steps.forEach((step, i) => {
    nodes.push({
      tag: "task",
      id: taskId(step.id),
      // &#10; survives XML attribute normalisation as a line break; a raw \n would not.
      label: `${escapeXml(step.name)}&#10;(${escapeXml(step.actor)})`,
    });

    let from = taskId(step.id);
    if (step.reworkTo !== null) {
      const gateway = `Gateway_${i + 1}`;
      nodes.push({ tag: "exclusiveGateway", id: gateway, label: "Rework?" });
      connect(from, gateway);
      connect(gateway, taskId(step.reworkTo), "yes");
      from = gateway;
    }

    const branch = step.reworkTo !== null ? "no" : undefined;
    if (step.handoffTo !== null) {
      connect(from, taskId(step.handoffTo), branch);
    } else {
      const end = `End_${i + 1}`;
      nodes.push({ tag: "endEvent", id: end, label: "End" });
      connect(from, end, branch);
    }
  });

  const nodeXml = nodes.map(({ tag, id, label }) => {
    const refs = [
      ...flows.filter((f) => f.target === id).map((f) => `<bpmn:incoming>${f.id}</bpmn:incoming>`),
      ...flows.filter((f) => f.source === id).map((f) => `<bpmn:outgoing>${f.id}</bpmn:outgoing>`),
    ].join("");
    return `    <bpmn:${tag} id="${id}" name="${label}">${refs}</bpmn:${tag}>`;
  });

  const flowXml = flows.map(
    ({ id, source, target, label }) =>
      `    <bpmn:sequenceFlow id="${id}" sourceRef="${source}" targetRef="${target}"${
        label ? ` name="${label}"` : ""
      } />`,
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">',
    '  <bpmn:process id="Process_1" isExecutable="false">',
    ...nodeXml,
    ...flowXml,
    "  </bpmn:process>",
    "</bpmn:definitions>",
  ].join("\n");

  return { xml, taskIdFor };
}
