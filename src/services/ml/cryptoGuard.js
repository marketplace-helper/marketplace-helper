import { decrypt, isEncrypted } from "../../config/crypto.js";

// Erro de configuração (não de autorização): a ENCRYPTION_KEY atual não abre os tokens gravados.
export class CryptoConfigError extends Error {
  constructor(message = "Não foi possível decifrar os tokens do Mercado Livre. Verifique a ENCRYPTION_KEY.") {
    super(message);
    this.name = "CryptoConfigError";
  }
}

// decrypt() devolve o texto cifrado inalterado quando a chave não confere; aqui isso vira erro.
export function decifrarTokenOuFalhar(value) {
  const plain = decrypt(value);
  if (isEncrypted(plain)) throw new CryptoConfigError();
  return plain;
}
