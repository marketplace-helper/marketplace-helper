import { test } from "node:test";
import assert from "node:assert/strict";
import { signState, verifyState } from "../../src/services/ml/oauthState.js";
import { signToken } from "../../src/config/jwt.js";

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

test("ida e volta preserva userId, nonce e client", () => {
  const s = signState({ userId: 7, nonce: "abc", client: "mobile" });
  assert.deepEqual(pick(verifyState(s), ["userId", "nonce", "client"]), { userId: 7, nonce: "abc", client: "mobile" });
});

test("state adulterado retorna null", () => {
  const s = signState({ userId: 7, nonce: "abc", client: "web" });
  assert.equal(verifyState(s.slice(0, -2) + "xx"), null);
});

test("JWT de login da API não vale como state", () => {
  assert.equal(verifyState(signToken(7)), null);
});

test("state expirado retorna null", { timeout: 2000 }, (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const s = signState({ userId: 7, nonce: "abc", client: "web" });
  t.mock.timers.tick(11 * 60 * 1000);
  assert.equal(verifyState(s), null);
});
