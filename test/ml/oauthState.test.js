import { test } from "node:test";
import assert from "node:assert/strict";
import { signState, verifyState } from "../../src/services/ml/oauthState.js";
import { signToken, verifyToken } from "../../src/config/jwt.js";

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

test("ida e volta preserva userId, nonce e client", () => {
  const s = signState({ userId: 7, nonce: "abc", client: "mobile" });
  assert.deepEqual(pick(verifyState(s), ["userId", "nonce", "client"]), { userId: 7, nonce: "abc", client: "mobile" });
});

test("state adulterado retorna null", () => {
  const s = signState({ userId: 7, nonce: "abc", client: "web" });
  const parts = s.split(".");
  const sig = parts[2];
  const mid = Math.floor(sig.length / 2);
  const flipped = sig[mid] === "A" ? "B" : "A";
  const tampered = [parts[0], parts[1], sig.slice(0, mid) + flipped + sig.slice(mid + 1)].join(".");
  assert.equal(verifyState(tampered), null);
});

test("JWT de login da API não vale como state", () => {
  assert.equal(verifyState(signToken(7)), null);
});

test("state de OAuth não serve como token de login da API", () => {
  assert.equal(verifyToken(signState({ userId: 7, nonce: "abc", client: "web" })), null);
});

test("token de login da API continua válido", () => {
  assert.equal(verifyToken(signToken(7)).userId, 7);
});

test("state expirado retorna null", { timeout: 2000 }, (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const s = signState({ userId: 7, nonce: "abc", client: "web" });
  t.mock.timers.tick(11 * 60 * 1000);
  assert.equal(verifyState(s), null);
});
