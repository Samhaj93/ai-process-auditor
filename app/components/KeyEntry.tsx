"use client";

import { PROVIDERS, type ProviderId } from "@/lib/callModel";

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

const FIELD =
  "border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground";

export function KeyEntry({
  provider,
  apiKey,
  model,
  onProvider,
  onApiKey,
  onModel,
}: {
  provider: ProviderId;
  apiKey: string;
  model: string;
  onProvider: (p: ProviderId) => void;
  onApiKey: (k: string) => void;
  onModel: (m: string) => void;
}) {
  const cfg = PROVIDERS[provider];
  const looksWrong = apiKey.length > 0 && !apiKey.startsWith(cfg.keyPrefix);

  return (
    <section className="flex flex-col gap-3 border border-border bg-surface p-4">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">Provider</h2>

      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Service
          </span>
          <select
            className={FIELD}
            value={provider}
            onChange={(e) => onProvider(e.target.value as ProviderId)}
          >
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            API key
          </span>
          <input
            className={FIELD}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={`${cfg.keyPrefix}…`}
            value={apiKey}
            onChange={(e) => onApiKey(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wider text-muted">
          Model
        </span>
        <input
          className={`${FIELD} font-mono text-xs`}
          spellCheck={false}
          placeholder={cfg.defaultModel}
          value={model}
          onChange={(e) => onModel(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1 text-xs text-muted">
        <p>
          {cfg.hint}{" "}
          <a
            className="underline underline-offset-2"
            href={cfg.keyUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Get a key
          </a>
        </p>
        <p>
          Your key is held in this browser tab only, sent with each analysis and
          never stored on the server. Your description is sent to {cfg.label}.
        </p>
        {looksWrong ? (
          <p className="text-accent">
            That does not look like a {cfg.label} key — they usually start{" "}
            <span className="font-mono">{cfg.keyPrefix}</span>.
          </p>
        ) : null}
      </div>
    </section>
  );
}
