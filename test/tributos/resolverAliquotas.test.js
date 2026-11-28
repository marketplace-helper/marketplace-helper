import { test } from "node:test";
import assert from "node:assert/strict";
import { LINHAS_ALIQUOTAS } from "../../prisma/seed/aliquotas.js";
import { resolverAliquotas } from "../../src/services/tributos/resolverAliquotas.js";

const LINHAS = LINHAS_ALIQUOTAS.map((l, i) => ({ ...l, id: i + 1 }));
const d = (s) => new Date(s + "T12:00:00-03:00");

test("REAL em 2026: PIS, COFINS, CBS/IBS de destaque e fator de ICMS 1", () => {
  const r = resolverAliquotas(LINHAS, { regime: "REAL", data: d("2026-11-23") });
  assert.equal(r.PIS.aliquota, 1.65);
  assert.equal(r.COFINS.aliquota, 7.6);
  assert.equal(r.CBS.somenteDestaque, true);
  assert.equal(r.IBS.somenteDestaque, true);
  assert.equal(r.ICMS.aliquota, 1);
});

test("SIMPLES em 2026: só o fator de ICMS", () => {
  const r = resolverAliquotas(LINHAS, { regime: "SIMPLES", data: d("2026-06-01") });
  assert.deepEqual(Object.keys(r), ["ICMS"]);
});

test("REAL em 2027: sem PIS/COFINS, CBS 8,7", () => {
  const r = resolverAliquotas(LINHAS, { regime: "REAL", data: d("2027-03-01") });
  assert.equal(r.PIS, undefined);
  assert.equal(r.COFINS, undefined);
  assert.equal(r.CBS.aliquota, 8.7);
  assert.equal(r.IBS.aliquota, 0.1);
});

test("2029: IBS 1,77 e ICMS fator 0,9", () => {
  const r = resolverAliquotas(LINHAS, { regime: "PRESUMIDO", data: d("2029-07-01") });
  assert.equal(r.IBS.aliquota, 1.77);
  assert.equal(r.CBS.aliquota, 8.8);
  assert.equal(r.ICMS.aliquota, 0.9);
});

test("2033 e 2040: IBS 17,7 e ICMS fator 0 (linha sem fim)", () => {
  for (const ano of ["2033-07-01", "2040-07-01"]) {
    const r = resolverAliquotas(LINHAS, { regime: "REAL", data: d(ano) });
    assert.equal(r.IBS.aliquota, 17.7, ano);
    assert.equal(r.CBS.aliquota, 8.8, ano);
    assert.equal(r.ICMS.aliquota, 0, ano);
  }
});

test("virada de ano: 2026-12-31 23:00 BRT ainda é 2026; 2027-01-01 00:30 BRT já é 2027", () => {
  const fim2026 = resolverAliquotas(LINHAS, { regime: "REAL", data: new Date("2026-12-31T23:00:00-03:00") });
  assert.equal(fim2026.PIS.aliquota, 1.65);
  assert.equal(fim2026.CBS.aliquota, 0.9);
  const inicio2027 = resolverAliquotas(LINHAS, { regime: "REAL", data: new Date("2027-01-01T00:30:00-03:00") });
  assert.equal(inicio2027.PIS, undefined);
  assert.equal(inicio2027.CBS.aliquota, 8.7);
});

test("linha com UF ganha da genérica; linha manual mais recente ganha da do seed", () => {
  const extras = [
    { id: 900, chave: "IBS:REAL:2033:SP", tributo: "IBS", regime: "REAL", aliquota: 18.5, uf: "SP",
      vigenciaInicio: new Date("2033-01-01T00:00:00-03:00"), vigenciaFim: null },
    { id: 901, chave: "CBS:REAL:2035-manual", tributo: "CBS", regime: "REAL", aliquota: 9.1,
      vigenciaInicio: new Date("2035-01-01T00:00:00-03:00"), vigenciaFim: null },
  ];
  const r = resolverAliquotas([...LINHAS, ...extras], { regime: "REAL", data: d("2036-01-01"), uf: "SP" });
  assert.equal(r.IBS.aliquota, 18.5);
  assert.equal(r.CBS.aliquota, 9.1);
  const semUf = resolverAliquotas([...LINHAS, ...extras], { regime: "REAL", data: d("2036-01-01"), uf: "RJ" });
  assert.equal(semUf.IBS.aliquota, 17.7);
});

test("regime exato ganha de TODOS; empate desfeito pelo maior id", () => {
  const extras = [
    { id: 902, chave: "ICMS:REAL:2029", tributo: "ICMS", regime: "REAL", aliquota: 0.5, tipo: "FATOR",
      vigenciaInicio: new Date("2029-01-01T00:00:00-03:00"), vigenciaFim: null },
    { id: 903, chave: "ICMS:REAL:2029-b", tributo: "ICMS", regime: "REAL", aliquota: 0.4, tipo: "FATOR",
      vigenciaInicio: new Date("2029-01-01T00:00:00-03:00"), vigenciaFim: null },
  ];
  const r = resolverAliquotas([...LINHAS, ...extras], { regime: "REAL", data: d("2029-07-01") });
  assert.equal(r.ICMS.aliquota, 0.4);
});

test("linha com ncm ou cClassTrib é ignorada", () => {
  const extras = [
    { id: 904, chave: "CBS:REAL:2027:ncm", tributo: "CBS", regime: "REAL", aliquota: 1, ncm: "1234",
      vigenciaInicio: new Date("2027-06-01T00:00:00-03:00"), vigenciaFim: null },
    { id: 905, chave: "IBS:REAL:2027:cct", tributo: "IBS", regime: "REAL", aliquota: 1, cClassTrib: "000001",
      vigenciaInicio: new Date("2027-06-01T00:00:00-03:00"), vigenciaFim: null },
  ];
  const r = resolverAliquotas([...LINHAS, ...extras], { regime: "REAL", data: d("2027-07-01") });
  assert.equal(r.CBS.aliquota, 8.7);
  assert.equal(r.IBS.aliquota, 0.1);
});

test("datas vindas do banco como string também funcionam", () => {
  const comoTexto = LINHAS.map((l) => ({
    ...l,
    vigenciaInicio: l.vigenciaInicio.toISOString(),
    vigenciaFim: l.vigenciaFim ? l.vigenciaFim.toISOString() : null,
  }));
  const r = resolverAliquotas(comoTexto, { regime: "REAL", data: d("2027-03-01") });
  assert.equal(r.CBS.aliquota, 8.7);
});
