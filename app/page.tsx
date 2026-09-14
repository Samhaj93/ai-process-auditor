"use client";

import { useRef, useState } from "react";

import { FlowEfficiency } from "@/app/components/FlowEfficiency";
import { KeyEntry } from "@/app/components/KeyEntry";
import { ProcessDiagram } from "@/app/components/ProcessDiagram";
import { ProseInput } from "@/app/components/ProseInput";
import { StepTable } from "@/app/components/StepTable";
import { WastePanel } from "@/app/components/WastePanel";
import { PROVIDERS, type ProviderId } from "@/lib/callModel";
import { sampleDiagnose } from "@/lib/fixtures/sample-diagnose";
import { sampleExtract, sampleProcessName } from "@/lib/fixtures/sample-extract";
import { auditWarnings, diagnoseWarnings } from "@/lib/quality";
import type { DiagnoseResult, ExtractResult, ProcessStep } from "@/lib/schema";
import { useSessionState } from "@/lib/useSessionState";

const DEFAULT_PROVIDER: ProviderId = "openrouter";

function toProvider(value: string): ProviderId {
  // Object.hasOwn, not `in`: `"toString" in PROVIDERS` is true.
  return Object.hasOwn(PROVIDERS, value) ? (value as ProviderId) : DEFAULT_PROVIDER;
}

type Diagnosis =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: DiagnoseResult }
  | { status: "failed"; errors: string[] };

/** POST to a stage route. Returns the parsed body, or the errors to show. */
async function postStage<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; errors: string[] }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        errors: Array.isArray(data?.errors) ? data.errors : ["The request failed."],
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, errors: ["Could not reach the server."] };
  }
}

const RETRY_BUTTON =
  "self-start border border-foreground px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-border disabled:text-muted";

export default function Page() {
  // Key, provider and model live in sessionStorage; the description does not.
  const [storedProvider, setStoredProvider] = useSessionState("provider");
  const [apiKey, setApiKey] = useSessionState("apiKey");
  const [model, setModel] = useSessionState("model");
  const provider = toProvider(storedProvider);

  const [prose, setProse] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis>({ status: "idle" });
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);

  // Every analysis, example and retry gets a new id. A slow response from an
  // earlier one is dropped, so it can never overwrite what is now on screen.
  const runId = useRef(0);

  function updateProvider(next: ProviderId) {
    setStoredProvider(next);
    setModel(""); // the previous model name means nothing to a different service
  }

  async function diagnose(steps: ProcessStep[], id: number) {
    setDiagnosis({ status: "running" });
    const res = await postStage<DiagnoseResult>("/api/diagnose", {
      steps,
      provider,
      apiKey,
      model,
    });
    if (runId.current !== id) return;
    setDiagnosis(
      res.ok ? { status: "done", result: res.data } : { status: "failed", errors: res.errors },
    );
  }

  async function analyse() {
    const id = ++runId.current;
    setBusy(true);
    setErrors([]);
    setResult(null);
    setTitle(null);
    setDiagnosis({ status: "idle" });
    setBpmnXml(null);

    const res = await postStage<ExtractResult>("/api/extract", {
      prose,
      provider,
      apiKey,
      model,
    });
    if (runId.current !== id) return;
    setBusy(false);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setResult(res.data);
    setTitle("Your process");
    // The steps are on screen before diagnosis starts, and stay there if it fails.
    await diagnose(res.data.steps, id);
  }

  function retryDiagnosis() {
    if (!result) return;
    void diagnose(result.steps, ++runId.current);
  }

  function showExample() {
    runId.current++;
    setBusy(false);
    setErrors([]);
    setResult(sampleExtract);
    setTitle(`${sampleProcessName} — worked example`);
    setDiagnosis({ status: "done", result: sampleDiagnose });
    setBpmnXml(null);
  }

  const warnings = result ? auditWarnings(result) : [];
  const findings = diagnosis.status === "done" ? diagnosis.result : null;
  const findingWarnings = result && findings ? diagnoseWarnings(result.steps, findings) : [];
  const canRetry = apiKey.trim().length > 0 && diagnosis.status !== "running";
  const download = result ? { ...result, ...(findings ?? {}), bpmnXml } : null;

  const retryButton = (
    <button type="button" className={RETRY_BUTTON} disabled={!canRetry} onClick={retryDiagnosis}>
      Retry diagnosis
    </button>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg">AI Process Auditor</h1>
        <p className="text-xs text-muted">
          Describe a business process in plain language. Get its steps, waiting
          time, flow efficiency, bottlenecks, waste and a process diagram.
        </p>
      </header>

      <KeyEntry
        provider={provider}
        apiKey={apiKey}
        model={model}
        onProvider={updateProvider}
        onApiKey={setApiKey}
        onModel={setModel}
      />

      <ProseInput
        prose={prose}
        onProse={setProse}
        onSubmit={analyse}
        onExample={showExample}
        busy={busy}
        hasKey={apiKey.trim().length > 0}
      />

      {errors.length > 0 ? (
        <section className="flex flex-col gap-1 border border-accent p-4">
          <h2 className="text-[11px] uppercase tracking-wider text-accent">
            Analysis rejected
          </h2>
          <ul className="flex flex-col gap-0.5">
            {errors.map((error, i) => (
              <li key={i} className="font-mono text-xs">
                {error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result && download ? (
        <>
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <h2 className="text-lg">{title}</h2>
            <a
              className="text-xs text-muted underline underline-offset-2"
              download="process-audit.json"
              href={`data:application/json,${encodeURIComponent(
                JSON.stringify(download, null, 2),
              )}`}
            >
              Download JSON
            </a>
          </div>

          {warnings.length > 0 ? (
            <section className="flex flex-col gap-2 border border-accent p-4">
              <h2 className="text-[11px] uppercase tracking-wider text-accent">
                Check this result
              </h2>
              <ul className="flex flex-col gap-1">
                {warnings.map((w) => (
                  <li key={w.code} className="text-sm">
                    {w.message}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Free models are markedly less consistent at this than paid ones
                — in testing they dropped waiting time in roughly one run in
                three. Run it again, add more detail about where work waits, or
                put a paid model in the Model field above.
              </p>
            </section>
          ) : null}

          <FlowEfficiency metrics={result.metrics} />

          {diagnosis.status === "running" ? (
            <p className="border border-border bg-surface px-4 py-3 text-xs text-muted">
              Finding bottlenecks and waste…
            </p>
          ) : null}

          {diagnosis.status === "failed" ? (
            <section className="flex flex-col gap-2 border border-accent p-4">
              <h2 className="text-[11px] uppercase tracking-wider text-accent">
                Bottlenecks and waste not found
              </h2>
              <ul className="flex flex-col gap-0.5">
                {diagnosis.errors.map((error, i) => (
                  <li key={i} className="font-mono text-xs">
                    {error}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                The steps below are unaffected. Free models often fail at this;
                retrying may work, or put a paid model in the Model field above.
              </p>
              {retryButton}
            </section>
          ) : null}

          {findingWarnings.length > 0 ? (
            <section className="flex flex-col gap-2 border border-accent p-4">
              <h2 className="text-[11px] uppercase tracking-wider text-accent">
                Check these findings
              </h2>
              <ul className="flex flex-col gap-1">
                {findingWarnings.map((w) => (
                  <li key={w.code} className="text-sm">
                    {w.message}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Free models are less consistent at judging bottlenecks and waste
                than paid ones. Run the diagnosis again, or put a paid model in
                the Model field above.
              </p>
              {retryButton}
            </section>
          ) : null}

          {findings ? <WastePanel wastes={findings.wastes} /> : null}

          <ProcessDiagram
            steps={result.steps}
            bottlenecks={findings?.bottlenecks}
            onXml={setBpmnXml}
          />

          <StepTable
            steps={result.steps}
            bottlenecks={findings?.bottlenecks}
            wastes={findings?.wastes}
          />
        </>
      ) : null}
    </main>
  );
}
