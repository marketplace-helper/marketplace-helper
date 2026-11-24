import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAno, dataDoCalculo, montarContexto } from "../../src/services/tributos/contexto.js";
import { LINHAS_ALIQUOTAS } from "../../prisma/seed/aliquotas.js";

test("parseAno aceita inteiros do ano atual até 2040", () => {
  assert.equal(parseAno("2027", 2026), 2027);
  assert.equal(parseAno(2033, 2026), 2033);
  assert.equal(parseAno("2026", 2026), 2026);
  assert.equal(parseAno("2040", 2026), 2040);
});

test("parseAno rejeita valores inválidos", () => {
  for (const v of ["abc", "1999", "2025", "2027.5", "", undefined, null, "2041", " 2027x", ["2027"]]) {
    assert.equal(parseAno(v, 2026), null, String(v));
  }
});

test("dataDoCalculo: sem ano usa agora; com ano cai no meio do ano", () => {
  const agora = new Date("2026-11-23T10:00:00-03:00");
  assert.equal(dataDoCalculo(null, agora), agora);
  const d = dataDoCalculo(2029);
  assert.equal(d.getUTCFullYear(), 2029);
  assert.equal(d.getUTCMonth(), 6);
});

test("montarContexto resolve as alíquotas do regime e da UF do usuário", () => {
  const rules = { regime: "REAL", ufOrigem: "SP", icms: 18 };
  const ctx = montarContexto(rules, LINHAS_ALIQUOTAS, { ano: 2027 });
  assert.equal(ctx.ano, 2027);
  assert.equal(ctx.regime, "REAL");
  assert.equal(ctx.aliquotas.CBS.aliquota, 8.7);
  assert.equal(ctx.rules, rules);
});

test("montarContexto com regime desconhecido cai em SIMPLES", () => {
  const ctx = montarContexto({ regime: "XPTO" }, LINHAS_ALIQUOTAS, {});
  assert.equal(ctx.regime, "SIMPLES");
  assert.deepEqual(Object.keys(ctx.aliquotas), ["ICMS"]);
});
