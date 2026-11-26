import adminService from "../services/acesso/adminService.js";

const TEXTO = {
  LIBERAR: { titulo: "Liberar uso completo", botao: "Liberar uso completo", classe: "btn-success", feito: "Conta liberada. Avisamos a loja por e-mail." },
  BLOQUEAR: { titulo: "Bloquear conta", botao: "Bloquear conta", classe: "btn-danger", feito: "Conta bloqueada. A loja não consegue mais entrar." },
};
const INVALIDO = "Link inválido, expirado ou já usado.";

// GET: só mostra o que vai acontecer (não aplica nada).
export async function showAcao(req, res) {
  const v = await adminService.verAcao(req.query.token);
  res.render("admin-acao", {
    title: "Conta",
    token: v ? req.query.token : null,
    acao: v?.acao || null,
    alvo: v?.user || null,
    texto: v ? TEXTO[v.acao] : null,
    resultado: null,
    erro: v ? null : INVALIDO,
  });
}

// POST: aplica a ação e consome o link.
export async function aplicarAcao(req, res) {
  const r = await adminService.aplicarAcao(req.body.token);
  res.render("admin-acao", {
    title: "Conta",
    token: null,
    acao: r.ok ? r.acao : null,
    alvo: r.ok ? r.user : null,
    texto: r.ok ? TEXTO[r.acao] : null,
    resultado: r.ok ? TEXTO[r.acao].feito : null,
    erro: r.ok ? null : INVALIDO,
  });
}
