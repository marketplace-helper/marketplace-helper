import prisma from "../config/prisma.js";
import { getBusinessRules } from "./rulesService.js";
import { computeProfit } from "./calcService.js";
import { avaliaDivergencia } from "./freteTable.js";

export const PAGE_SIZE = 50;

// Colunas ordenáveis direto no banco (chave da UI -> campo no banco)
export const SORTABLE = {
  mlb: "mlb",
  titulo: "titulo",
  sku: "sku",
  custoProduto: "custoProduto",
  precoDe: "precoDe",
  precoPor: "precoPor",
  frete: "frete",
  comissao: "comissao",
  tipo: "tipoAnuncio",
  visitas: "visitas",
  vendas: "vendas",
  estoque: "estoque",
  full: "full",
  status: "status",
};

// Colunas ordenáveis que são calculadas em memória
export const COMPUTED_SORT = {
  custoML: "custoML",
  lucro: "lucro",
  margem: "margem",
};

// Filtros rápidos usados pelos KPIs do dashboard (deep-link via ?filter=).
// - where: condição aplicada direto no banco (Prisma).
// - computed: filtro que depende da margem calculada (roda em memória).
export const FILTERS = {
  prejuizo: {
    label: "No prejuízo (margem < 0%, ativos)",
    computed: true,
    test: (it, calc) =>
      it.status === "active" && it.custoProduto != null && calc.margem != null && calc.margem < 0,
  },
  alto: {
    label: "Alto desempenho (margem ≥ 8%, ativos)",
    computed: true,
    test: (it, calc) =>
      it.status === "active" && it.custoProduto != null && calc.margem != null && calc.margem >= 8,
  },
  baixo: {
    label: "Baixo desempenho (margem 0–8%, ativos)",
    computed: true,
    test: (it, calc) =>
      it.status === "active" &&
      it.custoProduto != null &&
      calc.margem != null &&
      calc.margem >= 0 &&
      calc.margem < 8,
  },
  catalogo: { label: "No catálogo", where: { catalogo: true } },
  estoque_baixo: {
    label: "Estoque baixo (≤ 5, ativos)",
    where: { status: "active", estoque: { lte: 5 } },
  },
  full_estoque_baixo: {
    label: "Full com estoque baixo (≤ 5, ativos)",
    where: { status: "active", full: true, estoque: { lte: 5 } },
  },
  sem_custo: {
    label: "Sem custo preenchido (ativos)",
    where: { status: "active", custoProduto: null },
  },
  frete_divergente: {
    label: "Frete divergente (real × cobrado)",
    computed: true,
    test: (it) => avaliaDivergencia(it).divergente,
  },
};

// Comparador genérico para ordenar em memória (usado quando um filtro
// computado obriga a carregar tudo). Trata número e texto.
function compareBy(a, b, field, direction, computed) {
  let av = computed ? a._calc[field] : a[field];
  let bv = computed ? b._calc[field] : b[field];
  if (typeof av === "string" || typeof bv === "string") {
    av = av == null ? "" : String(av);
    bv = bv == null ? "" : String(bv);
    return direction === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  }
  av = av == null ? -Infinity : av;
  bv = bv == null ? -Infinity : bv;
  return direction === "asc" ? av - bv : bv - av;
}

export function buildItemWhere(userId, search) {
  const where = { userId };
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { mlb: { contains: q } },
      { titulo: { contains: q } },
      { sku: { contains: q } },
    ];
  }
  return where;
}

export async function listItems({ userId, page = 1, search = "", sort = "", dir = "", filter = "" } = {}) {
  const baseWhere = buildItemWhere(userId, search);
  const activeFilter = FILTERS[filter] || null;
  const where = activeFilter && activeFilter.where
    ? { ...baseWhere, ...activeFilter.where }
    : baseWhere;

  const currentPage = Math.max(1, Number(page) || 1);
  const direction = dir === "asc" ? "asc" : "desc";
  const rules = await getBusinessRules(userId);

  const dbField = SORTABLE[sort];
  const computedField = COMPUTED_SORT[sort];
  // Precisa carregar tudo quando a ordenação OU o filtro dependem da margem.
  const needsAll = !!computedField || !!(activeFilter && activeFilter.computed);

  let items, total, totalPages;

  if (needsAll) {
    const all = await prisma.item.findMany({ where });
    let withCalc = all.map((it) => ({ ...it, _calc: computeProfit(it, rules) }));
    if (activeFilter && activeFilter.computed) {
      withCalc = withCalc.filter((it) => activeFilter.test(it, it._calc));
    }
    if (computedField) {
      withCalc.sort((a, b) => compareBy(a, b, computedField, direction, true));
    } else if (dbField) {
      withCalc.sort((a, b) => compareBy(a, b, dbField, direction, false));
    } else {
      withCalc.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    total = withCalc.length;
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    items = withCalc.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  } else {
    total = await prisma.item.count({ where });
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const orderBy = dbField ? { [dbField]: direction } : { updatedAt: "desc" };
    const rows = await prisma.item.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    items = rows.map((it) => ({ ...it, _calc: computeProfit(it, rules) }));
  }

  return {
    items,
    total,
    page: currentPage,
    totalPages,
    pageSize: PAGE_SIZE,
    search,
    sort: dbField || computedField ? sort : "",
    dir: direction,
    filter: activeFilter ? filter : "",
    filterLabel: activeFilter ? activeFilter.label : "",
  };
}
