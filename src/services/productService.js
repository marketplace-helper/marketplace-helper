import prisma from "../config/prisma.js";
import { avaliaDivergencia, classificarTamanhoFull } from "./freteTable.js";

export const PAGE_SIZE = 50;

const basePreco = (it) => (it.precoPor && it.precoPor > 0 ? it.precoPor : it.precoDe || 0);

// Monta a lista completa de produtos (agrupados por SKU), já com custo,
// medidas, comparação de frete e tamanho no Full. Ordenada por nome.
async function buildProductList(userId) {
  const items = await prisma.item.findMany({
    where: { userId, sku: { not: null } },
    select: {
      sku: true, titulo: true, mlb: true, custoProduto: true, thumbnail: true,
      largura: true, altura: true, comprimento: true, pesoReal: true,
      precoDe: true, precoPor: true, frete: true, status: true,
    },
  });

  const map = new Map();
  for (const it of items) {
    const sku = (it.sku || "").trim();
    if (!sku) continue;
    if (!map.has(sku)) {
      map.set(sku, {
        sku, nomes: {}, mlbs: [], custos: new Set(), custo: null, thumbnail: null,
        largura: null, altura: null, comprimento: null, pesoReal: null, itens: [],
      });
    }
    const g = map.get(sku);
    g.mlbs.push(it.mlb);
    g.itens.push(it);
    g.nomes[it.titulo] = (g.nomes[it.titulo] || 0) + 1;
    if (it.custoProduto != null) {
      g.custos.add(it.custoProduto);
      if (g.custo == null) g.custo = it.custoProduto;
    }
    for (const campo of ["largura", "altura", "comprimento", "pesoReal"]) {
      if (g[campo] == null && it[campo] != null) g[campo] = it[campo];
    }
    if (!g.thumbnail && it.thumbnail) g.thumbnail = it.thumbnail;
  }

  const products = [...map.values()].map((g) => {
    const dims = { largura: g.largura, altura: g.altura, comprimento: g.comprimento, pesoReal: g.pesoReal };

    const comFrete = g.itens.filter((it) => it.frete != null);
    const rep = (comFrete.length ? comFrete : g.itens)
      .slice()
      .sort((a, b) => basePreco(b) - basePreco(a))[0];
    const div = rep ? avaliaDivergencia({ ...rep, ...dims }) : null;

    let nDivergentes = 0;
    for (const it of g.itens) {
      if (avaliaDivergencia({ ...it, ...dims }).divergente) nDivergentes++;
    }

    const tam = classificarTamanhoFull(g.largura, g.altura, g.comprimento, g.pesoReal);

    return {
      sku: g.sku,
      nome: Object.entries(g.nomes).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
      qtd: g.mlbs.length,
      mlbs: g.mlbs,
      custo: g.custo,
      custoMisto: g.custos.size > 1,
      thumbnail: g.thumbnail,
      ...dims,
      temMedidas: div ? div.temMedidas : false,
      cubagem: div && div.cubagem != null ? div.cubagem : null,
      freteCobrado: div ? div.freteCobrado : null,
      freteReal: div ? div.freteReal : null,
      delta: div ? div.delta : null,
      divergente: div ? div.divergente : false,
      nDivergentes,
      tamanhoFull: tam ? tam.tamanho : null,
      dentroDoFull: tam ? tam.dentroDoFull : null,
      somaLados: tam ? tam.soma : null,
    };
  });

  products.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return products;
}

function filtrar(products, search) {
  if (!search || !search.trim()) return products;
  const q = search.trim().toLowerCase();
  return products.filter(
    (p) =>
      p.sku.toLowerCase().includes(q) ||
      p.nome.toLowerCase().includes(q) ||
      p.mlbs.some((m) => m.toLowerCase().includes(q))
  );
}

// Lista paginada para a tela de Produtos.
export async function listProducts({ userId, page = 1, search = "" } = {}) {
  const products = filtrar(await buildProductList(userId), search);

  const total = products.length;
  const currentPage = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const semSku = await prisma.item.count({
    where: { userId, OR: [{ sku: null }, { sku: "" }] },
  });

  return { products: pageItems, total, page: currentPage, totalPages, pageSize: PAGE_SIZE, search, semSku };
}

// Todos os produtos (sem paginação) para o relatório Excel.
export async function getProductsForExport(userId, search = "") {
  return filtrar(await buildProductList(userId), search);
}

// Aplica o custo a TODOS os anúncios de um SKU.
export async function setCostForSku(userId, sku, custo) {
  const parsed = parseFloat(String(custo ?? "").replace(",", "."));
  const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  const r = await prisma.item.updateMany({
    where: { userId, sku },
    data: { custoProduto: value },
  });
  return { custoProduto: value, afetados: r.count };
}

// Converte entrada numérica (positiva) ou retorna null.
function posOrNull(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const CAMPOS_MEDIDAS = ["largura", "altura", "comprimento", "pesoReal"];

// Aplica as medidas (L/A/C/peso) a TODOS os anúncios de um SKU e devolve a
// comparação frete cobrado × real do anúncio representativo.
// Atualiza só os campos ENVIADOS: `undefined` mantém o valor atual (assim a balança pode mandar
// apenas o peso sem apagar largura/altura/comprimento). Um campo enviado vazio ou inválido
// continua limpando o valor, como antes, então a página web (que envia os quatro) não muda.
export async function setDimsForSku(userId, sku, dims = {}) {
  const data = {};
  for (const campo of CAMPOS_MEDIDAS) {
    if (dims[campo] !== undefined) data[campo] = posOrNull(dims[campo]);
  }
  const afetados = Object.keys(data).length
    ? (await prisma.item.updateMany({ where: { userId, sku }, data })).count
    : await prisma.item.count({ where: { userId, sku } });

  // Recalcula a divergência do representativo após salvar.
  const itens = await prisma.item.findMany({
    where: { userId, sku },
    select: { precoDe: true, precoPor: true, frete: true, largura: true, altura: true, comprimento: true, pesoReal: true },
  });

  // Medidas efetivas do SKU (primeiro valor não nulo), como na lista de produtos.
  const merged = {};
  for (const campo of CAMPOS_MEDIDAS) {
    merged[campo] = itens.find((it) => it[campo] != null)?.[campo] ?? null;
  }

  const comFrete = itens.filter((it) => it.frete != null);
  const rep = (comFrete.length ? comFrete : itens).slice().sort((a, b) => basePreco(b) - basePreco(a))[0];
  const div = rep ? avaliaDivergencia({ ...rep, ...merged }) : null;
  const tam = classificarTamanhoFull(merged.largura, merged.altura, merged.comprimento, merged.pesoReal);

  return { ...merged, afetados, comparacao: div, tamanho: tam ? tam.tamanho : null };
}

// Medidas atuais de um SKU (primeiro valor não nulo entre os anúncios dele).
// Usada pela balança: a página /medir (e o app) consultam o peso que o ESP32 gravou.
// Devolve null se nenhum anúncio da conta tem esse SKU.
export async function getSkuMedidas(userId, sku) {
  const itens = await prisma.item.findMany({
    where: { userId, sku },
    select: { largura: true, altura: true, comprimento: true, pesoReal: true },
  });
  if (itens.length === 0) return null;
  const pick = (campo) => itens.find((it) => it[campo] != null)?.[campo] ?? null;
  return {
    sku,
    afetados: itens.length,
    largura: pick("largura"),
    altura: pick("altura"),
    comprimento: pick("comprimento"),
    pesoReal: pick("pesoReal"),
  };
}