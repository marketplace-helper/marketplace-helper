import { test } from "node:test";
import assert from "node:assert/strict";
import { LINHAS_ALIQUOTAS } from "../../prisma/seed/aliquotas.js";
import { UFS } from "../../src/services/tributos/constantes.js";
import { icmsInternoPorUf } from "../../src/services/tributos/icmsInterno.js";
import { resolverAliquotas } from "../../src/services/tributos/resolverAliquotas.js";

const hoje = new Date("2026-11-27T12:00:00-03:00");

test("seed traz a alíquota interna das 27 UFs", () => {
  const m = icmsInternoPorUf(LINHAS_ALIQUOTAS, hoje);
  assert.deepEqual(Object.keys(m).sort(), [...UFS].sort());
  assert.equal(m.SP, 18);
  assert.equal(m.RJ, 22);
  assert.equal(m.MA, 23);
  assert.equal(m.AL, 20.5);
  assert.equal(m.ES, 17);
  assert.equal(m.PR, 19.5);
});

test("linha encerrada perde para a vigente", () => {
  const linhas = [
    { tributo: "ICMS_INTERNO", uf: "XX", aliquota: 17, vigenciaInicio: new Date("2000-01-01"), vigenciaFim: new Date("2025-12-31") },
    { tributo: "ICMS_INTERNO", uf: "XX", aliquota: 19, vigenciaInicio: new Date("2026-01-01"), vigenciaFim: null },
  ];
  assert.deepEqual(icmsInternoPorUf(linhas, hoje), { XX: 19 });
});

test("resolvedor ignora ICMS_INTERNO (não entra no cálculo nem no painel)", () => {
  const r = resolverAliquotas(LINHAS_ALIQUOTAS, { regime: "REAL", data: hoje, uf: "SP" });
  assert.equal(r.ICMS_INTERNO, undefined);
  assert.equal(r.ICMS.aliquota, 1);
});
