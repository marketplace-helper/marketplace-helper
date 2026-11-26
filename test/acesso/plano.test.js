import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerInteiroPositivo, situacaoDoPlano, inicioDoTeste, diaLocal, consumirSyncManual, dadosDeVerificacao,
} from "../../src/services/acesso/plano.js";

test("lerInteiroPositivo usa a env quando válida e o fallback quando não", () => {
  assert.equal(lerInteiroPositivo("80", 50), 80);
  for (const v of ["", undefined, null, "abc", "0", "-5", "2.5", " "]) assert.equal(lerInteiroPositivo(v, 50), 50, String(v));
});

test("COMPLETO entra e sincroniza tudo, inclusive automático", () => {
  const s = situacaoDoPlano({ plano: "COMPLETO" });
  assert.deepEqual([s.podeEntrar, s.podeSincronizar, s.podeAutoSync, s.emTeste], [true, true, true, false]);
});

test("TESTE dentro do prazo: entra, sincroniza manual, sem automático", () => {
  const agora = new Date("2026-11-25T12:00:00-03:00");
  const s = situacaoDoPlano({ plano: "TESTE", testeAte: new Date("2026-12-09T12:00:00-03:00") }, agora);
  assert.deepEqual([s.podeEntrar, s.emTeste, s.testeExpirado, s.podeSincronizar, s.podeAutoSync], [true, true, false, true, false]);
});

test("TESTE sem data de fim conta como teste no prazo", () => {
  const s = situacaoDoPlano({ plano: "TESTE", testeAte: null });
  assert.deepEqual([s.emTeste, s.testeExpirado, s.podeSincronizar], [true, false, true]);
});

test("TESTE vencido: entra, mas não sincroniza", () => {
  const s = situacaoDoPlano({ plano: "TESTE", testeAte: new Date("2026-11-01T00:00:00Z") }, new Date("2026-11-25T00:00:00Z"));
  assert.deepEqual([s.podeEntrar, s.testeExpirado, s.podeSincronizar, s.podeAutoSync], [true, true, false, false]);
});

test("BLOQUEADO não entra; plano desconhecido é tratado como BLOQUEADO", () => {
  assert.equal(situacaoDoPlano({ plano: "BLOQUEADO" }).podeEntrar, false);
  assert.equal(situacaoDoPlano({ plano: "XPTO" }).podeEntrar, false);
  assert.equal(situacaoDoPlano({ plano: "XPTO" }).podeSincronizar, false);
});

test("inicioDoTeste só define testeAte uma vez e só no TESTE", () => {
  const agora = new Date("2026-11-25T12:00:00Z");
  assert.equal(inicioDoTeste({ plano: "TESTE", testeAte: null }, agora, 14).testeAte.toISOString(), "2026-12-09T12:00:00.000Z");
  assert.deepEqual(inicioDoTeste({ plano: "TESTE", testeAte: new Date() }, agora, 14), {});
  assert.deepEqual(inicioDoTeste({ plano: "COMPLETO", testeAte: null }, agora, 14), {});
});

test("dados de verificação iniciam o teste junto com a confirmação do e-mail", () => {
  const agora = new Date("2026-11-25T12:00:00Z");
  const d = dadosDeVerificacao({ plano: "TESTE", testeAte: null }, agora, 14);
  assert.equal(d.emailVerifiedAt, agora);
  assert.equal(d.testeAte.toISOString(), "2026-12-09T12:00:00.000Z");
  assert.deepEqual(dadosDeVerificacao({ plano: "COMPLETO", testeAte: null }, agora, 14), { emailVerifiedAt: agora });
});

test("diaLocal usa o fuso de São Paulo", () => {
  assert.equal(diaLocal(new Date("2026-11-26T02:30:00Z"), "America/Sao_Paulo"), "2026-11-25");
  assert.equal(diaLocal(new Date("2026-11-26T03:30:00Z"), "America/Sao_Paulo"), "2026-11-26");
});

test("consumirSyncManual conta por dia e zera na virada", () => {
  const tz = "America/Sao_Paulo", agora = new Date("2026-11-25T15:00:00Z");
  let r = consumirSyncManual({ syncManualDia: "2026-11-25", syncManualQtd: 2 }, { agora, timezone: tz, limite: 3 });
  assert.deepEqual([r.permitido, r.usados, r.dados], [true, 3, { syncManualDia: "2026-11-25", syncManualQtd: 3 }]);
  r = consumirSyncManual({ syncManualDia: "2026-11-25", syncManualQtd: 3 }, { agora, timezone: tz, limite: 3 });
  assert.deepEqual([r.permitido, r.dados], [false, null]);
  r = consumirSyncManual({ syncManualDia: "2026-11-24", syncManualQtd: 3 }, { agora, timezone: tz, limite: 3 });
  assert.deepEqual([r.permitido, r.dados], [true, { syncManualDia: "2026-11-25", syncManualQtd: 1 }]);
  r = consumirSyncManual({}, { agora, timezone: tz, limite: 3 });
  assert.deepEqual([r.permitido, r.dados], [true, { syncManualDia: "2026-11-25", syncManualQtd: 1 }]);
});
