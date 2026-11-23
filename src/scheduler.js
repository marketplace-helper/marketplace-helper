import cron from "node-cron";
import connectionStore from "./services/ml/connectionStore.js";
import { config } from "./config/env.js";
import tokenManager from "./services/ml/tokenManager.js";
import { runSync } from "./services/syncService.js";

// Sincroniza os anúncios de todos os usuários que já autorizaram o ML.
async function syncAllUsers() {
  const userIds = await connectionStore.listActiveUserIds();
  console.log(`[CRON] Sincronizando ${userIds.length} conta(s)...`);
  for (const userId of userIds) {
    try {
      await runSync(userId); // roda em background (não bloqueia)
    } catch (e) {
      console.error(`[CRON] erro no usuário ${userId}:`, e.message);
    }
  }
}

const REFRESH_WINDOW_MS = 30 * 60_000;

// Renova, antes de vencer, os tokens que expiram nos próximos 30 minutos.
async function refreshExpiringTokens() {
  const userIds = await connectionStore.findExpiringBefore(new Date(Date.now() + REFRESH_WINDOW_MS));
  for (const userId of userIds) {
    try {
      await tokenManager.refreshIfExpiring(userId, REFRESH_WINDOW_MS);
    } catch (e) {
      console.error(`[CRON-ML] falha ao renovar o usuário ${userId}:`, e.message);
    }
  }
  if (userIds.length) console.log(`[CRON-ML] ${userIds.length} conexão(ões) verificada(s).`);
}

// Agenda a sincronização para meia-noite (00:00) e meio-dia (12:00), no fuso
// configurado (padrão America/Sao_Paulo), independente do relógio do servidor.
export function startScheduler() {
  cron.schedule(
    "0 0,12 * * *",
    () => {
      console.log(
        "[CRON] Disparo agendado (" +
          new Date().toLocaleString("pt-BR", { timeZone: config.timezone }) +
          ")"
      );
      syncAllUsers();
    },
    { timezone: config.timezone }
  );
  cron.schedule("*/10 * * * *", () => {
    refreshExpiringTokens().catch((e) => console.error("[CRON-ML] erro:", e.message));
  });
  console.log(`  Sincronização automática agendada para 00:00 e 12:00 (${config.timezone}).`);
}
