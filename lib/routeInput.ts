// Request handling shared by every stage route: the body, the provider fields,
// and the error shape the UI renders.

import { PROVIDERS, type ProviderId } from "./callModel.ts";

export function errorResponse(errors: string[], status = 400): Response {
  return Response.json({ errors }, { status });
}

/** The parsed body if it is a JSON object, otherwise null. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface ProviderInput {
  provider: ProviderId;
  apiKey: string;
  model: string | undefined;
}

export function readProviderInput(
  payload: Record<string, unknown>,
): { ok: true; value: ProviderInput } | { ok: false; error: string } {
  const { provider, apiKey, model } = payload;
  // Object.hasOwn, not `in`: `"toString" in PROVIDERS` is true.
  if (typeof provider !== "string" || !Object.hasOwn(PROVIDERS, provider)) {
    return { ok: false, error: "Unknown provider." };
  }
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return { ok: false, error: "No API key supplied." };
  }
  if (model !== undefined && typeof model !== "string") {
    return { ok: false, error: "Model must be a string." };
  }
  return {
    ok: true,
    value: {
      provider: provider as ProviderId,
      apiKey,
      model: model?.trim() ? model.trim() : undefined,
    },
  };
}
