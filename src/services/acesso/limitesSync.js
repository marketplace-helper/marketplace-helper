import { consumirSyncManual } from "./plano.js";

// Decisões de sincronização por plano (funções puras).

export const MSG_TESTE_EXPIRADO = "Seu período de teste terminou. As atualizações voltam quando a conta for liberada.";
const msgLimiteDiario = (n) => `Você já usou as ${n} atualizações de hoje do modo teste. Tente amanhã.`;

// No teste, só os primeiros `max` anúncios entram (antes de buscar detalhes no ML).
export function cortarAnuncios(ids, situacao, max) {
  return situacao.emTeste ? ids.slice(0, max) : ids;
}

// origem "manual" (botão/API) ou "auto" (agendamento, notificações do ML).
// Permitido: { permitido: true, dadosSettings } — dadosSettings é o contador a gravar (ou null).
// Negado: { permitido: false, motivo } — motivo "auto" não é mostrado a ninguém.
export function decidirSync({ situacao, origem, settings, agora, limites, timezone }) {
  if (!situacao.podeSincronizar) return { permitido: false, motivo: MSG_TESTE_EXPIRADO };
  if (origem === "auto" && !situacao.podeAutoSync) return { permitido: false, motivo: "auto" };
  if (situacao.emTeste && origem === "manual") {
    const r = consumirSyncManual(settings, { agora, timezone, limite: limites.syncsDia });
    if (!r.permitido) return { permitido: false, motivo: msgLimiteDiario(limites.syncsDia) };
    return { permitido: true, dadosSettings: r.dados };
  }
  return { permitido: true, dadosSettings: null };
}
