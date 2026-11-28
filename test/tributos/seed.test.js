import { test } from "node:test";
import assert from "node:assert/strict";
import { LINHAS_ALIQUOTAS } from "../../prisma/seed/aliquotas.js";
import { REGIMES, TRIBUTOS } from "../../src/services/tributos/constantes.js";

test("chaves únicas e regimes/tributos válidos", () => {
  const chaves = LINHAS_ALIQUOTAS.map((l) => l.chave);
  assert.equal(new Set(chaves).size, chaves.length);
  for (const l of LINHAS_ALIQUOTAS) {
    assert.ok(TRIBUTOS.includes(l.tributo), l.chave);
    assert.ok([...REGIMES, "TODOS"].includes(l.regime), l.chave);
    assert.ok(["PERCENTUAL", "FATOR"].includes(l.tipo ?? "PERCENTUAL"), l.chave);
    assert.ok(l.vigenciaInicio instanceof Date && !isNaN(l.vigenciaInicio), l.chave);
  }
});

test("nenhuma linha de PIS/COFINS/CBS/IBS para SIMPLES", () => {
  assert.equal(LINHAS_ALIQUOTAS.filter((l) => l.regime === "SIMPLES").length, 0);
});

test("vigências do mesmo tributo+regime+UF não se sobrepõem", () => {
  const grupos = new Map();
  for (const l of LINHAS_ALIQUOTAS) {
    const k = `${l.tributo}:${l.regime}:${l.uf || ""}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  }
  for (const [k, linhas] of grupos) {
    linhas.sort((a, b) => a.vigenciaInicio - b.vigenciaInicio);
    for (let i = 0; i < linhas.length - 1; i++) {
      const fim = linhas[i].vigenciaFim;
      assert.ok(fim, `${k}: só a última linha pode ficar sem fim`);
      assert.ok(fim < linhas[i + 1].vigenciaInicio, `${k}: ${linhas[i].chave} sobrepõe ${linhas[i + 1].chave}`);
    }
  }
});

test("CBS e IBS de 2026 são só destaque", () => {
  const de2026 = LINHAS_ALIQUOTAS.filter(
    (l) => ["CBS", "IBS"].includes(l.tributo) && l.vigenciaInicio.getUTCFullYear() === 2026
  );
  assert.ok(de2026.length > 0);
  assert.ok(de2026.every((l) => l.somenteDestaque === true));
});
