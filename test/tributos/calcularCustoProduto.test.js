import { test } from "node:test";
import assert from "node:assert/strict";
import { LINHAS_ALIQUOTAS } from "../../prisma/seed/aliquotas.js";
import { resolverAliquotas } from "../../src/services/tributos/resolverAliquotas.js";
import { calcularTributos } from "../../src/services/tributos/calcularTributos.js";
import { calcularCustoProduto, computeProfit } from "../../src/services/calcService.js";

const LINHAS = LINHAS_ALIQUOTAS.map((l, i) => ({ ...l, id: i + 1 }));
const item = { precoPor: 100, precoDe: 120, custoProduto: 40, comissao: 11.5, frete: 9.9 };
const regrasBase = { icms: 18, ipi: 0, difal: 0, custoOperacional: 0, creditoCompra: false };

const aliq = (regime, ano) =>
  resolverAliquotas(LINHAS, { regime, data: new Date(`${ano}-07-01T12:00:00-03:00`) });
const ctx = (regime, ano, extra = {}) => ({
  rules: { ...regrasBase, regime, ...extra },
  aliquotas: aliq(regime, ano),
});
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} esperado ${b}, veio ${a}`);

test("legado: sem aliquotas, igual à fórmula antiga", () => {
  const r = calcularCustoProduto(item, regrasBase);
  perto(r.lucro, 20.6);
  perto(r.margem, 20.6);
  perto(r.impostos, 18);
  perto(r.custoML, 21.4);
});

test("Simples 2026 dá o mesmo resultado do legado", () => {
  const legado = computeProfit(item, regrasBase);
  const novo = calcularCustoProduto(item, ctx("SIMPLES", 2026));
  perto(novo.lucro, legado.lucro);
  perto(novo.margem, legado.margem);
});

test("Presumido 2026: PIS/Cofins cumulativos, CBS/IBS só destaque", () => {
  const r = calcularCustoProduto(item, ctx("PRESUMIDO", 2026));
  perto(r.lucro, 16.95);
  const cbs = r.tributos.linhas.find((l) => l.tributo === "CBS");
  assert.equal(cbs.somenteDestaque, true);
  perto(cbs.debito, 0.9);
  perto(cbs.devido, 0);
});

test("Real 2026 com crédito", () => {
  const r = calcularCustoProduto(item, ctx("REAL", 2026, { creditoCompra: true }));
  perto(r.lucro, 15.05);
  const pis = r.tributos.linhas.find((l) => l.tributo === "PIS");
  perto(pis.credito, 0.66);
  perto(pis.devido, 0.99);
});

test("Real 2027 com crédito", () => {
  const r = calcularCustoProduto(item, ctx("REAL", 2027, { creditoCompra: true }));
  perto(r.lucro, 15.32);
  const cbs = r.tributos.linhas.find((l) => l.tributo === "CBS");
  assert.equal(cbs.estimativa, true);
  const ibs = r.tributos.linhas.find((l) => l.tributo === "IBS");
  assert.equal(ibs.estimativa, false);
});

test("Real 2033 sem crédito: ICMS zerado, CBS 8,8 + IBS 17,7", () => {
  const r = calcularCustoProduto(item, ctx("REAL", 2033));
  perto(r.lucro, 12.1);
  const icms = r.tributos.linhas.find((l) => l.tributo === "ICMS");
  perto(icms.devido, 0);
});

test("Simples 2033: ICMS fator 0", () => {
  const r = calcularCustoProduto(item, ctx("SIMPLES", 2033));
  perto(r.lucro, 38.6);
});

test("aceite: a margem do mesmo anúncio muda com o regime e com o ano", () => {
  const presumido2026 = calcularCustoProduto(item, ctx("PRESUMIDO", 2026)).margem;
  const real2027 = calcularCustoProduto(item, ctx("REAL", 2027)).margem;
  const real2033 = calcularCustoProduto(item, ctx("REAL", 2033)).margem;
  assert.notEqual(presumido2026, real2027);
  assert.notEqual(real2027, real2033);
});

test("sem custoProduto e com crédito ligado: crédito 0 e lucro finito", () => {
  const r = calcularCustoProduto({ ...item, custoProduto: null }, ctx("REAL", 2027, { creditoCompra: true }));
  assert.ok(Number.isFinite(r.lucro));
  assert.ok(r.tributos.linhas.every((l) => l.credito === 0));
});

test("custo maior que a venda com crédito: devido nunca negativo", () => {
  const t = calcularTributos({
    base: 100,
    custoProduto: 500,
    rules: { ...regrasBase, creditoCompra: true },
    aliquotas: aliq("REAL", 2027),
  });
  assert.ok(t.linhas.every((l) => l.devido >= 0));
});

test("item sem preço: lucro e margem nulos, sem NaN", () => {
  const r = calcularCustoProduto({ ...item, precoPor: 0, precoDe: 0 }, ctx("REAL", 2027));
  assert.equal(r.lucro, null);
  assert.equal(r.margem, null);
  perto(r.impostos, 0);
});
