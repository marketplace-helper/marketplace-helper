import prisma from "../config/prisma.js";
import {
  getMlUserId,
  getAllItemIds,
  getItemsDetails,
  getItemVisits,
  getShippingCost,
  getItemPrices,
  getListingFee,
  getCategoryPath,
  mapListingType,
  formatDate,
} from "./mlApi.js";
import { filtrarItensDoVendedor } from "./ml/sellerFilter.js";
import connectionStore from "./ml/connectionStore.js";
import { ReconnectRequiredError, NotConnectedError } from "./ml/tokenManager.js";
import { config } from "../config/env.js";
import { situacaoDoPlano } from "./acesso/plano.js";
import { cortarAnuncios, decidirSync } from "./acesso/limitesSync.js";

// Estado de progresso por usuario (userId -> state)
const syncStates = new Map();

function idleState() {
  return {
    running: false,
    phase: "idle",
    escopo: null,
    totalIds: 0,
    processed: 0,
    novos: 0,
    atualizados: 0,
    fretesMudaram: 0,
    startedAt: null,
    finishedAt: null,
    error: null,
  };
}

export function getSyncState(userId) {
  return syncStates.get(userId) || idleState();
}

// ================= parsing =================
function parseAttributes(data) {
  const attrs = data.attributes || [];
  const findAttr = (id) => attrs.find((a) => a.id === id)?.value_name;

  let sku = data.seller_custom_field || findAttr("SELLER_SKU") || null;
  const marca = findAttr("BRAND") || null;

  const variacaoIds = new Set();
  const variacaoSkus = new Set();
  for (const v of data.variations || []) {
    if (v.id) variacaoIds.add(String(v.id));
    if (v.seller_custom_field) variacaoSkus.add(v.seller_custom_field);
    for (const a of v.attributes || []) {
      if (a.id === "SELLER_SKU" && a.value_name) variacaoSkus.add(a.value_name);
    }
  }
  return {
    sku,
    marca,
    variacaoIds: [...variacaoIds].join(", ") || null,
    variacaoSkus: [...variacaoSkus].join(", ") || null,
  };
}

function promoAtiva(p) {
  const now = Date.now();
  const s = p.conditions?.start_time ? Date.parse(p.conditions.start_time) : -Infinity;
  const e = p.conditions?.end_time ? Date.parse(p.conditions.end_time) : Infinity;
  return now >= s && now <= e;
}

function parsePrices(data, pricesList) {
  const itemPrice = Number(data.price) || 0;
  const list = Array.isArray(pricesList) ? pricesList : [];

  const standard = list.find((p) => p.type === "standard");
  const normal = standard ? Number(standard.amount) : itemPrice;

  const promos = list
    .filter((p) => p.type !== "standard" && Number(p.amount) > 0 && promoAtiva(p))
    .sort((a, b) => Number(a.amount) - Number(b.amount));
  const promo = promos[0];

  if (promo && Number(promo.amount) < normal) {
    const por = Number(promo.amount);
    return { precoDe: normal, precoPor: por, priceNum: por };
  }

  const original = data.original_price != null ? Number(data.original_price) : null;
  if (original != null && original > itemPrice) {
    return { precoDe: original, precoPor: itemPrice, priceNum: itemPrice };
  }
  return { precoDe: normal, precoPor: 0, priceNum: normal };
}

// ================= sync =================
// origem "manual" (botão/API) conta no limite diário do modo teste; "auto" (agendamento e
// notificações do ML) só roda para contas com uso completo. Negado: retorna { negado: motivo }.
export async function runSync(userId, mlbs = null, { origem = "manual" } = {}) {
  const current = syncStates.get(userId);
  if (current?.running) return current;

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getSettings(userId),
  ]);
  const situacao = situacaoDoPlano(user);
  const decisao = decidirSync({
    situacao, origem, settings, agora: new Date(), limites: config.teste, timezone: config.timezone,
  });
  if (!decisao.permitido) return { ...idleState(), negado: decisao.motivo };
  // Pode ter começado outro sync enquanto lia o banco. Daqui até syncStates.set não há
  // await, então um segundo pedido simultâneo sempre encontra este como "rodando".
  if (syncStates.get(userId)?.running) return syncStates.get(userId);

  const selection = Array.isArray(mlbs) && mlbs.length > 0 ? mlbs : null;

  const state = {
    ...idleState(),
    running: true,
    phase: "iniciando",
    escopo: selection ? "selecao" : "todos",
    totalIds: selection ? selection.length : 0,
    startedAt: new Date(),
  };
  syncStates.set(userId, state);

  if (decisao.dadosSettings) {
    // Falha ao gravar o contador não pode deixar o estado preso em "rodando".
    await prisma.settings
      .update({ where: { userId }, data: decisao.dadosSettings })
      .catch((e) => console.error("[SYNC] contador do modo teste não gravado:", e.message));
  }

  doSync(userId, selection, { situacao, max: config.teste.maxAnuncios }).catch((e) => {
    console.error("[SYNC] erro:", e);
    state.error = e.message;
    state.running = false;
    state.phase = "erro";
    state.finishedAt = new Date();
  });

  return state;
}

async function doSync(userId, selection, { situacao, max }) {
  const state = syncStates.get(userId);
  const settings = await getSettings(userId);
  const zip = settings.zipCode;

  let ids;
  if (selection) {
    ids = selection.map((m) => String(m).trim().toUpperCase());
    state.totalIds = ids.length;
  } else {
    state.phase = "buscando lista de anuncios";
    const mlUserId = await getMlUserId(userId);
    ids = await getAllItemIds(userId, mlUserId, (count, total) => {
      state.totalIds = total || count;
    });
    state.totalIds = ids.length;
  }

  // Modo teste: só os primeiros `max` anúncios (antes de chamar o ML para os detalhes).
  const cortados = cortarAnuncios(ids, situacao, max);
  if (cortados.length < ids.length) state.limiteTeste = max;
  ids = cortados;
  state.totalIds = ids.length;

  state.phase = "buscando detalhes";
  let details = await getItemsDetails(userId, ids);
  if (selection) {
    // Seleção vem de fora (webhook público, /sync/selection): só vale o que é do próprio vendedor.
    const conn = await connectionStore.get(userId);
    const mlUserId = conn?.mlUserId ?? (await getMlUserId(userId));
    details = filtrarItensDoVendedor(details, mlUserId);
  }

  state.phase = "processando";
  for (const data of details) {
    try {
      await upsertItem(userId, data, zip, state);
    } catch (e) {
      // Conexão revogada no meio do sync: encerra com erro em vez de fingir sucesso.
      if (e instanceof ReconnectRequiredError || e instanceof NotConnectedError) throw e;
      console.warn(`[SYNC] falha no item ${data?.id}: ${e.message}`);
    }
    state.processed++;
  }

  state.phase = "concluido";
  state.running = false;
  state.finishedAt = new Date();

  // Registra a última sincronização (para exibir na navbar)
  await prisma.settings
    .update({ where: { userId }, data: { lastSyncAt: state.finishedAt } })
    .catch(() => {});
}

async function upsertItem(userId, data, zip, state) {
  const mlb = data.id;
  const { sku, marca, variacaoIds, variacaoSkus } = parseAttributes(data);

  const pricesList = await getItemPrices(userId, mlb);
  const { precoDe, precoPor, priceNum } = parsePrices(data, pricesList);

  const path = await getCategoryPath(userId, data.category_id);
  const categoria1 = path[0]?.name || null;
  const categoria2 = path[1]?.name || null;
  const categoria3 = path[2]?.name || null;
  const categoria4 = path[3]?.name || null;

  const existing = await prisma.item.findUnique({
    where: { userId_mlb: { userId, mlb } },
  });

  // Frete: mantem o anterior se a consulta falhar agora
  const freteConsultado = await getShippingCost(userId, mlb, zip, priceNum);
  const frete = freteConsultado != null ? freteConsultado : existing?.frete ?? null;

  let freteAnterior = existing?.frete ?? null;
  let freteMudou = false;
  if (
    existing &&
    freteConsultado != null &&
    existing.frete != null &&
    freteConsultado !== existing.frete
  ) {
    freteMudou = true;
  }

  // Comissao: mantem anterior se falhar
  const fee = await getListingFee(userId, priceNum, data.listing_type_id, data.category_id);
  const comissao = fee ? fee.amount : existing?.comissao ?? null;
  const comissaoPct = fee ? fee.pct : existing?.comissaoPct ?? null;

  // Visitas (1 por chamada): mantem anterior se falhar
  const visitasConsultado = await getItemVisits(userId, mlb);
  const visitas = visitasConsultado != null ? visitasConsultado : existing?.visitas ?? 0;

  // Imagem de capa (prefere a foto em alta; cai pro thumbnail seguro)
  const thumbnail =
    data.pictures?.[0]?.secure_url ||
    data.secure_thumbnail ||
    data.thumbnail ||
    null;

  const payload = {
    proprio: true,
    variacaoIds,
    sku,
    variacaoSkus,
    marca,
    titulo: data.title || "",
    thumbnail,
    permalink: data.permalink || null,
    precoDe,
    precoPor,
    frete,
    freteAnterior,
    freteMudou,
    comissao,
    comissaoPct,
    status: data.status || null,
    dataCriacao: formatDate(data.date_created),
    tipoAnuncio: mapListingType(data.listing_type_id),
    visitas,
    vendas: data.sold_quantity || 0,
    estoque: data.available_quantity || 0,
    catalogo: !!data.catalog_listing,
    full: data.shipping?.logistic_type === "fulfillment",
    categoria1,
    categoria2,
    categoria3,
    categoria4,
  };

  const item = await prisma.item.upsert({
    where: { userId_mlb: { userId, mlb } },
    update: payload,
    create: { userId, mlb, ...payload },
  });

  if (frete != null) {
    const last = await prisma.shippingHistory.findFirst({
      where: { itemId: item.id },
      orderBy: { capturedAt: "desc" },
    });
    if (!last || last.cost !== frete) {
      await prisma.shippingHistory.create({ data: { itemId: item.id, mlb, cost: frete } });
    }
  }

  if (existing) {
    state.atualizados++;
    if (freteMudou) state.fretesMudaram++;
  } else {
    state.novos++;
  }
}

// ================= Settings (por usuario) =================
export async function getSettings(userId) {
  let s = await prisma.settings.findUnique({ where: { userId } });
  if (!s) s = await prisma.settings.create({ data: { userId } });
  return s;
}

export async function updateZipCode(userId, zipCode) {
  const clean = String(zipCode).replace(/\D/g, "") || "01001000";
  return prisma.settings.upsert({
    where: { userId },
    update: { zipCode: clean },
    create: { userId, zipCode: clean },
  });
}
