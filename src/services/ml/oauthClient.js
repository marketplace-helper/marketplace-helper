import { config } from "../../config/env.js";

const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

// Erro do endpoint de token do ML. `code` é o `error` do ML (invalid_grant, invalid_client...),
// "network" quando a requisição falha, ou "http_<status>" quando a resposta não traz `error`.
export class MlOAuthError extends Error {
  constructor(message, { code, status = 0 } = {}) {
    super(message);
    this.name = "MlOAuthError";
    this.code = code;
    this.status = status;
  }
}

export function createOAuthClient({ fetch = globalThis.fetch, appId, appSecret, redirectUri }) {
  async function post(params) {
    const body = new URLSearchParams({ ...params, client_id: appId, client_secret: appSecret });
    let res;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString(),
      });
    } catch (e) {
      throw new MlOAuthError(`Falha de rede ao falar com o Mercado Livre: ${e.message}`, { code: "network", status: 0 });
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      // corpo não era JSON; segue com data = null
    }
    if (!res.ok) {
      const code = data?.error || `http_${res.status}`;
      throw new MlOAuthError(data?.message || data?.error_description || `Mercado Livre respondeu ${res.status}`, { code, status: res.status });
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      mlUserId: String(data.user_id),
    };
  }

  return {
    exchangeCode: ({ code, codeVerifier }) =>
      post({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
    // O refresh token do ML é de uso único: quem chama deve gravar o novo refreshToken devolvido.
    refresh: (refreshToken) => post({ grant_type: "refresh_token", refresh_token: refreshToken }),
  };
}

export default createOAuthClient({
  appId: config.ml.appId,
  appSecret: config.ml.appSecret,
  redirectUri: config.ml.redirectUri,
});
