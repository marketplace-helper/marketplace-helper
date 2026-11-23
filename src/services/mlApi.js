import tokenManager from "./ml/tokenManager.js";

const API = "https://api.mercadolibre.com";

// Cache de categorias (nao e por usuario - categorias sao globais no ML)
const categoryCache = new Map();

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET com retry. Nao repete em 4xx (definitivo); repete em 429/5xx/rede.
// Em 401 renova o token (uma vez) e repete; segundo 401 devolve null.
// NotConnectedError/ReconnectRequiredError do tokenManager propagam.
export function createApiGet({ fetch = globalThis.fetch, tokenManager, sleep = defaultSleep }) {
  return async function apiGet(userId, url, { retries = 3, delay = 800 } = {}) {
    let token = await tokenManager.getValidToken(userId);
    let refreshed = false;
    for (let attempt = 0; attempt < retries; attempt++) {
      let res;
      try {
        res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        await sleep(delay);
        continue;
      }
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        // fora do try: erros de reconexao devem propagar
        token = await tokenManager.forceRefresh(userId);
        attempt--; // a repeticao apos o refresh nao consome tentativa
        continue;
      }
      try {
        if (res.status === 429) {
          await sleep(5000);
          continue;
        }
        if (res.status >= 400 && res.status < 500) return null;
        if (!res.ok) {
          await sleep(delay);
          continue;
        }
        return await res.json();
      } catch (e) {
        await sleep(delay);
      }
    }
    return null;
  };
}

const apiGet = createApiGet({ tokenManager });
export { apiGet };

// ML user_id do vendedor autenticado
export async function getMlUserId(userId) {
  const data = await apiGet(userId, `${API}/users/me`);
  if (!data?.id) throw new Error("Não foi possível obter o usuário autenticado.");
  return data.id;
}

// Dados do perfil ML (para a tela de conta): foto, nickname, reputacao, etc.
export async function getMlProfile(userId) {
  const data = await apiGet(userId, `${API}/users/me`);
  if (!data) return null;
  const rep = data.seller_reputation || {};
  return {
    id: data.id,
    nickname: data.nickname || null,
    photo: data.thumbnail?.picture_url || data.logo || null,
    points: data.points ?? null,
    permalink: data.permalink || null,
    registrationDate: data.registration_date || null,
    userType: data.user_type || null,
    reputationLevel: rep.level_id || null,
    salesCompleted: rep.metrics?.sales?.completed ?? null,
    salesPeriod: rep.metrics?.sales?.period || null,
  };
}

// Todos os MLBs do vendedor (paginacao scan)
export async function getAllItemIds(userId, mlUserId, onProgress) {
  const ids = [];
  let scrollId = null;

  do {
    const params = new URLSearchParams({ search_type: "scan", limit: "100" });
    if (scrollId) params.set("scroll_id", scrollId);

    const data = await apiGet(
      userId,
      `${API}/users/${mlUserId}/items/search?${params.toString()}`
    );
    if (!data) break;

    const results = data.results || [];
    ids.push(...results);
    scrollId = data.scroll_id;

    if (onProgress) onProgress(ids.length, data.paging?.total);
    if (results.length === 0) break;
  } while (scrollId);

  return ids;
}

// Detalhes de varios itens (multiget, 20 por chamada)
export async function getItemsDetails(userId, mlbs) {
  const chunks = chunk(mlbs, 20);
  const items = [];
  for (const group of chunks) {
    const data = await apiGet(
      userId,
      `${API}/items?ids=${group.join(",")}&include_attributes=all`
    );
    if (!data) continue;
    for (const entry of data) {
      if (entry.code === 200 && entry.body) items.push(entry.body);
    }
  }
  return items;
}

// IDs dos anúncios (MLB) de um pedido
export async function getOrderItemIds(userId, orderId) {
  const data = await apiGet(userId, `${API}/orders/${orderId}`);
  return (data?.order_items || []).map((oi) => oi?.item?.id).filter(Boolean);
}

// Visitas de UM item (o endpoint /visits/items aceita apenas 1 id por chamada).
// Retorna o total de visitas, ou null se a consulta falhar.
export async function getItemVisits(userId, mlb) {
  const data = await apiGet(userId, `${API}/visits/items?ids=${mlb}`);
  if (data && typeof data === "object" && mlb in data) {
    return Number(data[mlb]) || 0;
  }
  return null;
}

// Custo de frete (com fallback por faixa de preco para itens baratos)
export async function getShippingCost(userId, mlb, zipCode, price) {
  const data = await apiGet(
    userId,
    `${API}/items/${mlb}/shipping_options?zip_code=${zipCode}`,
    { retries: 4, delay: 1000 }
  );
  if (data?.options?.length) {
    const opt = data.options[0];
    const cost = opt.list_cost ?? opt.cost ?? opt.base_cost ?? fallbackByPrice(price);
    if (cost != null) return Number(cost);
  }
  return fallbackByPrice(price);
}

function fallbackByPrice(price) {
  const p = Number(price) || 0;
  if (p <= 18.99) return 6.9;
  if (p <= 48.99) return 8.8;
  if (p <= 78.99) return 9.9;
  return null;
}

// Precos/promocoes do item
export async function getItemPrices(userId, mlb) {
  const data = await apiGet(userId, `${API}/items/${mlb}/prices`, { retries: 2 });
  return data?.prices || [];
}

// Comissao (tarifa de venda): sale_fee_amount + percentage_fee
export async function getListingFee(userId, price, listingTypeId, categoryId) {
  const p = Number(price) || 0;
  if (!p || !listingTypeId) return null;
  const params = new URLSearchParams({ price: String(p), listing_type_id: listingTypeId });
  if (categoryId) params.set("category_id", categoryId);

  const data = await apiGet(
    userId,
    `${API}/sites/MLB/listing_prices?${params.toString()}`,
    { retries: 3, delay: 800 }
  );
  if (!data || data.sale_fee_amount == null) return null;
  return {
    amount: Number(data.sale_fee_amount),
    pct: data.sale_fee_details?.percentage_fee ?? null,
    fixed: data.sale_fee_details?.fixed_fee ?? null,
  };
}

// Caminho de categoria (com cache)
export async function getCategoryPath(userId, categoryId) {
  if (!categoryId) return [];
  if (categoryCache.has(categoryId)) return categoryCache.get(categoryId);
  const data = await apiGet(userId, `${API}/categories/${categoryId}`);
  const path = data?.path_from_root || [];
  categoryCache.set(categoryId, path);
  return path;
}

// ================= helpers =================
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function mapListingType(type) {
  if (type === "gold_special") return "CLASSICO";
  if (type === "gold_pro") return "PREMIUM";
  if (type === "free") return "Gratis";
  return "Nao identificado";
}

export function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d)) return "N/A";
  return d.toLocaleDateString("pt-BR");
}
