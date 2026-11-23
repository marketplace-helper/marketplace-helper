import { test } from "node:test";
import assert from "node:assert/strict";
import { decifrarTokenOuFalhar, CryptoConfigError } from "../../src/services/ml/cryptoGuard.js";
import { encrypt } from "../../src/config/crypto.js";

test("token cifrado com a chave atual é decifrado", () => {
  assert.equal(decifrarTokenOuFalhar(encrypt("abc")), "abc");
});

test("valor nulo passa direto", () => {
  assert.equal(decifrarTokenOuFalhar(null), null);
});

test("token que continua cifrado (chave errada) lança CryptoConfigError", () => {
  const lixo = "enc:v1:" + "00".repeat(12) + ":" + "00".repeat(16) + ":" + "00".repeat(8);
  assert.throws(() => decifrarTokenOuFalhar(lixo), (e) => e instanceof CryptoConfigError && /ENCRYPTION_KEY/.test(e.message));
});
