import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ModelError, PROVIDERS, callModel } from "../lib/callModel.ts";

const SECRET = "sk-or-v1-THIS-MUST-NEVER-APPEAR-IN-AN-ERROR";

const base = {
  provider: "openrouter" as const,
  apiKey: SECRET,
  system: "s",
  user: "u",
};

/** Queue of canned responses, consumed one per fetch call. */
function stubFetch(queue: Array<{ status?: number; content?: string }>) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const next = queue[Math.min(calls, queue.length - 1)];
    calls++;
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({
        choices: [{ message: { content: next.content ?? "" } }],
        error: { message: `upstream said ${SECRET}` },
      }),
    } as unknown as Response;
  }) as typeof fetch;
  return () => calls;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("callModel", () => {
  it("returns parsed JSON on a clean response", async () => {
    stubFetch([{ content: '{"steps":[]}' }]);
    const out = await callModel<{ steps: unknown[] }>(base);
    assert.deepEqual(out, { steps: [] });
  });

  it("strips markdown fences the model wraps around JSON", async () => {
    stubFetch([{ content: '```json\n{"ok":true}\n```' }]);
    assert.deepEqual(await callModel(base), { ok: true });
  });

  it("retries an empty response and succeeds on the next attempt", async () => {
    const calls = stubFetch([{ content: "" }, { content: '{"steps":[1]}' }]);
    const out = await callModel<{ steps: number[] }>(base);
    assert.deepEqual(out, { steps: [1] });
    assert.equal(calls(), 2);
  });

  it("gives up after three empty responses, and says so", async () => {
    const calls = stubFetch([{ content: "" }]);
    await assert.rejects(
      () => callModel(base),
      (err: ModelError) => {
        assert.ok(err instanceof ModelError);
        assert.match(err.message, /empty response after 3 attempts/);
        return true;
      },
    );
    assert.equal(calls(), 3);
  });

  it("retries a 429 rather than failing immediately", async () => {
    const calls = stubFetch([{ status: 429 }, { content: '{"ok":1}' }]);
    assert.deepEqual(await callModel(base), { ok: 1 });
    assert.equal(calls(), 2);
  });

  it("reports a rejected key without leaking it", async () => {
    stubFetch([{ status: 401 }]);
    await assert.rejects(
      () => callModel(base),
      (err: ModelError) => {
        assert.match(err.message, /key rejected/);
        assert.ok(!err.message.includes(SECRET));
        assert.equal(err.status, 401);
        return true;
      },
    );
  });

  it("never puts the key in an error, even when upstream echoes it", async () => {
    for (const status of [400, 402, 429, 500]) {
      stubFetch([{ status }]);
      await assert.rejects(
        () => callModel(base),
        (err: ModelError) => !err.message.includes(SECRET),
      );
    }
  });

  it("surfaces a timeout as our own error, not a silent hang", async () => {
    globalThis.fetch = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch;
    await assert.rejects(
      () => callModel(base),
      (err: ModelError) => {
        assert.match(err.message, /timed out after 50s/);
        return true;
      },
    );
  });

  it("rejects a missing key before making any request", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error("should not be reached");
    }) as typeof fetch;
    await assert.rejects(() => callModel({ ...base, apiKey: "" }), /No API key/);
    assert.equal(called, false);
  });

  it("fails on unparseable output rather than returning something wrong", async () => {
    stubFetch([{ content: "I think the process has four steps." }]);
    await assert.rejects(() => callModel(base), /returned no JSON/);
  });
});

describe("provider registry", () => {
  it("every provider has the fields the UI reads", () => {
    for (const [id, cfg] of Object.entries(PROVIDERS)) {
      for (const field of ["label", "baseUrl", "defaultModel", "keyPrefix", "keyUrl", "hint"]) {
        assert.ok(
          cfg[field as keyof typeof cfg]?.length > 0,
          `${id}.${field} is empty`,
        );
      }
      assert.ok(cfg.baseUrl.startsWith("https://"), `${id} is not https`);
    }
  });
});
