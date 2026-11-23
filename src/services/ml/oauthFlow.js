import { randomBytes } from "node:crypto";
import prisma from "../../config/prisma.js";
import { config } from "../../config/env.js";
import { encrypt, decrypt } from "../../config/crypto.js";
import { createPkcePair } from "./pkce.js";
import { signState, verifyState } from "./oauthState.js";
import oauthClient from "./oauthClient.js";
import connectionStore from "./connectionStore.js";

const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const ATTEMPT_TTL_MS = 10 * 60 * 1000;

const MSG = {
  ok: "Conta do Mercado Livre conectada!",
  expired: "O link de autorização expirou. Tente conectar de novo.",
  denied: "Autorização cancelada no Mercado Livre.",
  alreadyLinked: "Esta conta do Mercado Livre já está conectada a outro usuário.",
  failed: "Não foi possível conectar ao Mercado Livre. Tente de novo.",
};

// Adapter Prisma das tentativas de autorização. O codeVerifier fica cifrado no banco.
export const prismaAttempts = {
  async create({ nonce, userId, codeVerifier, client, expiresAt }) {
    await prisma.mlOAuthAttempt.create({
      data: { nonce, userId, codeVerifier: encrypt(codeVerifier), client, expiresAt },
    });
  },

  // Uso único: o updateMany condicional é atômico, então só uma chamada concorrente "ganha".
  async consume(nonce, now = new Date()) {
    const { count } = await prisma.mlOAuthAttempt.updateMany({
      where: { nonce, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count !== 1) return null;
    const a = await prisma.mlOAuthAttempt.findUnique({ where: { nonce } });
    if (!a) return null;
    return { ...a, codeVerifier: decrypt(a.codeVerifier) };
  },
};

export function createOAuthFlow({
  attempts = prismaAttempts,
  client = oauthClient,
  store = connectionStore,
  now = () => Date.now(),
  appId = config.ml.appId,
  redirectUri = config.ml.redirectUri,
} = {}) {
  async function startAuthorization(userId, clientType) {
    const nonce = randomBytes(16).toString("hex");
    const { verifier, challenge } = createPkcePair();
    await attempts.create({
      nonce,
      userId,
      codeVerifier: verifier,
      client: clientType,
      expiresAt: new Date(now() + ATTEMPT_TTL_MS),
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: appId,
      redirect_uri: redirectUri,
      state: signState({ userId, nonce, client: clientType }),
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  // Nunca lança: qualquer falha vira { ok: false, message } para a tela de retorno.
  async function handleCallback({ code, state, error } = {}) {
    const s = verifyState(state);
    const clientType = s?.client === "mobile" ? "mobile" : "web";
    const fail = (message) => ({ ok: false, client: clientType, message });
    if (!s) return fail(MSG.expired);

    try {
      // Consome primeiro: o state vale uma única vez, inclusive quando o usuário cancela.
      const attempt = await attempts.consume(s.nonce);
      if (!attempt || attempt.userId !== s.userId) return fail(MSG.expired);

      if (error === "access_denied") return fail(MSG.denied);
      if (error || !code) return fail(MSG.failed);

      let tokens;
      try {
        tokens = await client.exchangeCode({ code, codeVerifier: attempt.codeVerifier });
      } catch (e) {
        console.error("[ML OAuth] falha na troca do code:", e.code || e.message);
        return fail(MSG.failed);
      }

      try {
        await store.saveTokens(s.userId, tokens);
      } catch (e) {
        if (e?.code === "P2002") return fail(MSG.alreadyLinked);
        console.error("[ML OAuth] falha ao salvar tokens:", e.message);
        return fail(MSG.failed);
      }
      return { ok: true, client: clientType, message: MSG.ok };
    } catch (e) {
      console.error("[ML OAuth] erro inesperado no callback:", e.message);
      return fail(MSG.failed);
    }
  }

  return { startAuthorization, handleCallback };
}

export default createOAuthFlow();
