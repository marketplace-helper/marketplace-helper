import cron from "node-cron";
import connectionStore from "./services/ml/connectionStore.js";
import { config } from "./config/env.js";
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
  console.log(`  Sincronização automática agendada para 00:00 e 12:00 (${config.timezone}).`);
}
