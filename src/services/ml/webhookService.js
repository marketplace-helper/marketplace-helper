import connectionStore from "./connectionStore.js";
import { createSyncQueue } from "./syncQueue.js";
import { getOrderItemIds as getOrderItemIdsDefault } from "../mlApi.js";
import { runSync, getSyncState } from "../syncService.js";
import { config } from "../../config/env.js";
import prisma from "../../config/prisma.js";
import { situacaoDoPlano } from "../acesso/plano.js";

const TOPICOS = new Set(["items", "orders_v2"]);

// Processa uma notificação do ML. Nunca lança: devolve "enfileirado" ou "ignorado".
export function createWebhookService({ appId, store, queue, getOrderItemIds, podeAutoSync = async () => true }) {
  async function handle(body) {
    try {
      if (!body || typeof body !== "object") return "ignorado";
      if (String(body.application_id) !== String(appId)) return "ignorado";
      if (!TOPICOS.has(body.topic)) return "ignorado";
      if (body.user_id == null) return "ignorado";
      const resource = typeof body.resource === "string" ? body.resource : "";

      const userId = await store.findUserIdByMlUserId(String(body.user_id));
      if (userId == null) return "ignorado";
      // Contas em modo teste (ou bloqueadas) não recebem atualização automática.
      if (!(await podeAutoSync(userId))) return "ignorado";

      let mlbs;
      if (body.topic === "items") {
        const m = resource.match(/^\/items\/(MLB\d+)$/i);
        if (!m) return "ignorado";
        mlbs = [m[1].toUpperCase()];
      } else {
        const m = resource.match(/^\/orders\/(\d+)$/);
        if (!m) return "ignorado";
        mlbs = await getOrderItemIds(userId, m[1]);
      }
      if (!mlbs?.length) return "ignorado";
      queue.enqueue(userId, mlbs);
      return "enfileirado";
    } catch (e) {
      console.error("[ML webhook] falha ao processar notificação:", e?.message || e);
      return "ignorado";
    }
  }
  return { handle };
}

export default createWebhookService({
  appId: config.ml.appId,
  store: connectionStore,
  queue: createSyncQueue({ runSync, getSyncState }),
  getOrderItemIds: getOrderItemIdsDefault,
  podeAutoSync: async (userId) =>
    situacaoDoPlano(await prisma.user.findUnique({ where: { id: userId } })).podeAutoSync,
});
