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
  log = (m) => console.log(m),
} = {}) {
  // Nunca loga code, state nem tokens.
  const ctx = (o) => Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${v}`).join(" ");

  async function startAuthorization(userId, clientType, { host } = {}) {
    log(`[ML OAuth] início ${ctx({ usuario: userId, cliente: clientType, host, redirect_uri: redirectUri })}`);
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
  async function handleCallback({ code, state, error, errorDescription, sessionUserId, host } = {}) {
    const s = verifyState(state);
    const clientType = s?.client === "mobile" ? "mobile" : "web";
    const base = { usuario: s?.userId, cliente: clientType, host, sessao: sessionUserId ?? "nenhuma" };
    const fail = (message, motivo, extra = {}) => {
      log(`[ML OAuth] callback recusado: motivo=${motivo} ${ctx({ ...base, ...extra })}`);
      return { ok: false, client: clientType, message };
    };
    if (!s) return fail(MSG.expired, state ? "state_invalido" : "sem_state", { error });
    // Web: quem conclui precisa ser o usuário logado que iniciou o fluxo (evita ligar a conta
    // ML de uma vítima ao usuário do atacante). Mobile não tem sessão; veja o README.
    // Sem sessão costuma ser cookie de outro domínio: o fluxo começou num host e o
    // redirect_uri do ML devolveu para outro.
    if (clientType === "web" && sessionUserId == null) return fail(MSG.expired, "sem_sessao", { redirect_uri: redirectUri });
    if (clientType === "web" && sessionUserId !== s.userId) return fail(MSG.expired, "sessao_de_outro_usuario");

    try {
      // Consome primeiro: o state vale uma única vez, inclusive quando o usuário cancela.
      const attempt = await attempts.consume(s.nonce);
      if (!attempt || attempt.userId !== s.userId) return fail(MSG.expired, "tentativa_usada_ou_expirada");

      const doMl = { error, descricao: errorDescription ? JSON.stringify(String(errorDescription).slice(0, 200)) : null };
      if (error === "access_denied") return fail(MSG.denied, "negado_pelo_usuario");
      if (error) return fail(MSG.failed, "erro_do_ml", doMl);
      if (!code) return fail(MSG.failed, "sem_code");

      let tokens;
      try {
        tokens = await client.exchangeCode({ code, codeVerifier: attempt.codeVerifier });
      } catch (e) {
        // invalid_grant costuma ser redirect_uri diferente do cadastrado no app do ML,
        // code já usado/expirado ou code_verifier (PKCE) que não bate.
        return fail(MSG.failed, "troca_do_code_falhou", {
          erro: e.code, status: e.status, mensagem: JSON.stringify(String(e.message).slice(0, 200)), redirect_uri: redirectUri,
        });
      }

      try {
        await store.saveTokens(s.userId, tokens);
      } catch (e) {
        if (e?.code === "P2002") return fail(MSG.alreadyLinked, "conta_ml_de_outro_usuario", { ml_user: tokens.mlUserId });
        return fail(MSG.failed, "falha_ao_salvar_tokens", { mensagem: JSON.stringify(String(e.message).slice(0, 200)) });
      }
      log(`[ML OAuth] conectado ${ctx({ usuario: s.userId, cliente: clientType, ml_user: tokens.mlUserId })}`);
      return { ok: true, client: clientType, message: MSG.ok };
    } catch (e) {
      return fail(MSG.failed, "erro_inesperado", { mensagem: JSON.stringify(String(e.message).slice(0, 200)) });
    }
  }

  return { startAuthorization, handleCallback };
}

export default createOAuthFlow();
