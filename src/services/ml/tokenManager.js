import connectionStore from "./connectionStore.js";
import oauthClient, { MlOAuthError } from "./oauthClient.js";

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // renova se faltar menos de 5 min
const FORCE_COOLDOWN_MS = 10 * 1000; // dois 401 seguidos não queimam dois refresh tokens

export class NotConnectedError extends Error {
  constructor(message = "Conecte sua conta do Mercado Livre.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

export class ReconnectRequiredError extends Error {
  constructor(message = "Sua conexão com o Mercado Livre expirou. Reconecte a conta.") {
    super(message);
    this.name = "ReconnectRequiredError";
  }
}

export function createTokenManager({ store, client, now = () => Date.now() }) {
  // Lock por usuário: quem chega durante um refresh em andamento aguarda a mesma promise.
  const inflight = new Map();

  function withLock(userId, fn) {
    const running = inflight.get(userId);
    if (running) return running;
    const p = (async () => {
      try {
        return await fn();
      } finally {
        inflight.delete(userId);
      }
    })();
    inflight.set(userId, p);
    return p;
  }

  function assertUsable(conn) {
    if (!conn || conn.status === "disconnected") throw new NotConnectedError();
    if (conn.status === "reconnect_required") throw new ReconnectRequiredError();
  }

  const expiresSoon = (conn, windowMs) => !conn.expiresAt || conn.expiresAt.getTime() - now() < windowMs;

  // Chama o ML e grava o resultado (inclusive o novo refresh token, por causa da rotação).
  async function doRefresh(userId, conn) {
    try {
      const tokens = await client.refresh(conn.refreshToken);
      await store.saveTokens(userId, { ...tokens, mlUserId: tokens.mlUserId ?? conn.mlUserId });
      return tokens.accessToken;
    } catch (e) {
      if (e instanceof MlOAuthError && e.code === "invalid_grant") {
        await store.markReconnectRequired(userId, "invalid_grant");
        throw new ReconnectRequiredError();
      }
      // Falha transitória (rede, 5xx...): mantém o status e só registra o erro.
      await store.setLastError(userId, e.message);
      throw e;
    }
  }

  // Renova dentro do lock, relendo a conexão: outro chamador pode já ter renovado.
  function refreshLocked(userId, shouldRefresh) {
    return withLock(userId, async () => {
      const conn = await store.get(userId);
      assertUsable(conn);
      if (!shouldRefresh(conn)) return conn.accessToken;
      return doRefresh(userId, conn);
    });
  }

  return {
    async getValidToken(userId) {
      const conn = await store.get(userId);
      assertUsable(conn);
      if (!expiresSoon(conn, SAFETY_MARGIN_MS)) return conn.accessToken;
      return refreshLocked(userId, (c) => expiresSoon(c, SAFETY_MARGIN_MS));
    },

    // Usado quando a API devolve 401: renova mesmo sem estar vencendo, salvo se acabou de renovar.
    forceRefresh(userId) {
      return refreshLocked(userId, (c) => !c.lastRefreshAt || now() - c.lastRefreshAt.getTime() >= FORCE_COOLDOWN_MS);
    },

    // Para o scheduler: renova só quem vence dentro de windowMs.
    async refreshIfExpiring(userId, windowMs) {
      const conn = await store.get(userId);
      assertUsable(conn);
      if (!expiresSoon(conn, windowMs)) return;
      await refreshLocked(userId, (c) => expiresSoon(c, windowMs));
    },
  };
}

export default createTokenManager({ store: connectionStore, client: oauthClient });
