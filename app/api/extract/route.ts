import { callModel, ModelError } from "@/lib/callModel";
import { MAX_PROSE_CHARS, MIN_PROSE_CHARS } from "@/lib/limits";
import { EXTRACT_SYSTEM, extractUserPrompt } from "@/lib/prompts/extract";
import { errorResponse, readJsonObject, readProviderInput } from "@/lib/routeInput";
import {
  ProcessStepsSchema,
  computeMetrics,
  formatIssues,
  type ExtractResult,
} from "@/lib/schema";

/** Node functions default to 10s. Extraction on real prose can exceed that. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const payload = await readJsonObject(request);
  if (!payload) return errorResponse(["Request body must be a JSON object."]);

  // Input gates run before any provider call, so a bad request costs nothing.
  const { prose } = payload;
  if (typeof prose !== "string") return errorResponse(["No process description supplied."]);
  const trimmed = prose.trim();
  if (trimmed.length < MIN_PROSE_CHARS) {
    return errorResponse([
      `Description is too short — ${trimmed.length} characters, minimum ${MIN_PROSE_CHARS}.`,
    ]);
  }
  if (trimmed.length > MAX_PROSE_CHARS) {
    return errorResponse([
      `Description is too long — ${trimmed.length.toLocaleString()} characters, maximum ${MAX_PROSE_CHARS.toLocaleString()}.`,
    ]);
  }

  const input = readProviderInput(payload);
  if (!input.ok) return errorResponse([input.error]);

  let raw: unknown;
  try {
    raw = await callModel<unknown>({
      ...input.value,
      system: EXTRACT_SYSTEM,
      user: extractUserPrompt(trimmed),
    });
  } catch (err) {
    // ModelError messages are written to never contain the key.
    const message = err instanceof ModelError ? err.message : "The analysis failed.";
    return errorResponse([message], 502);
  }

  const steps = (raw as { steps?: unknown } | null)?.steps;
  const parsed = ProcessStepsSchema.safeParse(steps);
  if (!parsed.success) {
    // Surfaced verbatim. Never coerced, never defaulted.
    return errorResponse([
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
