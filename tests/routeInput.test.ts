import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readJsonObject, readProviderInput } from "../lib/routeInput.ts";

const post = (body: string) => new Request("http://local/api", { method: "POST", body });

describe("readJsonObject", () => {
  it("returns a JSON object", async () => {
    assert.deepEqual(await readJsonObject(post('{"a":1}')), { a: 1 });
  });

  for (const [label, body] of [
    ["malformed JSON", "{nope"],
    ["null", "null"],
    ["an array", "[1,2]"],
    ["a bare string", '"hello"'],
  ]) {
    it(`rejects ${label}`, async () => {
      assert.equal(await readJsonObject(post(body)), null);
    });
  }
});

describe("readProviderInput", () => {
  const base = { provider: "openrouter", apiKey: "sk-or-v1-x" };

  it("accepts a known provider and key", () => {
    assert.equal(readProviderInput(base).ok, true);
  });

  // `"toString" in PROVIDERS` is true, which is why the check uses Object.hasOwn.
  for (const provider of ["toString", "constructor", "__proto__", "skynet", 42]) {
    it(`rejects provider ${JSON.stringify(provider)}`, () => {
      assert.deepEqual(readProviderInput({ ...base, provider }), {
        ok: false,
        error: "Unknown provider.",
      });
    });
  }

  it("rejects a missing or empty key", () => {
    assert.equal(readProviderInput({ ...base, apiKey: "" }).ok, false);
    assert.equal(readProviderInput({ provider: "openrouter" }).ok, false);
  });

  it("rejects a model that is not a string", () => {
    assert.equal(readProviderInput({ ...base, model: 7 }).ok, false);
  });

  it("trims the model, and treats a blank one as the provider default", () => {
    const named = readProviderInput({ ...base, model: "  some/model  " });
    const blank = readProviderInput({ ...base, model: "   " });
    assert.ok(named.ok && named.value.model === "some/model");
    assert.ok(blank.ok && blank.value.model === undefined);
  });
});
