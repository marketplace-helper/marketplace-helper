import { test } from "node:test";
import assert from "node:assert/strict";
import { createTokenManager, NotConnectedError, ReconnectRequiredError } from "../../src/services/ml/tokenManager.js";
import { MlOAuthError } from "../../src/services/ml/oauthClient.js";
import { createFakeStore, createFakeClient } from "./fakes.js";

const NOW = Date.parse("2026-01-01T12:00:00Z");

// Monta store + cliente falsos; a conexão do usuário 1 vence em `expiresInMs`.
function setup({ expiresInMs, refreshError = null, connected = true } = {}) {
  const clock = { t: NOW };
  const now = () => clock.t;
  const store = createFakeStore({ now });
  if (connected) {
    store.rows.set(1, {
      userId: 1, mlUserId: "123", accessToken: "access-atual", refreshToken: "refresh-atual",
      expiresAt: new Date(NOW + expiresInMs), status: "active", lastRefreshAt: null, lastError: null,
    });
  }
  const client = createFakeClient({ refreshError });
  const tm = createTokenManager({ store, client, now });
  return { tm, store, client, clock };
}

test("10 chamadas simultâneas com token vencendo fazem 1 refresh só", async () => {
  const { tm, client } = setup({ expiresInMs: 60_000 });
  const tokens = await Promise.all(Array.from({ length: 10 }, () => tm.getValidToken(1)));
  assert.equal(client.refreshCalls, 1);
  assert.ok(tokens.every((t) => t === "novo-access"));
});

test("token com folga não chama o ML", async () => {
  const { tm, client } = setup({ expiresInMs: 3 * 3600_000 });
  assert.equal(await tm.getValidToken(1), "access-atual");
  assert.equal(client.refreshCalls, 0);
});

test("invalid_grant vira reconnect_required", async () => {
  const { tm, store } = setup({ expiresInMs: 0, refreshError: new MlOAuthError("x", { code: "invalid_grant", status: 400 }) });
  await assert.rejects(tm.getValidToken(1), ReconnectRequiredError);
  assert.equal((await store.get(1)).status, "reconnect_required");
});

test("erro de rede no refresh mantém active e guarda lastError", async () => {
  const { tm, store } = setup({ expiresInMs: 0, refreshError: new MlOAuthError("x", { code: "network", status: 0 }) });
  await assert.rejects(tm.getValidToken(1));
  const c = await store.get(1);
  assert.equal(c.status, "active");
  assert.ok(c.lastError);
});

test("refresh grava o novo refresh token (rotação)", async () => {
  const { tm, store } = setup({ expiresInMs: 0 });
  await tm.getValidToken(1);
  assert.equal((await store.get(1)).refreshToken, "novo-refresh");
});

test("forceRefresh duas vezes seguidas faz 1 refresh", async () => {
  const { tm, client } = setup({ expiresInMs: 3 * 3600_000 });
  const [a, b] = await Promise.all([tm.forceRefresh(1), tm.forceRefresh(1)]);
  assert.equal(a, "novo-access");
  assert.equal(b, "novo-access");
  assert.equal(await tm.forceRefresh(1), "novo-access");
  assert.equal(client.refreshCalls, 1);
});

test("forceRefresh renova de novo depois de 10 s", async () => {
  const { tm, client, clock } = setup({ expiresInMs: 3 * 3600_000 });
  await tm.forceRefresh(1);
  clock.t += 11_000;
  await tm.forceRefresh(1);
  assert.equal(client.refreshCalls, 2);
});

test("refreshIfExpiring(1, 30min) renova quem vence em 20 min e ignora quem vence em 2 h", async () => {
  const a = setup({ expiresInMs: 20 * 60_000 });
  await a.tm.refreshIfExpiring(1, 30 * 60_000);
  assert.equal(a.client.refreshCalls, 1);
  const b = setup({ expiresInMs: 2 * 3600_000 });
  await b.tm.refreshIfExpiring(1, 30 * 60_000);
  assert.equal(b.client.refreshCalls, 0);
});

test("sem conexão lança NotConnectedError", async () => {
  const { tm } = setup({ connected: false });
  await assert.rejects(tm.getValidToken(1), NotConnectedError);
});

test("desconectado lança NotConnectedError e reconnect_required lança ReconnectRequiredError", async () => {
  const d = setup({ expiresInMs: 0 });
  await d.store.disconnect(1);
  await assert.rejects(d.tm.getValidToken(1), NotConnectedError);
  const r = setup({ expiresInMs: 0 });
  await r.store.markReconnectRequired(1, "x");
  await assert.rejects(r.tm.getValidToken(1), ReconnectRequiredError);
  assert.equal(r.client.refreshCalls, 0);
});
