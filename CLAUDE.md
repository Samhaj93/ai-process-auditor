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
3. **Model** — steps in, BPMN 2.0 XML out. **Built in code, not by a model.** `lib/bpmn.ts` generates the XML, `bpmn-auto-layout` positions it in the browser, `bpmn-js` draws it. The steps already hold the order, rework loops and actors, so the diagram is deterministic, instant, and spends none of the free daily requests. Do not move this to a model call.
4. **Redesign** — everything above in, `redesign` out. The model returns the changes and the complete redesigned steps, never figures. The route computes `projectedMetrics` from those steps with `computeMetrics`, so before and after use the same arithmetic. `redesignProposalSchemaFor` validates the proposal and requires every change to target a current step. It runs only when the user presses a button: it costs a request and takes one to three minutes on the free model.

Each stage is independently callable and independently testable. Stages 2 and 3 can run in parallel. Stage 1 must succeed before anything else runs.

Stage 3 constraints:
- `bpmn-auto-layout` 1.3.0 silently drops lane and pool shapes, so each task's label carries its actor instead of a swimlane. Its README documents a newer API returning `{ xml, warnings }`; 1.3.0 returns the XML string. `types/bpmn-auto-layout.d.ts` declares what is installed.
- `bpmn-js`'s licence requires the bpmn.io watermark on the canvas to stay fully visible. Never hide it or place anything over it.

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

Next.js (App Router) · TypeScript · Tailwind · `zod` for runtime schema validation · `bpmn-js` for BPMN rendering · `bpmn-auto-layout` for BPMN layout · run locally by each user with `npm run dev`. There is no hosted deployment, so there is no serverless time limit to design around.

Do not add a database, auth, or state library until explicitly asked. A completed audit lives in React state, can be downloaded as JSON, and can be opened again from that file. `lib/savedAudit.ts` owns the file format. An opened file is untrusted: it passes the same validation as a model response, and every figure is recomputed from its steps.

## Working conventions

- Build vertical slices. One stage working end-to-end beats four stages half-built.
- Commit after each slice that runs. Small commits, plain messages.
- When a model response fails schema validation, surface the validation error to the user — never silently coerce or fill defaults.
- Prefer deleting code to adding flags.
- Don't add features, dependencies, or abstractions that weren't asked for. Propose them instead and wait. Approved exceptions: `zod`, the mechanism that enforces the validation rule above, which TypeScript types alone cannot since they are erased at runtime; and `bpmn-js` with `bpmn-auto-layout`, which draw and lay out the stage 3 diagram.
- Schemas in `lib/schema.ts` are the source of truth; types are derived with `z.infer`. Never derive a schema from a refined one with `.pick()` or `.omit()` — on zod 4 that compiles and silently drops the refinements. Export the narrower schema standalone instead, as `ProcessStepsSchema` is.

## Current state

All four stages work end to end. Stage 1 (`POST /api/extract`) turns prose into validated steps and flow efficiency. Stage 2 (`POST /api/diagnose`) turns those steps into bottlenecks and DOWNTIME waste, validated with `diagnoseResultSchemaFor` so every finding points at a real step and no step carries two bottlenecks. The UI starts stage 2 only once stage 1 is on screen; a failed diagnosis shows a retry and never hides the steps. Stage 3 draws the BPMN diagram in the browser straight from the steps, with no request, and outlines bottlenecks once stage 2 returns. Stage 4 (`POST /api/redesign`) runs when the user asks, and shows before and after side by side, the changes, and a diagram of the redesigned process. Default provider is OpenRouter on a free model.

Request handling shared by stage routes lives in `lib/routeInput.ts`. Add new stage routes through it rather than re-validating provider fields by hand.

## Cost constraint — strictly free

The project stays free to run. Do not change the default to a paid model or add anything that needs one.

Known consequences:

- Free models sometimes return valid JSON with every wait time set to zero, which reads as 100% flow efficiency. The schema cannot catch this — it checks shape, not sense. `lib/quality.ts` flags it, and the UI tells the user that a paid model, entered in the Model field, gives better results.
- Stage 2 fails on the free model more often than stage 1: empty or unreadable responses, invented enum values, and findings that double-count the same minutes. That is why diagnosis has its own retry and its own plausibility checks. `callModel` retries empty and unreadable responses automatically, up to three attempts; output that parses but breaks the schema is reported, never retried silently. Its output limit is not the problem: measured stage 2 runs used under half of 8,000 tokens, including hidden reasoning, and none were cut off. Do not raise it for stage 2 without new evidence.
- A single free diagnosis has taken over 40 seconds. `callModel` allows 120 seconds per attempt and up to three attempts, so in the worst case a user waits several minutes before seeing an error.
- Stage 4 fails on the free model about one attempt in three, and a successful attempt takes one to three minutes. Hidden reasoning counts against `max_tokens`: one measured redesign spent 4,555 of 8,000 tokens reasoning, so the redesign route asks for 16,000 to stop its JSON being cut off. Free redesigns can also be very optimistic; `redesignWarnings` only catches figures that cannot be true, not hopeful ones.
- Free OpenRouter keys are capped at 50 requests a day. An analysis makes two, a redesign one more, and retries count too: roughly 16 analyses with redesigns, or 25 without.

## Framework notes

@AGENTS.md
