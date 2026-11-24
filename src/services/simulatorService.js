import prisma from "../config/prisma.js";
import { getBusinessRules } from "./rulesService.js";
import { getListingFee, apiGet } from "./mlApi.js";

const API = "https://api.mercadolibre.com";

// Prediz a categoria a partir do título (domain_discovery)
export async function predictCategory(userId, title) {
  if (!title || !title.trim()) return null;
  const data = await apiGet(
    userId,
    `${API}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(title.trim())}`
  );
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;
  return {
    categoryId: first.category_id,
    categoryName: first.category_name,
    domainName: first.domain_name,
  };
}

const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

// Tabela fixa de contribuição de frete do ML para itens baratos
function fallbackByPrice(price) {
  const p = Number(price) || 0;
  if (p <= 18.99) return 6.9;
  if (p <= 48.99) return 8.8;
  if (p <= 78.99) return 9.9;
  return null;
}

// Estima o frete a partir dos próprios anúncios do usuário (mesma categoria,
// senão por palavra-chave do título, senão tabela fixa para itens baratos).
export async function estimateFreight(userId, categoryName, title, price) {
  if (categoryName) {
    const porCat = await prisma.item.findMany({
      where: {
        userId,
        frete: { not: null },
        OR: [
          { categoria1: categoryName },
          { categoria2: categoryName },
          { categoria3: categoryName },
          { categoria4: categoryName },
        ],
      },
      select: { frete: true },
    });
    if (porCat.length) {
      return { valor: avg(porCat.map((i) => i.frete)), base: "categoria", amostra: porCat.length };
    }
  }

  const kw = (title || "")
    .trim()
    .split(/\s+/)
    .find((w) => w.length > 3);
  if (kw) {
    const porTitulo = await prisma.item.findMany({
      where: { userId, frete: { not: null }, titulo: { contains: kw } },
      select: { frete: true },
    });
    if (porTitulo.length) {
      return { valor: avg(porTitulo.map((i) => i.frete)), base: "titulo", amostra: porTitulo.length };
    }
  }

  const tabela = fallbackByPrice(price);
  if (tabela != null) return { valor: tabela, base: "tabela", amostra: 0 };

  return { valor: null, base: "indisponivel", amostra: 0 };
}

function computeType(base, custo, comissao, frete, rules) {
  const pct =
    ((rules.icms || 0) + (rules.ipi || 0) + (rules.difal || 0) + (rules.custoOperacional || 0)) / 100;
  const impostos = base * pct;
  const f = frete || 0;
  const c = comissao || 0;
  const lucro = base - custo - c - f - impostos;
  const margem = base > 0 ? (lucro / base) * 100 : null;
  return { comissao: c, frete: f, impostos, lucro, margem };
}

// Simula o anúncio no Clássico e no Premium
export async function simulate(userId, { title, preco, custo, freteManual }) {
  const base = Number(String(preco).replace(",", ".")) || 0;
  const custoNum = Number(String(custo).replace(",", ".")) || 0;
  const rules = await getBusinessRules(userId);

  const categoria = await predictCategory(userId, title);
  const categoryId = categoria?.categoryId || null;

  // Comissão dos dois tipos
  const feeClassico = await getListingFee(userId, base, "gold_special", categoryId);
  const feePremium = await getListingFee(userId, base, "gold_pro", categoryId);

  // Frete: manual (se informado) senão estimado
  let freteInfo;
  const manual = freteManual != null && String(freteManual).trim() !== ""
    ? Number(String(freteManual).replace(",", "."))
    : null;
  if (manual != null && !Number.isNaN(manual)) {
    freteInfo = { valor: manual, base: "manual", amostra: 0 };
  } else {
    freteInfo = await estimateFreight(userId, categoria?.categoryName, title, base);
  }
  const frete = freteInfo.valor || 0;

  return {
    input: { title, preco: base, custo: custoNum, frete },
    categoria,
    freteInfo,
    rules,
    classico: {
      ...computeType(base, custoNum, feeClassico?.amount || 0, frete, rules),
      comissaoPct: feeClassico?.pct ?? null,
    },
    premium: {
      ...computeType(base, custoNum, feePremium?.amount || 0, frete, rules),
      comissaoPct: feePremium?.pct ?? null,
    },
  };
}
