import prisma from "../config/prisma.js";
import { getBusinessRules } from "./rulesService.js";
import { computeProfit, computeHealth } from "./calcService.js";
import { avaliaDivergencia } from "./freteTable.js";

// Dados do dashboard, escopados ao usuario
export async function getDashboardData(userId) {
  const rules = await getBusinessRules(userId);

  // Últimos 5 anúncios cadastrados (com cálculo e saúde)
  const ultimosRaw = await prisma.item.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const ultimosAnuncios = ultimosRaw.map((it) => {
    const calc = computeProfit(it, rules);
    return { ...it, _calc: calc, _health: computeHealth(it, calc) };
  });

  const total = await prisma.item.count({ where: { userId } });
  const comFrete = await prisma.item.count({ where: { userId, frete: { not: null } } });

  const fretesMaisCaros = await prisma.item.findMany({
    where: { userId, frete: { not: null } },
    orderBy: { frete: "desc" },
    take: 10,
    select: { mlb: true, titulo: true, frete: true, precoDe: true, precoPor: true },
  });

  const fretesMudaram = await prisma.item.findMany({
    where: { userId, freteMudou: true },
    orderBy: { frete: "desc" },
    select: { mlb: true, titulo: true, frete: true, freteAnterior: true },
  });

  const agg = await prisma.item.aggregate({
    where: { userId, frete: { not: null } },
    _avg: { frete: true },
    _max: { frete: true },
    _min: { frete: true },
    _sum: { frete: true },
  });

  const totals = await prisma.item.aggregate({
    where: { userId },
    _sum: { estoque: true, vendas: true, visitas: true },
  });

  const porTipoRaw = await prisma.item.groupBy({
    by: ["tipoAnuncio"],
    where: { userId },
    _count: { _all: true },
  });
  const porTipo = porTipoRaw.map((r) => ({
    tipo: r.tipoAnuncio || "N/A",
    count: r._count._all,
  }));

  const full = await prisma.item.count({ where: { userId, full: true } });
  const catalogo = await prisma.item.count({ where: { userId, catalogo: true } });

  let deltaTotal = 0;
  for (const f of fretesMudaram) {
    if (f.frete != null && f.freteAnterior != null) deltaTotal += f.frete - f.freteAnterior;
  }

  // ===== Passada única para KPIs e insights =====
  const allItems = await prisma.item.findMany({ where: { userId } });

  let somaMargem = 0, countMargem = 0, somaLucro = 0;
  let prejuizo = 0, baixoDesempenho = 0, altoDesempenho = 0;
  let comCusto = 0;
  let somaTicket = 0, countTicket = 0;
  let somaCustoMLpct = 0, countCustoMLpct = 0;
  let semEstoqueAtivos = 0, semCustoAtivos = 0, semVendasAtivos = 0, freteSubiu = 0;
  let estoqueBaixo = 0, fullEstoqueBaixo = 0;
  let freteDivergente = 0;
  const divergentes = [];

  const LIMIAR = 8; // limiar de desempenho (margem %) acordado com o usuário

  for (const it of allItems) {
    const calc = computeProfit(it, rules);
    if (it.custoProduto != null) comCusto++;

    if (it.freteMudou && it.frete != null && it.freteAnterior != null && it.frete > it.freteAnterior) {
      freteSubiu++;
    }

    // Frete divergente: real (cubagem das medidas) x cobrado (ML).
    const dv = avaliaDivergencia(it);
    if (dv.divergente) {
      freteDivergente++;
      divergentes.push({
        mlb: it.mlb, titulo: it.titulo, sku: it.sku,
        freteCobrado: dv.freteCobrado, freteReal: dv.freteReal, delta: dv.delta,
      });
    }

    if (it.status === "active") {
      if ((it.estoque || 0) <= 0) semEstoqueAtivos++;
      if ((it.estoque || 0) <= 5) {
        estoqueBaixo++;
        if (it.full) fullEstoqueBaixo++;
      }
      if (it.custoProduto == null) semCustoAtivos++;
      if ((it.vendas || 0) === 0) semVendasAtivos++;
      if (calc.base > 0) { somaTicket += calc.base; countTicket++; }

      // Custo médio do ML (% do preço): quanto comissão + frete pesam.
      if (calc.base > 0 && (it.comissao != null || it.frete != null)) {
        somaCustoMLpct += (((it.comissao || 0) + (it.frete || 0)) / calc.base) * 100;
        countCustoMLpct++;
      }

      // Desempenho por margem (só faz sentido com custo preenchido).
      if (it.custoProduto != null && calc.margem != null) {
        somaMargem += calc.margem;
        countMargem++;
        if (calc.lucro != null) somaLucro += calc.lucro;
        if (calc.margem < 0) prejuizo++;
        else if (calc.margem < LIMIAR) baixoDesempenho++;
        else altoDesempenho++;
      }
    }
  }

  const margemMedia = countMargem ? somaMargem / countMargem : null;
  const lucroMedio = countMargem ? somaLucro / countMargem : null;
  const ticketMedio = countTicket ? somaTicket / countTicket : 0;
  const custoMLMedioPct = countCustoMLpct ? somaCustoMLpct / countCustoMLpct : null;

  // ===== Insights inteligentes (só mostra o que tiver ocorrência) =====
  const insights = [];
  if (estoqueBaixo > 0)
    insights.push({ color: "danger", icon: "box-seam", titulo: `${estoqueBaixo} anúncio(s) ativos com estoque baixo`, texto: "Até 5 unidades. Reabasteça para não perder posição no ranking do Mercado Livre.", link: "/anuncios?filter=estoque_baixo" });
  if (prejuizo > 0)
    insights.push({ color: "danger", icon: "graph-down-arrow", titulo: `${prejuizo} anúncio(s) no prejuízo`, texto: "Margem negativa — revise preço, custo do produto ou frete.", link: "/anuncios?filter=prejuizo" });
  if (baixoDesempenho > 0)
    insights.push({ color: "warning", icon: "exclamation-triangle", titulo: `${baixoDesempenho} anúncio(s) com baixo desempenho`, texto: "Margem abaixo de 8%. Considere reajustar o preço.", link: "/anuncios?filter=baixo" });
  if (semCustoAtivos > 0)
    insights.push({ color: "secondary", icon: "tag", titulo: `${semCustoAtivos} anúncio(s) ativos sem custo preenchido`, texto: "Preencha o custo na coluna 'Custo' para calcular a margem real.", link: "/anuncios?filter=sem_custo" });
  if (semVendasAtivos > 0)
    insights.push({ color: "secondary", icon: "cart-x", titulo: `${semVendasAtivos} anúncio(s) ativos sem nenhuma venda`, texto: "Revise título, fotos e preço para destravar as vendas.", link: "/anuncios?sort=vendas&dir=asc" });
  if (freteSubiu > 0)
    insights.push({ color: "warning", icon: "truck", titulo: `Frete subiu em ${freteSubiu} anúncio(s)`, texto: "O custo de frete aumentou no último sync — reveja a margem desses itens.", link: "/anuncios?sort=frete&dir=desc" });
  if (freteDivergente > 0)
    insights.push({ color: "danger", icon: "rulers", titulo: `${freteDivergente} anúncio(s) com frete divergente`, texto: "O frete real (pelas medidas) difere do cobrado — confira as dimensões cadastradas no ML.", link: "/anuncios?filter=frete_divergente" });

  const divergentesTop = divergentes
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10);

  return {
    ultimosAnuncios,
    insights,
    // KPIs de desempenho (contagens clicáveis)
    prejuizo,
    altoDesempenho,
    baixoDesempenho,
    catalogo,
    estoqueBaixo,
    fullEstoqueBaixo,
    semCustoAtivos,
    freteDivergente,
    divergentesTop,
    comCusto,
    countMargem,
    // KPIs financeiros (valores)
    ticketMedio,
    custoMLMedioPct,
    lucroMedio,
    margemMedia,
    // Demais dados do dashboard
    total,
    comFrete,
    full,
    fretesMaisCaros,
    fretesMudaram,
    deltaTotal,
    freteMedio: agg._avg.frete || 0,
    freteMax: agg._max.frete || 0,
    freteMin: agg._min.frete || 0,
    freteSoma: agg._sum.frete || 0,
    estoqueTotal: totals._sum.estoque || 0,
    vendasTotal: totals._sum.vendas || 0,
    visitasTotal: totals._sum.visitas || 0,
    porTipo,
  };
}
