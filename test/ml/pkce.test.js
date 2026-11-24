import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createPkcePair } from "../../src/services/ml/pkce.js";

test("challenge é o SHA-256 base64url do verifier", () => {
  const { verifier, challenge } = createPkcePair();
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("pares diferentes a cada chamada", () => {
  assert.notEqual(createPkcePair().verifier, createPkcePair().verifier);
});
