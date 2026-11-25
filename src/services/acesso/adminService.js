import prismaDefault from "../../config/prisma.js";
import { config as configDefault } from "../../config/env.js";
import { sendTemplateEmail as sendDefault, TEMPLATES } from "../mailService.js";
import * as tokensDefault from "../emailAuthService.js";
import { PLANOS } from "./plano.js";

// Liberação de contas pelos administradores, por links enviados por e-mail.
// O link abre uma página de confirmação (GET, só leitura); a ação só acontece no POST.
// Isso impede que antivírus/leitores de e-mail que "abrem" links aprovem alguém sozinhos.

const ACOES = {
  LIBERAR: { tipo: "ADMIN_LIBERAR", plano: PLANOS.COMPLETO },
  BLOQUEAR: { tipo: "ADMIN_BLOQUEAR", plano: PLANOS.BLOQUEADO },
};

export function createAdminService({ prisma, tokens, sendTemplateEmail, config }) {
  const urlDaAcao = (token) => `${config.appUrl}/admin/contas/acao?token=${token}`;

  // Um e-mail para todos os admins. Retorna false (sem enviar) se ADMIN_EMAILS estiver vazio.
  async function avisarAdmins(user, motivo) {
    if (!config.adminEmails?.length) return false;
    const liberar = await tokens.issueToken(user.id, ACOES.LIBERAR.tipo);
    const bloquear = await tokens.issueToken(user.id, ACOES.BLOQUEAR.tipo);
    await sendTemplateEmail({
      to: config.adminEmails,
      template: TEMPLATES.ADMIN_CONTA,
      variables: {
        STORE_NAME: user.storeName,
        EMAIL: user.email,
        WHATSAPP: user.whatsapp || "—",
        MOTIVO: motivo,
        LIBERAR_URL: urlDaAcao(liberar.token),
        BLOQUEAR_URL: urlDaAcao(bloquear.token),
      },
      idempotencyKey: `admin-conta/${liberar.record.id}`,
    });
    return true;
  }

  async function acharAcao(token) {
    if (!token || typeof token !== "string") return null;
    for (const [acao, { tipo }] of Object.entries(ACOES)) {
      const record = await tokens.findValidToken(token, tipo);
      if (record) return { acao, record };
    }
    return null;
  }

  // Só leitura: para a página de confirmação.
  async function verAcao(token) {
    const achada = await acharAcao(token);
    if (!achada) return null;
    const user = await prisma.user.findUnique({ where: { id: achada.record.userId } });
    return user ? { acao: achada.acao, user } : null;
  }

  async function aplicarAcao(token) {
    const achada = await acharAcao(token);
    if (!achada || !(await tokens.consumeToken(achada.record))) return { ok: false };
    const user = await prisma.user.update({
      where: { id: achada.record.userId },
      data: { plano: ACOES[achada.acao].plano },
    });
    if (achada.acao === "LIBERAR") {
      await sendTemplateEmail({
        to: user.email,
        template: TEMPLATES.CONTA_LIBERADA,
        variables: { STORE_NAME: user.storeName, ACTION_URL: `${config.appUrl}/login` },
        idempotencyKey: `conta-liberada/${achada.record.id}`,
      }).catch((e) => console.error("[admin] aviso de conta liberada falhou:", e.message));
    }
    return { ok: true, acao: achada.acao, user };
  }

  return { avisarAdmins, verAcao, aplicarAcao };
}

export default createAdminService({
  prisma: prismaDefault,
  tokens: tokensDefault,
  sendTemplateEmail: sendDefault,
  config: configDefault,
});
