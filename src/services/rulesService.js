import prisma from "../config/prisma.js";

function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function getBusinessRules(userId) {
  let r = await prisma.businessRule.findUnique({ where: { userId } });
  if (!r) r = await prisma.businessRule.create({ data: { userId } });
  return r;
}

export async function updateBusinessRules(userId, { icms, ipi, difal, custoOperacional }) {
  const data = {
    icms: toNum(icms),
    ipi: toNum(ipi),
    difal: toNum(difal),
    custoOperacional: toNum(custoOperacional),
  };
  return prisma.businessRule.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
