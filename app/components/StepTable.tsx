import type { ProcessStep, ValueClass } from "@/lib/schema";

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

export function StepTable({ steps }: { steps: ProcessStep[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">
        Steps
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
            {steps.map((step) => (
              <tr key={step.id} className="border-b border-border last:border-b-0">
                <td className={TD}>
                  <div>{step.name}</div>
                  <div className="font-mono text-xs text-muted">{step.id}</div>
                  {step.notes ? (
                    <div className="mt-1 max-w-prose text-xs text-muted">
                      {step.notes}
                    </div>
                  ) : null}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{step.actor}</td>
                <td className={TD_NUM}>{step.processMinutes.toLocaleString()}</td>
                <td className={TD_NUM}>{step.waitMinutes.toLocaleString()}</td>
                <td className={TD}>
                  <span className="text-xs text-muted">
                    {step.systems.join(", ")}
                  </span>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <span
                    className={
                      step.valueClass === "non-value-add"
                        ? "text-accent"
                        : "text-muted"
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
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Process and wait in minutes. VA value-add · BNVA business-non-value-add ·
        NVA non-value-add · ↺ rework loop.
      </p>
    </section>
  );
}
