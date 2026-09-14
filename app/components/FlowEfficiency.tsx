import type { ProcessMetrics } from "@/lib/schema";

import { formatDuration } from "./format";

function Figure({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-2xl tabular-nums">{value}</span>
      <span className="text-xs tabular-nums text-muted">{sub}</span>
    </div>
  );
}

export function FlowEfficiency({ metrics }: { metrics: ProcessMetrics }) {
  const percent = metrics.flowEfficiency * 100;

  return (
    <section className="border border-border bg-surface">
      <div className="grid gap-8 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Flow efficiency
          </span>
          <span className="text-6xl leading-none tabular-nums sm:text-7xl">
            {percent < 10 ? percent.toFixed(1) : percent.toFixed(0)}
            <span className="text-3xl text-muted">%</span>
          </span>
          <span className="text-xs text-muted">
            process time ÷ lead time
          </span>
        </div>

        <div className="flex gap-10 sm:justify-end">
          <Figure
            label="Process time"
            value={formatDuration(metrics.processTimeMinutes)}
            sub={`${metrics.processTimeMinutes.toLocaleString()} min`}
          />
          <Figure
            label="Lead time"
            value={formatDuration(metrics.leadTimeMinutes)}
            sub={`${metrics.leadTimeMinutes.toLocaleString()} min`}
          />
        </div>
      </div>
    </section>
  );
}
