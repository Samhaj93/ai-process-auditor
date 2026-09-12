// The only file in the codebase that knows a model provider exists.
// Server-side only. The key arrives per-request from the client and is never stored.

export type ProviderId = "openrouter" | "anthropic" | "xai" | "openai";

interface ProviderConfig {
  label: string;
  baseUrl: string;
  defaultModel: string;
  keyPrefix: string; // for a cheap client-side sanity check only
  keyUrl: string; // where the user gets a key
  hint: string; // shown in the UI next to the key field
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    // Verified against the live API: returns schema-valid extractions in
    // well under a second. Free models require the "allow training on my
    // inputs" setting on the OpenRouter account.
    defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    hint: "One key, most models. The default model is free but its provider may train on what you send.",
  },
  anthropic: {
    label: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-5", // untested here: no direct Anthropic key available
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    hint: "A Console API key, billed separately. A Claude.ai Pro or Max subscription does not include one.",
  },
  xai: {
    label: "Grok",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.6", // untested here: no direct xAI key available
    keyPrefix: "xai-",
    keyUrl: "https://console.x.ai",
    hint: "A direct xAI key. These models are also reachable through OpenRouter.",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6-luna", // untested here: no direct OpenAI key available
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    hint: "A direct OpenAI key. These models are also reachable through OpenRouter.",
  },
};

export interface CallOptions {
  provider: ProviderId;
  apiKey: string;
  model?: string;
  system: string;
  user: string;
  maxTokens?: number;
}

export class ModelError extends Error {
  // Declared explicitly rather than as a constructor parameter property, so the
  // module runs under Node's type stripping and can be unit tested directly.
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModelError";
    this.status = status;
  }
}

/** Under the route's maxDuration, so a hang is our error rather than a platform 504. */
const TIMEOUT_MS = 50_000;

/**
 * Free endpoints intermittently return an empty body or a 429 with nothing
 * generated. Both are transient and safe to repeat — the request is a pure
 * function of its input, so a retry cannot duplicate any side effect.
 * Measured: ~33% empty rate on the default free model, which three attempts
 * takes to roughly 1 in 30.
 */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 600;

/**
 * Calls the provider and returns parsed JSON of type T.
 * Throws ModelError on transport failure or unparseable output.
 * Never logs the key. Never includes the key in a thrown message.
 */
export async function callModel<T>(opts: CallOptions): Promise<T> {
  const cfg = PROVIDERS[opts.provider];
  if (!cfg) throw new ModelError(`Unknown provider: ${opts.provider}`);
  if (!opts.apiKey) throw new ModelError("No API key supplied");

  const model = opts.model ?? cfg.defaultModel;
  const maxTokens = opts.maxTokens ?? 8000;

  const { url, headers, body } =
    opts.provider === "anthropic"
      ? {
          url: `${cfg.baseUrl}/messages`,
          headers: {
            "content-type": "application/json",
            "x-api-key": opts.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: {
            model,
            max_tokens: maxTokens,
            system: opts.system,
            messages: [{ role: "user", content: opts.user }],
          },
        }
      : {
          // OpenRouter, xAI and OpenAI share the chat-completions shape
          url: `${cfg.baseUrl}/chat/completions`,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${opts.apiKey}`,
          },
          body: {
            model,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: opts.system },
              { role: "user", content: opts.user },
            ],
          },
        };

  let lastProblem = "no response";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new ModelError(`${cfg.label} timed out after ${TIMEOUT_MS / 1000}s`);
      }
      throw new ModelError(`Could not reach ${cfg.label}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Deliberately does not echo the response body — it can contain the key.
      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        lastProblem = "rate limited";
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }
      const hint =
        res.status === 401
          ? "key rejected"
          : res.status === 429
            ? "rate limited — free models are shared and capped per day. Wait a little, or add credit to raise the cap"
            : res.status === 402
              ? "out of credit"
              : "request failed";
      throw new ModelError(`${cfg.label}: ${hint}`, res.status);
    }

    const data = await res.json().catch(() => null);

    const text: string =
      opts.provider === "anthropic"
        ? ((data?.content ?? []) as { type: string; text: string }[])
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("")
        : (data?.choices?.[0]?.message?.content ?? "");

    if (!text.trim()) {
      lastProblem = "returned an empty response";
      if (attempt < MAX_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new ModelError(`${cfg.label} ${lastProblem} after ${MAX_ATTEMPTS} attempts`);
    }

    return parseJson<T>(text, cfg.label);
  }

  throw new ModelError(`${cfg.label} ${lastProblem} after ${MAX_ATTEMPTS} attempts`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Models sometimes wrap JSON in prose or fences. Strip and parse strictly. */
function parseJson<T>(text: string, label: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start === -1 || end === -1) {
    throw new ModelError(`${label} returned no JSON`);
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    throw new ModelError(`${label} returned malformed JSON`);
  }
}
