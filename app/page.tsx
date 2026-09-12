import { FlowEfficiency } from "@/app/components/FlowEfficiency";
import { StepTable } from "@/app/components/StepTable";
import { sampleExtract, sampleProcessName } from "@/lib/fixtures/sample-extract";

export default function Page() {
  const { steps, metrics } = sampleExtract;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-lg">{sampleProcessName}</h1>
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Fixture data
          </span>
        </div>
        <p className="text-xs text-muted">
          Stage 1 (extract) · rendered from a local fixture, no model call.
        </p>
      </header>

      <FlowEfficiency metrics={metrics} />
      <StepTable steps={steps} />
    </main>
  );
}
