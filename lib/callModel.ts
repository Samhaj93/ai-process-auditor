// The only file in the codebase that knows a model provider exists.
// Server-side only. The key arrives per-request from the client and is never stored.

export type ProviderId = "anthropic" | "xai" | "openai";

interface ProviderConfig {
  label: string;
  baseUrl: string;
  defaultModel: string;
  keyPrefix: string;      // for a cheap client-side sanity check only
  keyUrl: string;         // where the user gets a key
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  anthropic: {
    label: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  xai: {
    label: "Grok",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.3",
    keyPrefix: "xai-",
    keyUrl: "https://console.x.ai",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
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
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ModelError";
  }
}

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
          // xAI and OpenAI share the chat-completions shape
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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ModelError(`Could not reach ${cfg.label}`);
  }

  if (!res.ok) {
    // Deliberately does not echo the response body — it can contain the key.
    const hint =
      res.status === 401 ? "key rejected" : res.status === 429 ? "rate limited" : "request failed";
    throw new ModelError(`${cfg.label}: ${hint}`, res.status);
  }

  const data = await res.json();

  const text: string =
    opts.provider === "anthropic"
      ? (data.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("")
      : (data.choices?.[0]?.message?.content ?? "");

  return parseJson<T>(text, cfg.label);
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
