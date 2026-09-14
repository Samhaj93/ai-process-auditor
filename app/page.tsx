"use client";

import { useRef, useState } from "react";

import { FlowEfficiency } from "@/app/components/FlowEfficiency";
import { KeyEntry } from "@/app/components/KeyEntry";
import { ProcessDiagram } from "@/app/components/ProcessDiagram";
import { ProseInput } from "@/app/components/ProseInput";
import { RedesignPanel } from "@/app/components/RedesignPanel";
import { StepTable } from "@/app/components/StepTable";
import { WastePanel } from "@/app/components/WastePanel";
import { PROVIDERS, type ProviderId } from "@/lib/callModel";
import { sampleDiagnose } from "@/lib/fixtures/sample-diagnose";
import { sampleExtract, sampleProcessName } from "@/lib/fixtures/sample-extract";
import { sampleRedesign } from "@/lib/fixtures/sample-redesign";
import { auditWarnings, diagnoseWarnings, redesignWarnings } from "@/lib/quality";
import { MAX_SAVED_FILE_BYTES, buildSavedAudit, parseSavedAudit } from "@/lib/savedAudit";
import type { DiagnoseResult, ExtractResult, ProcessStep, Redesign } from "@/lib/schema";
import { useSessionState } from "@/lib/useSessionState";

const DEFAULT_PROVIDER: ProviderId = "openrouter";

function toProvider(value: string): ProviderId {
  // Object.hasOwn, not `in`: `"toString" in PROVIDERS` is true.
  return Object.hasOwn(PROVIDERS, value) ? (value as ProviderId) : DEFAULT_PROVIDER;
}

/** A model stage that runs after the steps are on screen. */
type Stage<T> =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: T }
  | { status: "failed"; errors: string[] };

interface Problem {
  title: string;
  lines: string[];
}

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

const BUTTON =
  "self-start border border-foreground px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-border disabled:text-muted";

const REDESIGN_CAPTION =
  "The redesigned process, drawn from the proposed steps in code, not by the model. Drag to move around.";

export default function Page() {
  // Key, provider and model live in sessionStorage; the description does not.
  const [storedProvider, setStoredProvider] = useSessionState("provider");
  const [apiKey, setApiKey] = useSessionState("apiKey");
  const [model, setModel] = useSessionState("model");
  const provider = toProvider(storedProvider);

  const [prose, setProse] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Stage<DiagnoseResult>>({ status: "idle" });
  const [redesign, setRedesign] = useState<Stage<Redesign>>({ status: "idle" });
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);

  // Every analysis, example, file and retry gets a new id. A slow response from
  // an earlier one is dropped, so it can never overwrite what is now on screen.
  const runId = useRef(0);

  function updateProvider(next: ProviderId) {
    setStoredProvider(next);
    setModel(""); // the previous model name means nothing to a different service
  }

  async function diagnose(steps: ProcessStep[], id: number) {
    setDiagnosis({ status: "running" });
    setRedesign({ status: "idle" }); // a redesign answers the old findings
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
    setProblem(null);
    setResult(null);
    setTitle(null);
    setDiagnosis({ status: "idle" });
    setRedesign({ status: "idle" });
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
      setProblem({ title: "Analysis rejected", lines: res.errors });
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

  // Redesign is on request, not automatic: it costs one more of the 50 free
  // daily requests and can take a couple of minutes.
  async function proposeRedesign() {
    if (!result || diagnosis.status !== "done") return;
    const id = ++runId.current;
    setRedesign({ status: "running" });
    const res = await postStage<Redesign>("/api/redesign", {
      steps: result.steps,
      bottlenecks: diagnosis.result.bottlenecks,
      wastes: diagnosis.result.wastes,
      provider,
      apiKey,
      model,
    });
    if (runId.current !== id) return;
    setRedesign(
      res.ok ? { status: "done", result: res.data } : { status: "failed", errors: res.errors },
    );
  }

  function show(saved: { extract: ExtractResult; diagnosis: DiagnoseResult | null; redesign: Redesign | null }, heading: string) {
    setBusy(false);
    setProblem(null);
    setResult(saved.extract);
    setTitle(heading);
    setDiagnosis(saved.diagnosis ? { status: "done", result: saved.diagnosis } : { status: "idle" });
    setRedesign(saved.redesign ? { status: "done", result: saved.redesign } : { status: "idle" });
    setBpmnXml(null); // the diagram redraws from the steps and reports its XML again
  }

  function showExample() {
    runId.current++;
    show(
      { extract: sampleExtract, diagnosis: sampleDiagnose, redesign: sampleRedesign },
      `${sampleProcessName} — worked example`,
    );
  }

  async function openSaved(file: File) {
    const id = ++runId.current;
    const reject = (lines: string[]) => setProblem({ title: "Could not open that file", lines });

    if (file.size > MAX_SAVED_FILE_BYTES) {
      reject([
        `The file is ${(file.size / 1_000_000).toFixed(1)} MB. Saved results are well under ${
          MAX_SAVED_FILE_BYTES / 1_000_000
        } MB, so this is not one.`,
      ]);
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      if (runId.current === id) reject(["The file is not valid JSON."]);
      return;
    }
    if (runId.current !== id) return;

    const parsed = parseSavedAudit(json);
    if (!parsed.ok) {
      reject(parsed.errors);
      return;
    }
    show(parsed.value, `${file.name} — opened`);
  }

  const hasKey = apiKey.trim().length > 0;
  const warnings = result ? auditWarnings(result) : [];
  const findings = diagnosis.status === "done" ? diagnosis.result : null;
  const findingWarnings = result && findings ? diagnoseWarnings(result.steps, findings) : [];
  const hasFindings = !!findings && (findings.bottlenecks.length > 0 || findings.wastes.length > 0);
  const proposal = redesign.status === "done" ? redesign.result : null;
  const proposalWarnings = result && proposal ? redesignWarnings(result.steps, proposal) : [];
  const download = result
    ? buildSavedAudit({ extract: result, diagnosis: findings, redesign: proposal }, bpmnXml)
    : null;

  const retryButton = (
    <button
      type="button"
      className={BUTTON}
      disabled={!hasKey || diagnosis.status === "running"}
      onClick={retryDiagnosis}
    >
      Retry diagnosis
    </button>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg">AI Process Auditor</h1>
        <p className="text-xs text-muted">
          Describe a business process in plain language. Get its steps, waiting
          time, flow efficiency, bottlenecks, waste, a process diagram and a
          redesign.
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
        onOpen={openSaved}
        busy={busy}
        hasKey={hasKey}
      />

      {problem ? (
        <section className="flex flex-col gap-1 border border-accent p-4">
          <h2 className="text-[11px] uppercase tracking-wider text-accent">{problem.title}</h2>
          <ul className="flex flex-col gap-0.5">
            {problem.lines.map((line, i) => (
              <li key={i} className="font-mono text-xs">
                {line}
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

          {diagnosis.status === "idle" && !busy ? (
            <section className="flex flex-col gap-2 border border-border bg-surface p-4">
              <p className="text-xs text-muted">
                This result has no bottlenecks or waste yet.
              </p>
              <button type="button" className={BUTTON} disabled={!hasKey} onClick={retryDiagnosis}>
                Find bottlenecks and waste
              </button>
              {hasKey ? null : (
                <p className="text-xs text-muted">Enter an API key above first.</p>
              )}
            </section>
          ) : null}

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

          {findings ? (
            <div className="flex flex-col gap-6 border-t border-border pt-6">
              {proposal ? null : (
                <section className="flex flex-col gap-2">
                  <h2 className="text-[11px] uppercase tracking-wider text-muted">Redesign</h2>
                  {hasFindings ? (
                    <>
                      <p className="max-w-prose text-sm">
                        Have the model propose changes that tackle these
                        bottlenecks and waste, and compare the process before
                        and after.
                      </p>
                      <p className="text-xs text-muted">
                        Uses one more request. On the free model this can take
                        a couple of minutes.
                      </p>
                      <button
                        type="button"
                        className={BUTTON}
                        disabled={!hasKey || redesign.status === "running"}
                        onClick={proposeRedesign}
                      >
                        {redesign.status === "running"
                          ? "Proposing a redesign…"
                          : redesign.status === "failed"
                            ? "Try again"
                            : "Propose a redesign"}
                      </button>
                      {hasKey ? null : (
                        <p className="text-xs text-muted">
                          Enter an API key above to propose a redesign.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted">
                      No bottlenecks or waste were found, so there is nothing to
                      redesign.
                    </p>
                  )}
                </section>
              )}

              {redesign.status === "failed" ? (
                <section className="flex flex-col gap-2 border border-accent p-4">
                  <h2 className="text-[11px] uppercase tracking-wider text-accent">
                    Redesign not produced
                  </h2>
                  <ul className="flex flex-col gap-0.5">
                    {redesign.errors.map((error, i) => (
                      <li key={i} className="font-mono text-xs">
                        {error}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted">
                    Everything above is unaffected. Free models fail at this
                    about one time in three; trying again may work, or put a
                    paid model in the Model field above.
                  </p>
                </section>
              ) : null}

              {proposalWarnings.length > 0 ? (
                <section className="flex flex-col gap-2 border border-accent p-4">
                  <h2 className="text-[11px] uppercase tracking-wider text-accent">
                    Check this redesign
                  </h2>
                  <ul className="flex flex-col gap-1">
                    {proposalWarnings.map((w) => (
                      <li key={w.code} className="text-sm">
                        {w.message}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={!hasKey}
                    onClick={proposeRedesign}
                  >
                    Propose another redesign
                  </button>
                </section>
              ) : null}

              {proposal ? (
                <>
                  <RedesignPanel before={result.metrics} redesign={proposal} />
                  <ProcessDiagram
                    steps={proposal.steps}
                    title="Redesigned process · BPMN"
                    caption={REDESIGN_CAPTION}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
