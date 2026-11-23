import { getAuthStatus } from "../services/mlAuth.js";

// Tela de autorizacao (a view sera refeita na Task 6; authUrl fica nulo por ora)
export async function showAuthPage(req, res) {
  const status = await getAuthStatus(req.user.id);
  res.render("auth", {
    title: "Autorizacao",
    status,
    authUrl: null,
    authenticated: status.authenticated,
    message: req.query.message || null,
    error: req.query.error || null,
  });
}
