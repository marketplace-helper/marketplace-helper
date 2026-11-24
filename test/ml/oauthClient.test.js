import { test } from "node:test";
import assert from "node:assert/strict";
import { createOAuthClient, MlOAuthError } from "../../src/services/ml/oauthClient.js";

const base = { appId: "app1", appSecret: "sec1", redirectUri: "https://x/cb" };

function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

test("exchangeCode envia os campos certos e normaliza a resposta", async () => {
  const fetch = fakeFetch(200, { access_token: "a", refresh_token: "r", expires_in: 21600, user_id: 123 });
  const c = createOAuthClient({ fetch, ...base });
  const out = await c.exchangeCode({ code: "cod", codeVerifier: "ver" });
  assert.deepEqual(out, { accessToken: "a", refreshToken: "r", expiresIn: 21600, mlUserId: "123" });
  const { url, opts } = fetch.calls[0];
  assert.equal(url, "https://api.mercadolibre.com/oauth/token");
  assert.equal(opts.method, "POST");
  assert.equal(opts.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(opts.headers.Accept, "application/json");
  const p = new URLSearchParams(opts.body);
  assert.equal(p.get("grant_type"), "authorization_code");
  assert.equal(p.get("code"), "cod");
  assert.equal(p.get("code_verifier"), "ver");
  assert.equal(p.get("redirect_uri"), "https://x/cb");
  assert.equal(p.get("client_id"), "app1");
  assert.equal(p.get("client_secret"), "sec1");
});

test("refresh envia grant_type=refresh_token", async () => {
  const fetch = fakeFetch(200, { access_token: "a", refresh_token: "r2", expires_in: 100, user_id: 5 });
  const c = createOAuthClient({ fetch, ...base });
  await c.refresh("r1");
  const p = new URLSearchParams(fetch.calls[0].opts.body);
  assert.equal(p.get("grant_type"), "refresh_token");
  assert.equal(p.get("refresh_token"), "r1");
});

test("400 invalid_grant rejeita com MlOAuthError code invalid_grant", async () => {
  const c = createOAuthClient({ fetch: fakeFetch(400, { error: "invalid_grant" }), ...base });
  await assert.rejects(c.refresh("r"), (e) => e instanceof MlOAuthError && e.code === "invalid_grant" && e.status === 400);
});

test("erro sem corpo JSON vira http_<status>", async () => {
  const fetch = async () => ({ ok: false, status: 502, json: async () => { throw new Error("html"); } });
  const c = createOAuthClient({ fetch, ...base });
  await assert.rejects(c.refresh("r"), (e) => e instanceof MlOAuthError && e.code === "http_502");
});

test("fetch lançando TypeError vira MlOAuthError network", async () => {
  const fetch = async () => { throw new TypeError("fetch failed"); };
  const c = createOAuthClient({ fetch, ...base });
  await assert.rejects(c.exchangeCode({ code: "c", codeVerifier: "v" }), (e) => e instanceof MlOAuthError && e.code === "network");
});
