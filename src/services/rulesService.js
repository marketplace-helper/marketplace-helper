import prisma from "../config/prisma.js";
import { REGIMES, UFS } from "./tributos/constantes.js";

function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function getBusinessRules(userId) {
  let r = await prisma.businessRule.findUnique({ where: { userId } });
  if (!r) r = await prisma.businessRule.create({ data: { userId } });
  return r;
}

const VERDADEIRO = new Set([true, "true", "on", "1"]);

// Converte o corpo do formulário/API nos campos do BusinessRule, com valores seguros.
export function normalizarRegras(body = {}) {
  const regime = REGIMES.includes(body.regime) ? body.regime : "SIMPLES";
  const uf = String(body.ufOrigem ?? "").trim().toUpperCase();
  return {
    icms: toNum(body.icms),
    ipi: toNum(body.ipi),
    difal: toNum(body.difal),
    custoOperacional: toNum(body.custoOperacional),
    regime,
    ufOrigem: UFS.includes(uf) ? uf : null,
    // No Simples puro não há PIS/Cofins/CBS/IBS destacados, então não há crédito.
    creditoCompra: regime !== "SIMPLES" && VERDADEIRO.has(body.creditoCompra),
  };
}

// Campos a gravar: os percentuais sempre; regime, UF e crédito só quando vierem
// no corpo, para clientes antigos (sem esses campos) não voltarem o regime para Simples.
export function camposParaSalvar(body = {}) {
  const data = normalizarRegras(body);
  for (const k of ["regime", "ufOrigem", "creditoCompra"]) if (body[k] === undefined) delete data[k];
  return data;
}

export async function updateBusinessRules(userId, body) {
  const data = camposParaSalvar(body);
  return prisma.businessRule.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
