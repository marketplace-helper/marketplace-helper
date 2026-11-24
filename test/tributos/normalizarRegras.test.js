import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarRegras } from "../../src/services/rulesService.js";

test("regime inválido vira SIMPLES; válido é mantido", () => {
  assert.equal(normalizarRegras({ regime: "XPTO" }).regime, "SIMPLES");
  assert.equal(normalizarRegras({}).regime, "SIMPLES");
  assert.equal(normalizarRegras({ regime: "REAL" }).regime, "REAL");
});

test("UF em maiúsculas; inválida vira null", () => {
  assert.equal(normalizarRegras({ ufOrigem: "sp" }).ufOrigem, "SP");
  assert.equal(normalizarRegras({ ufOrigem: "XX" }).ufOrigem, null);
  assert.equal(normalizarRegras({ ufOrigem: "" }).ufOrigem, null);
});

test("creditoCompra aceita true, 'true', 'on' e '1'", () => {
  for (const v of [true, "true", "on", "1"]) assert.equal(normalizarRegras({ regime: "REAL", creditoCompra: v }).creditoCompra, true, String(v));
  for (const v of [false, "false", "", undefined, "0"]) assert.equal(normalizarRegras({ regime: "REAL", creditoCompra: v }).creditoCompra, false, String(v));
});

test("crédito nunca fica ligado no Simples puro", () => {
  assert.equal(normalizarRegras({ regime: "SIMPLES", creditoCompra: "on" }).creditoCompra, false);
});

test("números com vírgula e negativos", () => {
  const r = normalizarRegras({ icms: "18,5", ipi: "-3", difal: "abc", custoOperacional: "2" });
  assert.equal(r.icms, 18.5);
  assert.equal(r.ipi, 0);
  assert.equal(r.difal, 0);
  assert.equal(r.custoOperacional, 2);
});

test("camposParaSalvar não mexe em regime/UF/crédito ausentes no corpo (clientes antigos)", async () => {
  const { camposParaSalvar } = await import("../../src/services/rulesService.js");
  const antigo = camposParaSalvar({ icms: "18" });
  assert.equal(antigo.icms, 18);
  assert.ok(!("regime" in antigo) && !("ufOrigem" in antigo) && !("creditoCompra" in antigo));
  const novo = camposParaSalvar({ icms: "18", regime: "REAL", ufOrigem: "sp", creditoCompra: "0" });
  assert.equal(novo.regime, "REAL");
  assert.equal(novo.ufOrigem, "SP");
  assert.equal(novo.creditoCompra, false);
});
