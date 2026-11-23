import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";

// Audiência exclusiva do state do OAuth: impede que um JWT de login da API
// (sem audiência) seja aceito como state, e vice-versa.
const AUDIENCE = "ml-oauth";
const EXPIRES_IN = "10m";

// State assinado e de curta duração, carregando quem iniciou a conexão.
export function signState({ userId, nonce, client }) {
  return jwt.sign({ userId, nonce, client }, config.jwtSecret, {
    audience: AUDIENCE,
    expiresIn: EXPIRES_IN,
  });
}

// Retorna { userId, nonce, client } ou null se inválido, expirado ou de outra audiência.
export function verifyState(state) {
  try {
    const payload = jwt.verify(state, config.jwtSecret, {
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    return { userId: payload.userId, nonce: payload.nonce, client: payload.client };
  } catch {
    return null;
  }
}
