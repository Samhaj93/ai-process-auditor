import { callModel, ModelError, PROVIDERS, type ProviderId } from "@/lib/callModel";
import { MAX_PROSE_CHARS, MIN_PROSE_CHARS } from "@/lib/limits";
import { EXTRACT_SYSTEM, extractUserPrompt } from "@/lib/prompts/extract";
import {
  ProcessStepsSchema,
  computeMetrics,
  formatIssues,
  type ExtractResult,
} from "@/lib/schema";

/** Node functions default to 10s. Extraction on real prose can exceed that. */
export const maxDuration = 60;

interface ExtractRequest {
  prose?: unknown;
  provider?: unknown;
  apiKey?: unknown;
  model?: unknown;
}

function bad(errors: string[], status = 400) {
  return Response.json({ errors }, { status });
}

export async function POST(request: Request) {
  let payload: ExtractRequest;
  try {
    payload = await request.json();
  } catch {
    return bad(["Request body was not valid JSON."]);
  }

  const { prose, provider, apiKey, model } = payload;

  // Input gates run before any provider call, so a bad request costs nothing.
  if (typeof prose !== "string") return bad(["No process description supplied."]);
  const trimmed = prose.trim();
  if (trimmed.length < MIN_PROSE_CHARS) {
    return bad([
      `Description is too short — ${trimmed.length} characters, minimum ${MIN_PROSE_CHARS}.`,
    ]);
  }
  if (trimmed.length > MAX_PROSE_CHARS) {
    return bad([
      `Description is too long — ${trimmed.length.toLocaleString()} characters, maximum ${MAX_PROSE_CHARS.toLocaleString()}.`,
    ]);
  }

  if (typeof provider !== "string" || !(provider in PROVIDERS)) {
    return bad(["Unknown provider."]);
  }
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return bad(["No API key supplied."]);
  }
  if (model !== undefined && typeof model !== "string") {
    return bad(["Model must be a string."]);
  }

  let raw: unknown;
  try {
    raw = await callModel<unknown>({
      provider: provider as ProviderId,
      apiKey,
      model: model?.trim() ? model.trim() : undefined,
      system: EXTRACT_SYSTEM,
      user: extractUserPrompt(trimmed),
    });
  } catch (err) {
    // ModelError messages are written to never contain the key.
    const message = err instanceof ModelError ? err.message : "The analysis failed.";
    return bad([message], 502);
  }

  const steps = (raw as { steps?: unknown } | null)?.steps;
  const parsed = ProcessStepsSchema.safeParse(steps);
  if (!parsed.success) {
    // Surfaced verbatim. Never coerced, never defaulted.
    return bad([
      "The model returned a process that does not match the schema:",
      ...formatIssues(parsed.error),
    ]);
  }

  const result: ExtractResult = {
    steps: parsed.data,
    metrics: computeMetrics(parsed.data),
  };
  return Response.json(result);
}
