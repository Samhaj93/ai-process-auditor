"use client";

import { useState } from "react";

import { FlowEfficiency } from "@/app/components/FlowEfficiency";
import { KeyEntry } from "@/app/components/KeyEntry";
import { ProseInput } from "@/app/components/ProseInput";
import { StepTable } from "@/app/components/StepTable";
import { PROVIDERS, type ProviderId } from "@/lib/callModel";
import { sampleExtract, sampleProcessName } from "@/lib/fixtures/sample-extract";
import type { ExtractResult } from "@/lib/schema";
import { useSessionState } from "@/lib/useSessionState";

const DEFAULT_PROVIDER: ProviderId = "openrouter";

function toProvider(value: string): ProviderId {
  return value in PROVIDERS ? (value as ProviderId) : DEFAULT_PROVIDER;
}

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

  function updateProvider(next: ProviderId) {
    setStoredProvider(next);
    setModel(""); // the previous model name means nothing to a different service
  }

  async function analyse() {
    setBusy(true);
    setErrors([]);
    setResult(null);
    setTitle(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prose, provider, apiKey, model }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrors(
          Array.isArray(data?.errors) ? data.errors : ["The analysis failed."],
        );
        return;
      }
      setResult(data as ExtractResult);
      setTitle("Your process");
    } catch {
      setErrors(["Could not reach the server."]);
    } finally {
      setBusy(false);
    }
  }

  function showExample() {
    setErrors([]);
    setResult(sampleExtract);
    setTitle(`${sampleProcessName} — worked example`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg">AI Process Auditor</h1>
        <p className="text-xs text-muted">
          Describe a business process in plain language. Get its steps, waiting
          time and flow efficiency.
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

      {result ? (
        <>
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <h2 className="text-lg">{title}</h2>
            <a
              className="text-xs text-muted underline underline-offset-2"
              download="process-audit.json"
              href={`data:application/json,${encodeURIComponent(
                JSON.stringify(result, null, 2),
              )}`}
            >
              Download JSON
            </a>
          </div>
          <FlowEfficiency metrics={result.metrics} />
          <StepTable steps={result.steps} />
        </>
      ) : null}
    </main>
  );
}
