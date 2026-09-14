# AI Process Auditor

## What this is

A web app that takes a plain-language description of a business process and returns a structured audit: bottlenecks, Lean waste categorisation, a BPMN model, and a redesign proposal.

Input is messy prose. Output is a dashboard. Everything in between is one JSON object.

## The one rule that governs the architecture

**Analysis produces JSON. The UI only renders JSON.**

The model's single job is to return an object matching `ProcessAudit` in `lib/schema.ts`. It does not produce HTML, charts, markdown, or prose for display. The UI never calls a model — it receives a `ProcessAudit` and draws it.

Consequences:
- The UI can be built and tested with a fixture file, no API key needed.
- Any provider can be swapped in without touching a component.
- A slow or failed analysis never blocks rendering.

If a change would make a component call a model, or make the model emit display markup, reject it and propose the alternative.

## Credentials — non-negotiable

This repo is public on GitHub.

- No API key is ever committed, hardcoded, or placed in a default value.
- The project has **no server-owned key**. It is bring-your-own-key (BYOK): the user supplies their own.
- The key is held in `sessionStorage` on the client, sent per-request to the server route, used once, and discarded.
- Never log, persist, cache, or include the key in error messages or telemetry.
- `.env.local` stays in `.gitignore`. `.env.example` is committed with empty values only.

## Provider-agnostic by design

All model access goes through one function: `callModel()` in `lib/callModel.ts`. Nothing else in the codebase imports a provider SDK or knows a provider exists.

Most supported providers use OpenAI-compatible chat completions; adding one means adding a base URL and a model string to the registry — no new code paths. Anthropic is the exception and has its own request/response branch inside `callModel()`, because its Messages API is not OpenAI-compatible. Keep exceptions inside that one function; a second provider-aware file is a bug.

## The audit pipeline

Four stages, run as separate calls, not one mega-prompt:

1. **Extract** — prose in, `steps[]` and `metrics` out. Normalises the process into discrete steps with actor, duration, wait time, systems.
2. **Diagnose** — steps in, `bottlenecks[]` and `wastes[]` out.
3. **Model** — steps in, BPMN 2.0 XML out.
4. **Redesign** — everything above in, `redesign` out.

Each stage is independently callable and independently testable. Stages 2 and 3 can run in parallel. Stage 1 must succeed before anything else runs.

This split exists because single monolithic calls time out and fail opaquely. Do not merge stages to "simplify."

## Domain vocabulary — use these terms exactly

- **Lead time** — clock time from step start to finish, including waiting.
- **Process time** — hands-on working time only.
- **Flow efficiency** — process time / lead time. The headline metric.
- **Value classification** — every step is `value-add`, `business-non-value-add`, or `non-value-add`.
- **Wastes** — the eight DOWNTIME categories: defects, overproduction, waiting, non-utilised talent, transportation, inventory, motion, extra-processing. Use these exact keys; do not invent categories.

## Design language

Celonis-referenced: dense, data-forward, calm. The screen is an instrument panel, not a marketing page.

- Neutral surfaces. One accent colour, used only to mark severity or delta.
- Numbers are the largest elements. Labels are small and quiet.
- No gradients, shadows, rounded-everything, illustrations, or hero sections.
- Bottlenecks are marked on the process view itself, not in a separate list.
- Before/after comparison is side-by-side with the delta computed and shown, not left to the reader.

## Stack

Next.js (App Router) · TypeScript · Tailwind · `zod` for runtime schema validation · `bpmn-js` for BPMN rendering · deployed on Vercel.

Do not add a database, auth, or state library until explicitly asked. A completed audit lives in React state and can be downloaded as JSON.

## Working conventions

- Build vertical slices. One stage working end-to-end beats four stages half-built.
- Commit after each slice that runs. Small commits, plain messages.
- When a model response fails schema validation, surface the validation error to the user — never silently coerce or fill defaults.
- Prefer deleting code to adding flags.
- Don't add features, dependencies, or abstractions that weren't asked for. Propose them instead and wait. `zod` is an approved exception: it is the mechanism that enforces the validation rule above, and TypeScript types alone cannot, since they are erased at runtime.
- Schemas in `lib/schema.ts` are the source of truth; types are derived with `z.infer`. Never derive a schema from a refined one with `.pick()` or `.omit()` — on zod 4 that compiles and silently drops the refinements. Export the narrower schema standalone instead, as `ProcessStepsSchema` is.

## Current state

Stages 1 and 2 work end to end. Stage 1 (`POST /api/extract`) turns prose into validated steps and flow efficiency. Stage 2 (`POST /api/diagnose`) turns those steps into bottlenecks and DOWNTIME waste, validated with `diagnoseResultSchemaFor` so every finding points at a real step and no step carries two bottlenecks. The UI starts stage 2 only once stage 1 is on screen; a failed diagnosis shows a retry and never hides the steps. Default provider is OpenRouter on a free model. Stages 3–4 not started.

Request handling shared by stage routes lives in `lib/routeInput.ts`. Add new stage routes through it rather than re-validating provider fields by hand.

## Cost constraint — strictly free

The project stays free to run. Do not change the default to a paid model or add anything that needs one.

Known consequences:

- Free models sometimes return valid JSON with every wait time set to zero, which reads as 100% flow efficiency. The schema cannot catch this — it checks shape, not sense. `lib/quality.ts` flags it, and the UI tells the user that a paid model, entered in the Model field, gives better results.
- Stage 2 fails on the free model far more often than stage 1: empty responses, invented enum values, and findings that double-count the same minutes. That is why diagnosis has its own retry and its own plausibility checks.
- A single free diagnosis has taken over 40 seconds, against `callModel`'s 50-second per-attempt timeout. That timeout was set for Vercel's 60-second function limit.
- Free OpenRouter keys are capped at 50 requests a day. A full analysis makes two, more with retries, so roughly 25 analyses.

## Framework notes

@AGENTS.md
