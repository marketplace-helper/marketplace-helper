import jwt from "jsonwebtoken";
import { config } from "./env.js";

// Validade dos tokens da API (longa, pensada para app mobile).
const EXPIRES_IN = "30d";

export function signToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: EXPIRES_IN });
}

// Retorna o payload decodificado ou null se o token for inválido/expirado.
// Tokens com audiência (ex.: state do OAuth do ML) não são tokens de login.
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.aud !== undefined) return null;
    return payload;
  } catch {
    return null;
  }
}
