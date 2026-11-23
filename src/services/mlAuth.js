import tokenManager from "./ml/tokenManager.js";
import connectionStore from "./ml/connectionStore.js";

// Retorna um access_token valido (renova se necessario)
export function getValidToken(userId) {
  return tokenManager.getValidToken(userId);
}

// Status para a UI (nunca expoe tokens)
export async function getAuthStatus(userId) {
  const conn = await connectionStore.get(userId);
  const status = conn?.status || "disconnected";
  return {
    authenticated: status === "active",
    status,
    reconnectRequired: status === "reconnect_required",
    mlUserId: conn?.mlUserId || null,
    expiresAt: conn?.expiresAt || null,
  };
}
