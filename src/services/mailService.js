import { Resend } from "resend";
import { config } from "../config/env.js";

// Envio de e-mails transacionais via Resend.
// O conteúdo fica em templates publicados no Resend (aliases abaixo), então dá
// pra ajustar o texto pelo painel sem novo deploy.
export const TEMPLATES = {
  VERIFY: "confirmar-email", // variáveis: STORE_NAME, ACTION_URL
  RESET: "redefinir-senha", // variáveis: STORE_NAME, ACTION_URL
  EMAIL_CHANGE: "confirmar-novo-email", // variáveis: STORE_NAME, ACTION_URL
};

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Só vale a pena tentar de novo em erro de rede (statusCode null), 429 e 5xx.
// Outros 4xx (validação, chave inválida, remetente não verificado) não mudam com retry.
function isRetryable(error) {
  const s = error.statusCode;
  return s == null || s === 429 || s >= 500;
}

function retryDelayMs(headers, attempt) {
  const retryAfter = Number(headers?.["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return 500 * 2 ** (attempt - 1); // 500ms, 1s, ...
}

/**
 * Envia um e-mail a partir de um template do Resend.
 * O idempotencyKey garante que um retry não gere e-mail duplicado (vale por 24h).
 * Retorna o id do e-mail no Resend. Lança erro se não conseguir enviar.
 */
export async function sendTemplateEmail({ to, template, variables, idempotencyKey }) {
  if (!resend) {
    throw new Error("RESEND_API_KEY não configurada: não é possível enviar e-mails.");
  }

  for (let attempt = 1; ; attempt++) {
    let result;
    try {
      result = await resend.emails.send(
        { from: config.mailFrom, to, template: { id: template, variables } },
        { idempotencyKey }
      );
    } catch (e) {
      // O SDK normalmente não lança, mas uma falha de rede pode escapar.
      result = { data: null, error: { message: e.message, statusCode: null }, headers: null };
    }

    const { data, error, headers } = result;
    if (!error) {
      console.log(`[mail] ${template} enviado (id ${data.id})`);
      return data.id;
    }

    if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) {
      console.error(`[mail] falha ao enviar ${template}: ${error.statusCode ?? "rede"} ${error.message}`);
      throw new Error(`Falha ao enviar e-mail: ${error.message}`);
    }
    await sleep(retryDelayMs(headers, attempt));
  }
}
