import type { Bottleneck, ProcessStep, ValueClass, WasteFinding } from "@/lib/schema";

import { BOTTLENECK_LABEL, WASTE_LABEL, isSevere } from "./labels";

/** Standard Lean abbreviations. The legend below the table spells them out. */
const VALUE_CLASS_LABEL: Record<ValueClass, string> = {
  "value-add": "VA",
  "business-non-value-add": "BNVA",
  "non-value-add": "NVA",
};

const TH = "px-3 py-2 text-left font-medium";
const TH_NUM = "px-3 py-2 text-right font-medium";
const TD = "px-3 py-2 align-top";
const TD_NUM = "px-3 py-2 align-top text-right tabular-nums";

/**
 * Bottlenecks are marked on the step they belong to, not listed separately:
 * an accent edge on the row, and the finding under the step's name.
 */
export function StepTable({
  steps,
  bottlenecks = [],
  wastes = [],
}: {
  steps: ProcessStep[];
  bottlenecks?: Bottleneck[];
  wastes?: WasteFinding[];
}) {
  const bottleneckAt = new Map(bottlenecks.map((b) => [b.stepId, b]));
  const wasteLabelsAt = (id: string) => [
    ...new Set(
      wastes.filter((w) => w.stepIds.includes(id)).map((w) => WASTE_LABEL[w.category]),
    ),
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">
        Steps
        {bottlenecks.length > 0
          ? ` · ${bottlenecks.length} ${bottlenecks.length === 1 ? "bottleneck" : "bottlenecks"}`
          : ""}
      </h2>

      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted">
              <th className={TH}>Step</th>
              <th className={TH}>Actor</th>
              <th className={TH_NUM}>Process</th>
              <th className={TH_NUM}>Wait</th>
              <th className={TH}>Systems</th>
              <th className={TH}>Class</th>
              <th className={TH}>Flow</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const bottleneck = bottleneckAt.get(step.id);
              const wasteLabels = wasteLabelsAt(step.id);
              return (
                <tr
                  key={step.id}
                  className={`border-b border-border last:border-b-0 ${
                    bottleneck ? "border-l-4 border-l-accent" : ""
                  }`}
                >
                  <td className={TD}>
                    <div>{step.name}</div>
                    <div className="font-mono text-xs text-muted">{step.id}</div>
                    {step.notes ? (
                      <div className="mt-1 max-w-prose text-xs text-muted">
                        {step.notes}
                      </div>
                    ) : null}
                    {bottleneck ? (
                      <div className="mt-2 flex flex-col gap-0.5">
                        <div
                          className={`text-xs ${
                            isSevere(bottleneck.severity) ? "text-accent" : "text-foreground"
                          }`}
                        >
                          Bottleneck · {BOTTLENECK_LABEL[bottleneck.type]} ·{" "}
                          {bottleneck.severity} ·{" "}
                          <span className="tabular-nums">
                            {bottleneck.impactMinutes.toLocaleString()} min
                          </span>
                        </div>
                        <div className="max-w-prose text-xs text-muted">
                          {bottleneck.evidence}
                        </div>
                      </div>
                    ) : null}
                    {wasteLabels.length > 0 ? (
                      <div className="mt-1 text-xs text-muted">
                        Waste: {wasteLabels.join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{step.actor}</td>
                  <td className={TD_NUM}>{step.processMinutes.toLocaleString()}</td>
                  <td className={TD_NUM}>{step.waitMinutes.toLocaleString()}</td>
                  <td className={TD}>
                    <span className="text-xs text-muted">{step.systems.join(", ")}</span>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <span
                      className={
                        step.valueClass === "non-value-add" ? "text-accent" : "text-muted"
                      }
                    >
                      {VALUE_CLASS_LABEL[step.valueClass]}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap font-mono text-xs text-muted`}>
                    {step.handoffTo ? `→ ${step.handoffTo}` : "end"}
                    {step.reworkTo ? (
                      <div className="text-accent">↺ {step.reworkTo}</div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Process and wait in minutes. VA value-add · BNVA business-non-value-add ·
        NVA non-value-add · ↺ rework loop
        {bottlenecks.length > 0 ? " · a thick left edge marks a bottleneck" : ""}.
      </p>
    </section>
  );
}
