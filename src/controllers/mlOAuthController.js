import oauthFlowDefault from "../services/ml/oauthFlow.js";
import connectionStoreDefault from "../services/ml/connectionStore.js";
import { getAuthStatus as getAuthStatusDefault } from "../services/mlAuth.js";
import webhookServiceDefault from "../services/ml/webhookService.js";
import { config } from "../config/env.js";

// Fábrica com dependências injetáveis (os testes não sobem o Express).
export function createMlOAuthController({
  oauthFlow = oauthFlowDefault,
  connectionStore = connectionStoreDefault,
  getAuthStatus = getAuthStatusDefault,
  mobileRedirect = config.ml.mobileRedirect,
  webhookService = webhookServiceDefault,
} = {}) {
  // Web (sessão): inicia o fluxo e manda o navegador para o Mercado Livre.
  async function connect(req, res) {
    res.redirect(await oauthFlow.startAuthorization(req.user.id, "web"));
  }

  async function disconnect(req, res) {
    await connectionStore.disconnect(req.user.id);
    res.redirect("/auth?message=" + encodeURIComponent("Conta do Mercado Livre desconectada."));
  }

  // Pública: o Mercado Livre devolve o usuário aqui (web e mobile).
  async function callback(req, res) {
    const { code, state, error } = req.query;
    const r = await oauthFlow.handleCallback({ code, state, error, sessionUserId: req.session?.userId });
    if (r.client === "mobile") {
      const qs = `status=${r.ok ? "ok" : "erro"}&mensagem=${encodeURIComponent(r.message)}`;
      return res.redirect(`${mobileRedirect}?${qs}`);
    }
    const key = r.ok ? "message" : "error";
    res.redirect(`/auth?${key}=${encodeURIComponent(r.message)}`);
  }

  // API Bearer (app mobile).
  async function apiStart(req, res) {
    res.json({ url: await oauthFlow.startAuthorization(req.user.id, "mobile") });
  }

  async function apiStatus(req, res) {
    res.json(await getAuthStatus(req.user.id));
  }

  async function apiDisconnect(req, res) {
    await connectionStore.disconnect(req.user.id);
    res.status(204).end();
  }

  // Pública: notificações do ML. Responde 200 na hora e processa depois.
  function webhook(req, res) {
    res.sendStatus(200);
    Promise.resolve()
      .then(() => webhookService.handle(req.body))
      .catch((e) => console.error("[ML webhook] erro:", e?.message || e));
  }

  return { webhook, connect, disconnect, callback, apiStart, apiStatus, apiDisconnect };
}

export default createMlOAuthController();
