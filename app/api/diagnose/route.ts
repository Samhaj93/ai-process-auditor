import { callModel, ModelError } from "@/lib/callModel";
import { MAX_STEPS } from "@/lib/limits";
import { DIAGNOSE_SYSTEM, diagnoseUserPrompt } from "@/lib/prompts/diagnose";
import { errorResponse, readJsonObject, readProviderInput } from "@/lib/routeInput";
import {
  ProcessStepsSchema,
  diagnoseResultSchemaFor,
  formatIssues,
  type DiagnoseResult,
} from "@/lib/schema";

export async function POST(request: Request) {
  const payload = await readJsonObject(request);
  if (!payload) return errorResponse(["Request body must be a JSON object."]);

  // The steps come from the browser, so they are validated again here rather
  // than trusted because stage 1 produced them.
  if (Array.isArray(payload.steps) && payload.steps.length > MAX_STEPS) {
    return errorResponse([`Too many steps — ${payload.steps.length}, maximum ${MAX_STEPS}.`]);
  }
  const steps = ProcessStepsSchema.safeParse(payload.steps);
  if (!steps.success) {
    return errorResponse([
      "The steps sent for diagnosis are not valid:",
      ...formatIssues(steps.error),
    ]);
  }

  const input = readProviderInput(payload);
  if (!input.ok) return errorResponse([input.error]);

  let raw: unknown;
  try {
    raw = await callModel<unknown>({
      ...input.value,
      system: DIAGNOSE_SYSTEM,
      user: diagnoseUserPrompt(steps.data),
    });
  } catch (err) {
    // ModelError messages are written to never contain the key.
    const message = err instanceof ModelError ? err.message : "The diagnosis failed.";
    return errorResponse([message], 502);
  }

  const parsed = diagnoseResultSchemaFor(steps.data).safeParse(raw);
  if (!parsed.success) {
    // Surfaced verbatim. Never coerced, never defaulted.
    return errorResponse([
      "The model returned findings that do not match the schema:",
      ...formatIssues(parsed.error),
    ]);
  }

  const result: DiagnoseResult = parsed.data;
  return Response.json(result);
}
