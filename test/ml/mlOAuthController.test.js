import { test } from "node:test";
import assert from "node:assert/strict";
import { createMlOAuthController } from "../../src/controllers/mlOAuthController.js";

const MOBILE = "marketplacehelper://ml/oauth";

function fakeRes() {
  return {
    redirected: null, body: null, statusCode: 200, ended: false,
    redirect(url) { this.redirected = url; },
    json(b) { this.body = b; return this; },
    status(c) { this.statusCode = c; return this; },
    end() { this.ended = true; return this; },
  };
}

function setup(flowResult) {
  const calls = { start: [], callback: [], disconnect: [] };
  const oauthFlow = {
    async startAuthorization(userId, client) { calls.start.push([userId, client]); return "https://ml.test/auth"; },
    async handleCallback(q) { calls.callback.push(q); return flowResult; },
  };
  const connectionStore = { async disconnect(id) { calls.disconnect.push(id); } };
  const getAuthStatus = async () => ({ authenticated: true, status: "active" });
  const ctrl = createMlOAuthController({ oauthFlow, connectionStore, getAuthStatus, mobileRedirect: MOBILE });
  return { ctrl, calls };
}

test("callback mobile ok redireciona para o deep link com status=ok", async () => {
  const { ctrl } = setup({ ok: true, client: "mobile", message: "Conta do Mercado Livre conectada!" });
  const res = fakeRes();
  await ctrl.callback({ query: { code: "c", state: "s" } }, res);
  assert.equal(res.redirected, `${MOBILE}?status=ok&mensagem=Conta%20do%20Mercado%20Livre%20conectada!`);
});

test("callback mobile cancelado redireciona com status=erro", async () => {
  const msg = "Autorização cancelada no Mercado Livre.";
  const { ctrl, calls } = setup({ ok: false, client: "mobile", message: msg });
  const res = fakeRes();
  await ctrl.callback({ query: { error: "access_denied", state: "s" } }, res);
  assert.equal(res.redirected, `${MOBILE}?status=erro&mensagem=${encodeURIComponent(msg)}`);
  assert.equal(calls.callback[0].error, "access_denied");
});

test("callback web com erro redireciona para /auth?error=", async () => {
  const { ctrl } = setup({ ok: false, client: "web", message: "Falhou aí" });
  const res = fakeRes();
  await ctrl.callback({ query: {} }, res);
  assert.equal(res.redirected, "/auth?error=" + encodeURIComponent("Falhou aí"));
});

test("callback web ok redireciona para /auth?message=", async () => {
  const { ctrl } = setup({ ok: true, client: "web", message: "Conectada!" });
  const res = fakeRes();
  await ctrl.callback({ query: {} }, res);
  assert.equal(res.redirected, "/auth?message=" + encodeURIComponent("Conectada!"));
});

test("POST /api/ml/oauth/start devolve { url } com client mobile", async () => {
  const { ctrl, calls } = setup({});
  const res = fakeRes();
  await ctrl.apiStart({ user: { id: 7 } }, res);
  assert.deepEqual(res.body, { url: "https://ml.test/auth" });
  assert.deepEqual(calls.start[0], [7, "mobile"]);
});

test("GET /ml/conectar redireciona para a URL com client web", async () => {
  const { ctrl, calls } = setup({});
  const res = fakeRes();
  await ctrl.connect({ user: { id: 3 } }, res);
  assert.equal(res.redirected, "https://ml.test/auth");
  assert.deepEqual(calls.start[0], [3, "web"]);
});

test("POST /ml/desconectar desconecta e volta para /auth", async () => {
  const { ctrl, calls } = setup({});
  const res = fakeRes();
  await ctrl.disconnect({ user: { id: 3 } }, res);
  assert.deepEqual(calls.disconnect, [3]);
  assert.equal(res.redirected, "/auth?message=" + encodeURIComponent("Conta do Mercado Livre desconectada."));
});

test("DELETE /api/ml/connection responde 204 e GET devolve o status", async () => {
  const { ctrl, calls } = setup({});
  const res = fakeRes();
  await ctrl.apiDisconnect({ user: { id: 5 } }, res);
  assert.equal(res.statusCode, 204);
  assert.ok(res.ended);
  assert.deepEqual(calls.disconnect, [5]);
  const r2 = fakeRes();
  await ctrl.apiStatus({ user: { id: 5 } }, r2);
  assert.deepEqual(r2.body, { authenticated: true, status: "active" });
});
