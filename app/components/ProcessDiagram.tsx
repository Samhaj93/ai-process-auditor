"use client";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

import { useEffect, useRef, useState } from "react";

import { buildBpmn } from "@/lib/bpmn";
import type { Bottleneck, ProcessStep } from "@/lib/schema";

import { isSevere } from "./labels";

const NO_BOTTLENECKS: Bottleneck[] = [];

/** Padding around the diagram, in diagram units. */
const PAD = 24;
/** Never shrink below this, or task labels become unreadable. Wider processes pan instead. */
const MIN_SCALE = 0.85;
/** Never enlarge past actual size; a two-step process should not fill the screen. */
const MAX_SCALE = 1;
/** Clear space under the diagram, in pixels, so the bpmn.io watermark never sits on a shape. */
const WATERMARK_ROOM = 36;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 560;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Canvas {
  viewbox(box?: Rect): Rect & { scale: number; inner: Rect };
  resized(): void;
  addMarker(elementId: string, marker: string): void;
}

/**
 * Stage 3, entirely in the browser: steps → BPMN XML (lib/bpmn.ts) → layout
 * (bpmn-auto-layout) → rendering (bpmn-js). No request and no model.
 *
 * bpmn-js's licence requires its bpmn.io watermark, drawn in the canvas's
 * bottom-right corner, to stay fully visible. Nothing may be placed over it.
 */
export function ProcessDiagram({
  steps,
  bottlenecks = NO_BOTTLENECKS,
  onXml,
  title = "Process diagram · BPMN",
  caption = "Drawn from the steps in code, not by the model, so it always matches the table below. Drag to move around.",
}: {
  steps: ProcessStep[];
  bottlenecks?: Bottleneck[];
  /** Receives the laid-out XML, so it can be included in the download. */
  onXml?: (xml: string) => void;
  title?: string;
  caption?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let cancelled = false;
    let viewer: { destroy(): void } | null = null;

    (async () => {
      try {
        // Both touch the DOM when imported, so they load only in the browser.
        const [{ default: NavigatedViewer }, { layoutProcess }] = await Promise.all([
          import("bpmn-js/lib/NavigatedViewer"),
          import("bpmn-auto-layout"),
        ]);
        const { xml, taskIdFor } = buildBpmn(steps);
        const laidOut = await layoutProcess(xml);
        if (cancelled) return;

        // Draw in the page's own colours, so the diagram follows light and dark mode.
        const css = getComputedStyle(host);
        const instance = new NavigatedViewer({
          container: host,
          bpmnRenderer: {
            defaultFillColor: css.getPropertyValue("--background").trim(),
            defaultStrokeColor: css.getPropertyValue("--foreground").trim(),
            defaultLabelColor: css.getPropertyValue("--foreground").trim(),
          },
        });
        viewer = instance;
        await instance.importXML(laidOut);
        if (cancelled) return;

        const canvas = instance.get("canvas") as Canvas;
        fitToWidth(host, canvas);

        for (const b of bottlenecks) {
          const id = taskIdFor.get(b.stepId);
          if (id) canvas.addMarker(id, isSevere(b.severity) ? "bottleneck-severe" : "bottleneck");
        }
        setError(null);
        onXml?.(laidOut);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "unknown error");
        }
      }
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [steps, bottlenecks, onXml]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">{title}</h2>
      <div
        ref={container}
        className="w-full border border-border bg-background"
        style={{ height: MIN_HEIGHT }}
      />
      {error ? (
        <p className="text-xs text-accent">The diagram could not be drawn: {error}</p>
      ) : null}
      <p className="text-xs text-muted">
        {caption}
        {bottlenecks.length > 0 ? " A thick outline marks a bottleneck." : ""}
      </p>
    </section>
  );
}

/**
 * Size the frame to the diagram rather than the diagram to the frame.
 *
 * Processes lay out as one long row, so "fit to viewport" shrinks them until
 * labels are unreadable and leaves most of a fixed-height frame empty. Instead:
 * scale to the frame's width, but no smaller than MIN_SCALE; set the frame's
 * height to the diagram's; and anchor at the top-left, where the process starts.
 */
function fitToWidth(host: HTMLDivElement, canvas: Canvas) {
  const { inner } = canvas.viewbox();
  const contentWidth = inner.width + PAD * 2;
  const contentHeight = inner.height + PAD * 2;

  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, host.clientWidth / contentWidth));
  const height = Math.min(
    MAX_HEIGHT,
    Math.max(MIN_HEIGHT, Math.ceil(contentHeight * scale) + WATERMARK_ROOM),
  );

  host.style.height = `${height}px`;
  canvas.resized();
  canvas.viewbox({
    x: inner.x - PAD,
    y: inner.y - PAD,
    width: host.clientWidth / scale,
    height: height / scale,
  });
}
