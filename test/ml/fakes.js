import { MlOAuthError } from "../../src/services/ml/oauthClient.js";

// Store em memória com a mesma interface do connectionStore (sem tocar no banco).
export function createFakeStore({ now = () => Date.now() } = {}) {
  const rows = new Map();
  return {
    rows,
    async get(userId) {
      const r = rows.get(userId);
      return r ? { ...r } : null;
    },
    async saveTokens(userId, { accessToken, refreshToken, expiresIn, mlUserId }) {
      const prev = rows.get(userId) || {};
      rows.set(userId, {
        ...prev,
        userId,
        mlUserId: mlUserId ?? prev.mlUserId ?? null,
        accessToken,
        refreshToken,
        expiresAt: new Date(now() + expiresIn * 1000),
        status: "active",
        lastRefreshAt: new Date(now()),
        lastError: null,
      });
    },
    async markReconnectRequired(userId, reason) {
      const r = rows.get(userId);
      if (r) rows.set(userId, { ...r, status: "reconnect_required", lastError: reason });
    },
    async setLastError(userId, msg) {
      const r = rows.get(userId);
      if (r) rows.set(userId, { ...r, lastError: msg });
    },
    async disconnect(userId) {
      const r = rows.get(userId);
      if (r) rows.set(userId, { ...r, accessToken: null, refreshToken: null, expiresAt: null, status: "disconnected" });
    },
    async findExpiringBefore(date) {
      return [...rows.values()].filter((r) => r.status === "active" && r.expiresAt && r.expiresAt < date).map((r) => r.userId);
    },
    async findUserIdByMlUserId(mlUserId) {
      const r = [...rows.values()].find((x) => x.mlUserId === mlUserId && x.status === "active");
      return r ? r.userId : null;
    },
    async listActiveUserIds() {
      return [...rows.values()].filter((r) => r.status === "active").map((r) => r.userId);
    },
  };
}

// Cliente OAuth falso: conta chamadas de refresh e simula latência de rede.
export function createFakeClient({ refreshError = null } = {}) {
  const client = {
    refreshCalls: 0,
    async refresh() {
      client.refreshCalls++;
      await new Promise((r) => setTimeout(r, 20));
      if (refreshError) throw refreshError;
      return { accessToken: "novo-access", refreshToken: "novo-refresh", expiresIn: 21600, mlUserId: "123" };
    },
  };
  return client;
}

export { MlOAuthError };

// Tentativas de OAuth em memória, com a mesma semântica do adapter Prisma:
// consume só devolve a tentativa se ainda não foi usada nem expirou.
export function createFakeAttempts({ now = () => Date.now() } = {}) {
  const rows = new Map();
  return {
    rows,
    async create({ nonce, userId, codeVerifier, client, expiresAt }) {
      rows.set(nonce, { nonce, userId, codeVerifier, client, expiresAt, usedAt: null });
    },
    async consume(nonce) {
      const r = rows.get(nonce);
      if (!r || r.usedAt || r.expiresAt.getTime() <= now()) return null;
      r.usedAt = new Date(now());
      return { ...r };
    },
  };
}

// Cliente OAuth falso para a troca do code.
export function createFakeExchangeClient({ error = null } = {}) {
  const client = {
    exchangeCalls: [],
    async exchangeCode(args) {
      client.exchangeCalls.push(args);
      if (error) throw error;
      return { accessToken: "acc", refreshToken: "ref", expiresIn: 21600, mlUserId: "999" };
    },
  };
  return client;
}
