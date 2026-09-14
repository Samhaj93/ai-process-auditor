import { WasteCategorySchema, type WasteFinding } from "@/lib/schema";

import { WASTE_LABEL } from "./labels";

/**
 * All eight DOWNTIME categories, always shown, so an empty category reads as
 * "looked, found nothing" rather than silently missing. Minutes are not summed
 * across categories: the same waiting time can count as waiting and inventory.
 */
export function WastePanel({ wastes }: { wastes: WasteFinding[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">
        Waste · recoverable minutes per instance
      </h2>

      <div className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-4">
        {WasteCategorySchema.options.map((category) => {
          const found = wastes.filter((w) => w.category === category);
          const minutes = found.reduce((n, w) => n + w.estimatedMinutes, 0);
          const stepCount = new Set(found.flatMap((w) => w.stepIds)).size;
          return (
            <div
              key={category}
              className="flex flex-col gap-1 border-b border-r border-border p-3"
            >
              <span className="text-[11px] uppercase tracking-wider text-muted">
                {WASTE_LABEL[category]}
              </span>
              {found.length > 0 ? (
                <>
                  <span className="text-2xl tabular-nums">
                    {minutes.toLocaleString()}
                    <span className="text-xs text-muted"> min</span>
                  </span>
                  <span className="text-xs text-muted">
                    {stepCount === 1 ? "1 step" : `${stepCount} steps`}
                  </span>
                </>
              ) : (
                <span className="text-2xl text-muted">—</span>
              )}
            </div>
          );
        })}
      </div>

      {wastes.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {wastes.map((w, i) => (
            <li key={i}>
              <span className="text-muted">{WASTE_LABEL[w.category]} — </span>
              {w.description}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted">
        Estimated by the model. Categories can overlap, so they are not added together.
      </p>
    </section>
  );
}
