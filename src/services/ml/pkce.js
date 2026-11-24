import { randomBytes, createHash } from "node:crypto";

// PKCE (RFC 7636) para o OAuth do Mercado Livre: o verifier fica no servidor
// e só o challenge (SHA-256) vai na URL de autorização.
export function createPkcePair() {
  // 32 bytes em base64url dão 43 caracteres, o mínimo exigido pela RFC.
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
