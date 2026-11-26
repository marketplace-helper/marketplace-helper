import { test } from "node:test";
import assert from "node:assert/strict";
import { cortarAnuncios, decidirSync, MSG_TESTE_EXPIRADO } from "../../src/services/acesso/limitesSync.js";

const tz = "America/Sao_Paulo";
const agora = new Date("2026-11-25T15:00:00Z");
const limites = { maxAnuncios: 2, syncsDia: 3, dias: 14 };
const emTeste = { emTeste: true, testeExpirado: false, podeSincronizar: true, podeAutoSync: false };
const completo = { emTeste: false, testeExpirado: false, podeSincronizar: true, podeAutoSync: true };
const expirado = { emTeste: true, testeExpirado: true, podeSincronizar: false, podeAutoSync: false };

test("cortarAnuncios corta só no teste", () => {
  assert.deepEqual(cortarAnuncios(["A", "B", "C"], emTeste, 2), ["A", "B"]);
  assert.deepEqual(cortarAnuncios(["A", "B", "C"], completo, 2), ["A", "B", "C"]);
});

test("automático no teste é negado sem mensagem ao usuário", () => {
  assert.deepEqual(decidirSync({ situacao: emTeste, origem: "auto", settings: {}, agora, limites, timezone: tz }), { permitido: false, motivo: "auto" });
});

test("automático no completo é permitido sem gravar contador", () => {
  const r = decidirSync({ situacao: completo, origem: "auto", settings: {}, agora, limites, timezone: tz });
  assert.equal(r.permitido, true);
  assert.equal(r.dadosSettings, null);
});

test("manual no teste com o limite do dia esgotado é negado", () => {
  const r = decidirSync({ situacao: emTeste, origem: "manual", settings: { syncManualDia: "2026-11-25", syncManualQtd: 3 }, agora, limites, timezone: tz });
  assert.deepEqual(r, { permitido: false, motivo: "Você já usou as 3 atualizações de hoje do modo teste. Tente amanhã." });
});

test("manual no teste com uso disponível grava o contador", () => {
  const r = decidirSync({ situacao: emTeste, origem: "manual", settings: { syncManualDia: "2026-11-25", syncManualQtd: 1 }, agora, limites, timezone: tz });
  assert.equal(r.permitido, true);
  assert.equal(r.dadosSettings.syncManualQtd, 2);
});

test("teste expirado não sincroniza nem manualmente", () => {
  const r = decidirSync({ situacao: expirado, origem: "manual", settings: {}, agora, limites, timezone: tz });
  assert.deepEqual(r, { permitido: false, motivo: MSG_TESTE_EXPIRADO });
  assert.equal(MSG_TESTE_EXPIRADO, "Seu período de teste terminou. As atualizações voltam quando a conta for liberada.");
});

test("manual no completo não conta atualizações", () => {
  const r = decidirSync({ situacao: completo, origem: "manual", settings: { syncManualDia: "2026-11-25", syncManualQtd: 99 }, agora, limites, timezone: tz });
  assert.deepEqual([r.permitido, r.dadosSettings], [true, null]);
});
