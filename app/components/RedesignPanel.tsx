import type { ProcessMetrics, Redesign, RedesignAction } from "@/lib/schema";

import { formatDuration } from "./format";

const ACTION_LABEL: Record<RedesignAction, string> = {
  eliminate: "Eliminate",
  automate: "Automate",
  merge: "Merge",
  parallelise: "Parallelise",
  reorder: "Reorder",
  standardise: "Standardise",
};

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");
const percent = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;

function relative(after: number, before: number): string {
  if (before === 0) return "";
  const change = ((after - before) / before) * 100;
  return ` (${sign(change)}${Math.abs(change).toFixed(0)}%)`;
}

/**
 * Before and after, side by side, with the change computed and shown rather
 * than left to the reader. Both columns come from computeMetrics — the model
 * never supplies a figure here except each change's estimated saving.
 */
export function RedesignPanel({
  before,
  redesign,
}: {
  before: ProcessMetrics;
  redesign: Redesign;
}) {
  const after = redesign.projectedMetrics;

  const rows = [
    {
      label: "Flow efficiency",
      before: percent(before.flowEfficiency),
      after: percent(after.flowEfficiency),
      change: `${sign(after.flowEfficiency - before.flowEfficiency)}${Math.abs(
        (after.flowEfficiency - before.flowEfficiency) * 100,
      ).toFixed(1)} pts`,
    },
    {
      label: "Lead time",
      before: formatDuration(before.leadTimeMinutes),
      after: formatDuration(after.leadTimeMinutes),
      change: `${sign(after.leadTimeMinutes - before.leadTimeMinutes)}${formatDuration(
        Math.abs(after.leadTimeMinutes - before.leadTimeMinutes),
      )}${relative(after.leadTimeMinutes, before.leadTimeMinutes)}`,
    },
    {
      label: "Process time",
      before: formatDuration(before.processTimeMinutes),
      after: formatDuration(after.processTimeMinutes),
      change: `${sign(after.processTimeMinutes - before.processTimeMinutes)}${formatDuration(
        Math.abs(after.processTimeMinutes - before.processTimeMinutes),
      )}${relative(after.processTimeMinutes, before.processTimeMinutes)}`,
    },
    {
      label: "Steps",
      before: String(before.stepCount),
      after: String(after.stepCount),
      change: `${sign(after.stepCount - before.stepCount)}${Math.abs(
        after.stepCount - before.stepCount,
      )}`,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">
        Redesign · before and after
      </h2>

      <p className="max-w-prose text-sm">{redesign.summary}</p>

      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 text-left font-medium">Measure</th>
              <th className="px-3 py-2 text-right font-medium">Before</th>
              <th className="px-3 py-2 text-right font-medium">After</th>
              <th className="px-3 py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <td className="px-3 py-3 text-xs text-muted">{row.label}</td>
                <td className="px-3 py-3 text-right text-xl tabular-nums">{row.before}</td>
                <td className="px-3 py-3 text-right text-xl tabular-nums">{row.after}</td>
                <td className="px-3 py-3 text-right tabular-nums text-accent">{row.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        After figures are calculated from the redesigned steps, the same way as
        the before figures. They are not the model&apos;s estimate.
      </p>

      <h3 className="text-[11px] uppercase tracking-wider text-muted">
        Changes · {redesign.changes.length}
      </h3>
      <ol className="flex flex-col divide-y divide-border border border-border">
        {redesign.changes.map((change, i) => (
          <li key={i} className="flex flex-col gap-1 p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted">
              <span className="uppercase tracking-wider text-foreground">
                {ACTION_LABEL[change.action]}
              </span>
              <span className="font-mono">{change.targetStepIds.join(", ")}</span>
              <span>effort {change.effort}</span>
              <span className="ml-auto tabular-nums text-accent">
                −{change.expectedSavingMinutes.toLocaleString()} min
              </span>
            </div>
            <div className="text-sm">{change.description}</div>
            <div className="text-xs text-muted">{change.rationale}</div>
            {change.risk ? (
              <div className="text-xs text-muted">Risk: {change.risk}</div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        The saving shown for each change is the model&apos;s estimate.
      </p>
    </section>
  );
}
