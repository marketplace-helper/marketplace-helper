import { verifyToken } from "../config/jwt.js";
import { getUserById } from "../services/accountService.js";
import { situacaoDoPlano, MSG_BLOQUEADO } from "../services/acesso/plano.js";

// Autenticação da API por token Bearer (JWT). Diferente do middleware web,
// responde 401 em JSON em vez de redirecionar para /login.
export async function requireApiAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: "Token ausente. Envie Authorization: Bearer <token>." });
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: "Usuário não encontrado." });
  }
  if (!user.emailVerifiedAt) {
    return res.status(403).json({ error: "E-mail não confirmado." });
  }
  if (!situacaoDoPlano(user).podeEntrar) {
    return res.status(403).json({ error: MSG_BLOQUEADO });
  }

  req.user = user;
  next();
}
