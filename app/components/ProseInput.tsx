"use client";

import { MAX_PROSE_CHARS, MIN_PROSE_CHARS } from "@/lib/limits";

export function ProseInput({
  prose,
  onProse,
  onSubmit,
  onExample,
  busy,
  hasKey,
}: {
  prose: string;
  onProse: (v: string) => void;
  onSubmit: () => void;
  onExample: () => void;
  busy: boolean;
  hasKey: boolean;
}) {
  const length = prose.trim().length;
  const tooLong = length > MAX_PROSE_CHARS;
  const tooShort = length > 0 && length < MIN_PROSE_CHARS;

  const blocker = !hasKey
    ? "Enter an API key above to run an analysis."
    : length === 0
      ? "Describe the process to analyse."
      : tooShort
        ? `Too short — ${length} characters, minimum ${MIN_PROSE_CHARS}.`
        : tooLong
          ? `Too long — ${length.toLocaleString()} characters, maximum ${MAX_PROSE_CHARS.toLocaleString()}.`
          : null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted">
        Process description
      </h2>

      <textarea
        className="min-h-44 border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
        placeholder="Describe the process in plain language. Who does what, how long each part takes, and where things wait."
        spellCheck
        value={prose}
        onChange={(e) => onProse(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="border border-foreground px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-border disabled:text-muted"
          disabled={busy || blocker !== null}
          onClick={onSubmit}
        >
          {busy ? "Analysing…" : "Analyse"}
        </button>

        <button
          type="button"
          className="text-xs text-muted underline underline-offset-2 disabled:no-underline"
          disabled={busy}
          onClick={onExample}
        >
          Show worked example
        </button>

        <span
          className={`ml-auto text-xs tabular-nums ${tooLong ? "text-accent" : "text-muted"}`}
        >
          {length.toLocaleString()} / {MAX_PROSE_CHARS.toLocaleString()}
        </span>
      </div>

      {blocker ? <p className="text-xs text-muted">{blocker}</p> : null}
    </section>
  );
}
