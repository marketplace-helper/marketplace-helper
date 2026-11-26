import { getUserById } from "../services/accountService.js";
import prisma from "../config/prisma.js";
import { config } from "../config/env.js";
import { situacaoDoPlano, MSG_BLOQUEADO } from "../services/acesso/plano.js";

// Exige login. Carrega o usuario em req.user e res.locals.user (para as views).
export async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  const user = await getUserById(req.session.userId);
  if (!user) {
    req.session = null;
    return res.redirect("/login");
  }
  if (!user.emailVerifiedAt) {
    req.session = null;
    return res.redirect("/login?error=" + encodeURIComponent("Confirme seu e-mail antes de entrar."));
  }
  const situacao = situacaoDoPlano(user);
  if (!situacao.podeEntrar) {
    req.session = null;
    return res.redirect("/login?error=" + encodeURIComponent(MSG_BLOQUEADO));
  }
  req.user = user;
  req.situacaoPlano = situacao;
  res.locals.user = user;
  res.locals.situacaoPlano = situacao;
  res.locals.limitesTeste = config.teste;

  // Última sincronização (para a navbar)
  const s = await prisma.settings.findUnique({
    where: { userId: user.id },
    select: { lastSyncAt: true },
  });
  res.locals.lastSyncAt = s?.lastSyncAt || null;

  // Status da conexão com o ML (para o banner "Reconectar")
  const conn = await prisma.mlConnection.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  res.locals.mlStatus = conn?.status || "disconnected";

  next();
}
