import { callModel, ModelError } from "@/lib/callModel";
import { MAX_STEPS } from "@/lib/limits";
import { REDESIGN_SYSTEM, redesignUserPrompt } from "@/lib/prompts/redesign";
import { errorResponse, readJsonObject, readProviderInput } from "@/lib/routeInput";
import {
  ProcessStepsSchema,
  computeMetrics,
  diagnoseResultSchemaFor,
  formatIssues,
  redesignProposalSchemaFor,
  type Redesign,
} from "@/lib/schema";

export async function POST(request: Request) {
  const payload = await readJsonObject(request);
  if (!payload) return errorResponse(["Request body must be a JSON object."]);

  // Steps and findings come from the browser, so both are validated again here
  // rather than trusted because earlier stages produced them.
  if (Array.isArray(payload.steps) && payload.steps.length > MAX_STEPS) {
    return errorResponse([`Too many steps — ${payload.steps.length}, maximum ${MAX_STEPS}.`]);
  }
  const steps = ProcessStepsSchema.safeParse(payload.steps);
  if (!steps.success) {
    return errorResponse([
      "The steps sent for redesign are not valid:",
      ...formatIssues(steps.error),
    ]);
  }

  const findings = diagnoseResultSchemaFor(steps.data).safeParse({
    bottlenecks: payload.bottlenecks,
    wastes: payload.wastes,
  });
  if (!findings.success) {
    return errorResponse([
      "The findings sent for redesign are not valid:",
      ...formatIssues(findings.error),
    ]);
  }
  // Every proposed change must answer a finding, so with none there is nothing to do.
  if (findings.data.bottlenecks.length === 0 && findings.data.wastes.length === 0) {
    return errorResponse(["Nothing to redesign: no bottlenecks or waste were found."]);
  }

  const input = readProviderInput(payload);
  if (!input.ok) return errorResponse([input.error]);

  let raw: unknown;
  try {
    raw = await callModel<unknown>({
      ...input.value,
      system: REDESIGN_SYSTEM,
      user: redesignUserPrompt(steps.data, findings.data),
      // Hidden reasoning counts against this limit. A measured free redesign
      // spent 4,555 of 8,000 tokens reasoning before writing its JSON, so the
      // default leaves too little room: a longer think cuts the JSON off
      // mid-object, which surfaces as "malformed JSON".
      maxTokens: 16_000,
    });
  } catch (err) {
    // ModelError messages are written to never contain the key.
    const message = err instanceof ModelError ? err.message : "The redesign failed.";
    return errorResponse([message], 502);
  }

  const proposal = redesignProposalSchemaFor(steps.data).safeParse(raw);
  if (!proposal.success) {
    // Surfaced verbatim. Never coerced, never defaulted.
    return errorResponse([
      "The model returned a redesign that does not match the schema:",
      ...formatIssues(proposal.error),
    ]);
  }

  // The model proposes the steps. The figures are always computed from them.
  const result: Redesign = {
    ...proposal.data,
    projectedMetrics: computeMetrics(proposal.data.steps),
  };
  return Response.json(result);
}
