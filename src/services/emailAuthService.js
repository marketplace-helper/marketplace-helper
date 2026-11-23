import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { config } from "../config/env.js";
import { sendTemplateEmail, TEMPLATES } from "./mailService.js";

// Confirmação de cadastro e recuperação de senha por link enviado por e-mail.
// O token puro só existe no link; no banco fica o hash SHA-256 (se o banco vazar,
// os links não podem ser reconstruídos).

const TOKEN_TTL_MS = {
  VERIFY: 24 * 60 * 60 * 1000, // 24h
  RESET: 60 * 60 * 1000, // 1h
  EMAIL_CHANGE: 24 * 60 * 60 * 1000, // 24h
};

const ROUTES = {
  VERIFY: "/confirmar-email",
  RESET: "/redefinir-senha",
  EMAIL_CHANGE: "/confirmar-novo-email",
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Gera um novo token, invalidando os anteriores do mesmo tipo (só o link mais recente vale).
async function issueToken(userId, type) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const [, record] = await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[type]),
      },
    }),
  ]);
  return { token, record };
}

// Intervalo mínimo entre dois e-mails do mesmo tipo para o mesmo usuário
// (evita usar o formulário para lotar a caixa de alguém).
const RESEND_COOLDOWN_MS = 60 * 1000;

async function inCooldown(userId, type) {
  const recent = await prisma.authToken.findFirst({
    where: { userId, type, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    select: { id: true },
  });
  return Boolean(recent);
}

/**
 * Envia o link. Retorna false (sem enviar) se já houve um envio há menos de 60s.
 * `to` permite mandar para outro endereço (troca de e-mail vai para o novo).
 */
async function sendTokenEmail(user, type, to = user.email) {
  if (await inCooldown(user.id, type)) return false;

  const { token, record } = await issueToken(user.id, type);
  const actionUrl = `${config.appUrl}${ROUTES[type]}?token=${token}`;
  await sendTemplateEmail({
    to,
    template: TEMPLATES[type],
    variables: { STORE_NAME: user.storeName, ACTION_URL: actionUrl },
    // Uma chave por token emitido: retries do mesmo envio não duplicam,
    // e um novo pedido (novo token) gera um novo e-mail.
    idempotencyKey: `${type.toLowerCase()}-email/${record.id}`,
  });
  return true;
}

// Retorna o registro do token se ele for válido (existe, do tipo certo, não usado, não expirado).
async function findValidToken(token, type) {
  if (!token || typeof token !== "string") return null;
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  return record;
}

// Marca o token como usado de forma atômica: se duas requisições chegarem juntas,
// só uma consegue (a outra vê count = 0).
async function consumeToken(record) {
  const { count } = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

// ===== Confirmação de cadastro =====

export function sendVerificationEmail(user) {
  return sendTokenEmail(user, "VERIFY");
}

/** Confirma o e-mail. Retorna true se o token era válido. */
export async function verifyEmail(token) {
  const record = await findValidToken(token, "VERIFY");
  if (!record || !(await consumeToken(record))) return false;
  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: new Date() },
  });
  return true;
}

// ===== Recuperação de senha =====

export function sendPasswordResetEmail(user) {
  return sendTokenEmail(user, "RESET");
}

/** Só checa se o link ainda vale (para decidir se mostra o formulário). */
export async function isResetTokenValid(token) {
  return Boolean(await findValidToken(token, "RESET"));
}

/** Troca a senha usando o token. Retorna true se deu certo. */
export async function resetPassword(token, newPassword) {
  const record = await findValidToken(token, "RESET");
  if (!record || !(await consumeToken(record))) return false;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: record.userId },
    // Quem recebeu o link de reset provou que controla o e-mail.
    data: { passwordHash, emailVerifiedAt: new Date() },
  });
  return true;
}

// ===== Troca de e-mail =====

export class EmailChangeError extends Error {}

/**
 * Inicia a troca: guarda o novo endereço como pendente e manda o link para ele.
 * O e-mail atual só muda quando o link for clicado.
 */
export async function requestEmailChange(user, newEmail) {
  const email = newEmail.toLowerCase().trim();
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) throw new EmailChangeError("Esse e-mail já está em uso por outra conta.");
  if (await inCooldown(user.id, "EMAIL_CHANGE")) {
    throw new EmailChangeError("Acabamos de enviar um link. Aguarde um minuto para pedir de novo.");
  }
  await prisma.user.update({ where: { id: user.id }, data: { pendingEmail: email } });
  await sendTokenEmail(user, "EMAIL_CHANGE", email);
}

/** Desiste da troca pendente e invalida o link enviado. */
export async function cancelEmailChange(userId) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { pendingEmail: null } }),
    prisma.authToken.updateMany({
      where: { userId, type: "EMAIL_CHANGE", usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}

/** Confirma a troca. Retorna o novo e-mail, ou lança EmailChangeError. */
export async function confirmEmailChange(token) {
  const invalid = "Link de troca de e-mail inválido ou expirado.";
  const record = await findValidToken(token, "EMAIL_CHANGE");
  if (!record) throw new EmailChangeError(invalid);
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user?.pendingEmail) throw new EmailChangeError(invalid);

  // Alguém pode ter se cadastrado com esse endereço enquanto o link estava pendente.
  const taken = await prisma.user.findUnique({ where: { email: user.pendingEmail }, select: { id: true } });
  if (taken) {
    await cancelEmailChange(user.id);
    throw new EmailChangeError("Esse e-mail passou a ser usado por outra conta. A troca foi cancelada.");
  }
  if (!(await consumeToken(record))) throw new EmailChangeError(invalid);

  await prisma.user.update({
    where: { id: user.id },
    data: { email: user.pendingEmail, pendingEmail: null, emailVerifiedAt: new Date() },
  });
  return user.pendingEmail;
}
