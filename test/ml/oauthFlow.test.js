import { test } from "node:test";
import assert from "node:assert/strict";
import { createOAuthFlow } from "../../src/services/ml/oauthFlow.js";
import { verifyState } from "../../src/services/ml/oauthState.js";
import { createFakeStore, createFakeAttempts, createFakeExchangeClient, MlOAuthError } from "./fakes.js";

function setup({ clientOpts, store, now } = {}) {
  const clock = now ? { t: now } : { t: Date.now() };
  const nowFn = () => clock.t;
  const attempts = createFakeAttempts({ now: nowFn });
  const client = createFakeExchangeClient(clientOpts);
  const st = store || createFakeStore({ now: nowFn });
  const flow = createOAuthFlow({
    attempts, client, store: st, now: nowFn,
    appId: "APP123", redirectUri: "https://x.test/cb",
  });
  return { flow, attempts, client, store: st, clock };
}

const stateOf = (url) => new URL(url).searchParams.get("state");

const EXPIRED = "O link de autorização expirou. Tente conectar de novo.";

test("startAuthorization monta a URL com PKCE e state válido", async () => {
  const { flow, attempts } = setup();
  const url = await flow.startAuthorization(7, "web");
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://auth.mercadolivre.com.br/authorization");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("client_id"), "APP123");
  assert.equal(u.searchParams.get("redirect_uri"), "https://x.test/cb");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.ok(u.searchParams.get("code_challenge"));
  const s = verifyState(stateOf(url));
  assert.equal(s.userId, 7);
  assert.equal(s.client, "web");
  assert.ok(attempts.rows.has(s.nonce));
});

test("callback feliz troca o code com o verifier e salva os tokens", async () => {
  const { flow, client, store, attempts } = setup();
  const url = await flow.startAuthorization(7, "mobile");
  const state = stateOf(url);
  const verifier = attempts.rows.get(verifyState(state).nonce).codeVerifier;
  const r = await flow.handleCallback({ code: "CODE", state });
  assert.deepEqual(r, { ok: true, client: "mobile", message: "Conta do Mercado Livre conectada!" });
  assert.deepEqual(client.exchangeCalls, [{ code: "CODE", codeVerifier: verifier }]);
  assert.equal((await store.get(7)).accessToken, "acc");
  assert.equal((await store.get(7)).mlUserId, "999");
});

test("o mesmo state usado duas vezes só troca o code uma vez", async () => {
  const { flow, client } = setup();
  const state = stateOf(await flow.startAuthorization(7, "web"));
  assert.equal((await flow.handleCallback({ code: "C", state, sessionUserId: 7 })).ok, true);
  const r = await flow.handleCallback({ code: "C", state, sessionUserId: 7 });
  assert.deepEqual(r, { ok: false, client: "web", message: EXPIRED });
  assert.equal(client.exchangeCalls.length, 1);
});

test("state de 11 minutos atrás é rejeitado sem trocar o code", async () => {
  const { flow, client, clock } = setup();
  const state = stateOf(await flow.startAuthorization(7, "mobile"));
  clock.t += 11 * 60 * 1000;
  const r = await flow.handleCallback({ code: "C", state });
  assert.equal(r.ok, false);
  assert.equal(r.message, EXPIRED);
  assert.equal(client.exchangeCalls.length, 0);
});

test("state inválido assume client web", async () => {
  const { flow, client } = setup();
  const r = await flow.handleCallback({ code: "C", state: "lixo" });
  assert.deepEqual(r, { ok: false, client: "web", message: EXPIRED });
  assert.equal(client.exchangeCalls.length, 0);
});

test("access_denied devolve cancelamento com o client do state", async () => {
  const { flow, client } = setup();
  const state = stateOf(await flow.startAuthorization(7, "mobile"));
  const r = await flow.handleCallback({ error: "access_denied", state });
  assert.deepEqual(r, { ok: false, client: "mobile", message: "Autorização cancelada no Mercado Livre." });
  assert.equal(client.exchangeCalls.length, 0);
});

test("mlUserId já ligado a outro usuário (P2002) vira mensagem específica", async () => {
  const store = createFakeStore();
  store.saveTokens = async () => {
    throw Object.assign(new Error("Unique constraint"), { code: "P2002", meta: { target: ["mlUserId"] } });
  };
  const { flow } = setup({ store });
  const state = stateOf(await flow.startAuthorization(7, "web"));
  const r = await flow.handleCallback({ code: "C", state, sessionUserId: 7 });
  assert.deepEqual(r, { ok: false, client: "web", message: "Esta conta do Mercado Livre já está conectada a outro usuário." });
});

test("falha na troca do code vira mensagem genérica e não lança", async (t) => {
  t.mock.method(console, "error", () => {});
  const { flow } = setup({ clientOpts: { error: new MlOAuthError("boom", { code: "invalid_grant", status: 400 }) } });
  const state = stateOf(await flow.startAuthorization(7, "mobile"));
  const r = await flow.handleCallback({ code: "C", state });
  assert.deepEqual(r, { ok: false, client: "mobile", message: "Não foi possível conectar ao Mercado Livre. Tente de novo." });
});

test("state web com sessão de outro usuário falha sem trocar o code", async () => {
  const { flow, client } = setup();
  const state = stateOf(await flow.startAuthorization(7, "web"));
  const r = await flow.handleCallback({ code: "C", state, sessionUserId: 99 });
  assert.deepEqual(r, { ok: false, client: "web", message: EXPIRED });
  assert.equal(client.exchangeCalls.length, 0);
});

test("state web sem sessão falha sem trocar o code", async () => {
  const { flow, client } = setup();
  const state = stateOf(await flow.startAuthorization(7, "web"));
  const r = await flow.handleCallback({ code: "C", state });
  assert.equal(r.ok, false);
  assert.equal(client.exchangeCalls.length, 0);
});

test("state web com a sessão do mesmo usuário conclui", async () => {
  const { flow, client } = setup();
  const state = stateOf(await flow.startAuthorization(7, "web"));
  const r = await flow.handleCallback({ code: "C", state, sessionUserId: 7 });
  assert.equal(r.ok, true);
  assert.equal(client.exchangeCalls.length, 1);
});

test("state mobile não depende de sessão", async () => {
  const { flow } = setup();
  const state = stateOf(await flow.startAuthorization(7, "mobile"));
  assert.equal((await flow.handleCallback({ code: "C", state })).ok, true);
});

test("tentativa criada para o usuário 7 com state assinado para o 8 falha", async () => {
  const { flow, attempts, client } = setup();
  const state7 = stateOf(await flow.startAuthorization(7, "mobile"));
  const nonce = verifyState(state7).nonce;
  const { signState } = await import("../../src/services/ml/oauthState.js");
  const forjado = signState({ userId: 8, nonce, client: "mobile" });
  const r = await flow.handleCallback({ code: "C", state: forjado });
  assert.deepEqual(r, { ok: false, client: "mobile", message: EXPIRED });
  assert.equal(client.exchangeCalls.length, 0);
});
