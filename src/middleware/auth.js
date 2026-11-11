import { getUserById } from "../services/accountService.js";
import prisma from "../config/prisma.js";

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
  req.user = user;
  res.locals.user = user;

  // Última sincronização (para a navbar)
  const s = await prisma.settings.findUnique({
    where: { userId: user.id },
    select: { lastSyncAt: true },
  });
  res.locals.lastSyncAt = s?.lastSyncAt || null;

  next();
}
