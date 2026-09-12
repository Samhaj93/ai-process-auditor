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

Supported providers use OpenAI-compatible chat completions. Adding one means adding a base URL and a model string to the registry — no new code paths.

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

Next.js (App Router) · TypeScript · Tailwind · `bpmn-js` for BPMN rendering · deployed on Vercel.

Do not add a database, auth, or state library until explicitly asked. A completed audit lives in React state and can be downloaded as JSON.

## Working conventions

- Build vertical slices. One stage working end-to-end beats four stages half-built.
- Commit after each slice that runs. Small commits, plain messages.
- When a model response fails schema validation, surface the validation error to the user — never silently coerce or fill defaults.
- Prefer deleting code to adding flags.
- Don't add features, dependencies, or abstractions that weren't asked for. Propose them instead and wait.

## Current state

Scaffold stage. Nothing built yet. Next step: stage 1 (extract) end-to-end with the UI rendering only the step table and flow efficiency.

## Framework notes

@AGENTS.md
