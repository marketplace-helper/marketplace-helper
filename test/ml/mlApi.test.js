import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiGet } from "../../src/services/mlApi.js";
import { ReconnectRequiredError } from "../../src/services/ml/tokenManager.js";

// Resposta mínima compatível com o que o apiGet usa de fetch
const resp = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

function setup(responses, { tokenError = null } = {}) {
  const calls = [];
  const queue = [...responses];
  const fetch = async (url, opts) => {
    calls.push({ url, auth: opts.headers.Authorization });
    return queue.shift();
  };
  const tm = {
    forceRefreshCalls: 0,
    async getValidToken() {
      if (tokenError) throw tokenError;
      return "token-velho";
    },
    async forceRefresh() {
      tm.forceRefreshCalls++;
      return "token-novo";
    },
  };
  const apiGet = createApiGet({ fetch, tokenManager: tm, sleep: async () => {} });
  return { apiGet, tm, calls };
}

test("401 seguido de 200: renova uma vez e repete com o token novo", async () => {
  const { apiGet, tm, calls } = setup([resp(401), resp(200, { ok: 1 })]);
  assert.deepEqual(await apiGet(1, "https://x/y"), { ok: 1 });
  assert.equal(tm.forceRefreshCalls, 1);
  assert.equal(calls[0].auth, "Bearer token-velho");
  assert.equal(calls[1].auth, "Bearer token-novo");
});

test("401 duas vezes: devolve null e renova só uma vez", async () => {
  const { apiGet, tm } = setup([resp(401), resp(401)]);
  assert.equal(await apiGet(1, "https://x/y"), null);
  assert.equal(tm.forceRefreshCalls, 1);
});

test("404 devolve null sem renovar", async () => {
  const { apiGet, tm } = setup([resp(404)]);
  assert.equal(await apiGet(1, "https://x/y"), null);
  assert.equal(tm.forceRefreshCalls, 0);
});

test("ReconnectRequiredError propaga", async () => {
  const err = new ReconnectRequiredError();
  const { apiGet } = setup([], { tokenError: err });
  await assert.rejects(() => apiGet(1, "https://x/y"), (e) => e === err);
});

test("5xx repete e depois funciona", async () => {
  const { apiGet } = setup([resp(500), resp(200, { a: 2 })]);
  assert.deepEqual(await apiGet(1, "https://x/y"), { a: 2 });
});
