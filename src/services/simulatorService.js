import prisma from "../config/prisma.js";
import { calcularCustoProduto } from "./calcService.js";
import { criarContextoTributario } from "./tributos/contexto.js";
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
      where: { userId, frete: { not: null }, titulo: { contains: kw, mode: "insensitive" } },
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

// Resultado de um tipo de anúncio (Clássico/Premium) com o mesmo cálculo das
// outras telas (calcularCustoProduto + contexto tributário do usuário).
function computeType(base, custo, comissao, frete, ctx) {
  const c = comissao || 0;
  const f = frete || 0;
  const calc = calcularCustoProduto({ precoPor: base, custoProduto: custo, comissao: c, frete: f }, ctx);
  // Sem preço o cálculo devolve lucro nulo; aqui mostramos o prejuízo (custos sem receita).
  const lucro = calc.lucro ?? -(custo + c + f + calc.impostos);
  return { comissao: c, frete: f, impostos: calc.impostos, tributos: calc.tributos, lucro, margem: calc.margem };
}

// Simula o anúncio no Clássico e no Premium
export async function simulate(userId, { title, preco, custo, freteManual, ano = null }) {
  const base = Number(String(preco).replace(",", ".")) || 0;
  const custoNum = Number(String(custo).replace(",", ".")) || 0;
  const ctx = await criarContextoTributario(userId, { ano });
  const rules = ctx.rules;

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
    ano: ctx.ano,
    regime: ctx.regime,
    classico: {
      ...computeType(base, custoNum, feeClassico?.amount || 0, frete, ctx),
      comissaoPct: feeClassico?.pct ?? null,
    },
    premium: {
      ...computeType(base, custoNum, feePremium?.amount || 0, frete, ctx),
      comissaoPct: feePremium?.pct ?? null,
    },
  };
}
