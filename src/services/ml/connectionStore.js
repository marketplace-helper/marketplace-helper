import prisma from "../../config/prisma.js";
import { encrypt, decrypt } from "../../config/crypto.js";

// Persistência da conexão com o Mercado Livre (1 por usuário). Tokens são cifrados ao gravar
// e decifrados ao ler; quem usa este módulo sempre vê os tokens em texto puro.
export default {
  async get(userId) {
    const c = await prisma.mlConnection.findUnique({ where: { userId } });
    if (!c) return null;
    return {
      userId: c.userId,
      mlUserId: c.mlUserId,
      accessToken: decrypt(c.accessToken),
      refreshToken: decrypt(c.refreshToken),
      expiresAt: c.expiresAt,
      status: c.status,
      lastRefreshAt: c.lastRefreshAt,
      lastError: c.lastError,
    };
  },

  async saveTokens(userId, { accessToken, refreshToken, expiresIn, mlUserId }) {
    const nowMs = Date.now();
    const data = {
      accessToken: encrypt(accessToken),
      refreshToken: encrypt(refreshToken),
      expiresAt: new Date(nowMs + expiresIn * 1000),
      status: "active",
      lastRefreshAt: new Date(nowMs),
      lastError: null,
    };
    if (mlUserId != null) data.mlUserId = String(mlUserId);
    await prisma.mlConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },

  async markReconnectRequired(userId, reason) {
    await prisma.mlConnection.updateMany({ where: { userId }, data: { status: "reconnect_required", lastError: reason } });
  },

  async setLastError(userId, msg) {
    await prisma.mlConnection.updateMany({ where: { userId }, data: { lastError: msg } });
  },

  async disconnect(userId) {
    await prisma.mlConnection.updateMany({
      where: { userId },
      data: { accessToken: null, refreshToken: null, expiresAt: null, status: "disconnected" },
    });
  },

  async findExpiringBefore(date) {
    const rows = await prisma.mlConnection.findMany({
      where: { status: "active", expiresAt: { lt: date } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },

  async findUserIdByMlUserId(mlUserId) {
    const c = await prisma.mlConnection.findFirst({
      where: { mlUserId: String(mlUserId), status: "active" },
      select: { userId: true },
    });
    return c ? c.userId : null;
  },

  async listActiveUserIds() {
    const rows = await prisma.mlConnection.findMany({ where: { status: "active" }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },
};
