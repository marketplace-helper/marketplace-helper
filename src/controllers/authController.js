import { getAuthStatus } from "../services/mlAuth.js";
import { getMlProfile } from "../services/mlApi.js";

// Tela de conexão com o Mercado Livre (3 estados: desconectado, ativo, reconexão).
export async function showAuthPage(req, res) {
  const status = await getAuthStatus(req.user.id);
  let profile = null;
  if (status.status === "active") {
    try {
      profile = await getMlProfile(req.user.id);
    } catch (e) {
      // ML fora do ar não deve derrubar a tela
      console.error("[AUTH] não foi possível carregar o perfil do ML:", e.message);
    }
  }
  res.render("auth", {
    title: "Autorização",
    status,
    profile,
    authenticated: status.authenticated,
    message: req.query.message || null,
    error: req.query.error || null,
  });
}
