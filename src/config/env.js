import dotenv from "dotenv";
import { lerInteiroPositivo } from "../services/acesso/plano.js";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// Máquina de desenvolvimento: sem NODE_ENV=production e fora do Railway (que sempre
// define RAILWAY_ENVIRONMENT). Aqui os e-mails sem RESEND_API_KEY vão para o terminal
// e os limites de tentativas por IP ficam desligados.
export function ehAmbienteLocal(env = process.env) {
  return env.NODE_ENV !== "production" && !env.RAILWAY_ENVIRONMENT;
}
const isLocal = ehAmbienteLocal();

// Em produção, os segredos precisam vir do ambiente: sem eles, o app usaria
// valores padrão públicos (cookies forjáveis e tokens do ML decifráveis).
if (isProduction) {
  const missing = ["SESSION_SECRET", "ENCRYPTION_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Variáveis de ambiente obrigatórias em produção ausentes: ${missing.join(", ")}.`
    );
  }
}

// Sem estas, o cadastro funciona mas ninguém recebe o link de confirmação
// (e portanto não consegue entrar). Avisa alto em vez de derrubar o deploy.
if (isProduction) {
  const missingMail = ["APP_URL", "RESEND_API_KEY"].filter((k) => !process.env[k]);
  if (missingMail.length) {
    console.warn(
      `[env] ATENÇÃO: ${missingMail.join(", ")} não definida(s). E-mails de confirmação e recuperação de senha não vão funcionar.`
    );
  }
}

// App do Mercado Livre da plataforma (único para todos os usuários). Sem ele,
// ninguém consegue conectar a conta do ML.
if (isProduction) {
  const missingMl = ["ML_APP_ID", "ML_APP_SECRET"].filter((k) => !process.env[k]);
  if (missingMl.length) {
    console.warn(
      `[env] ATENÇÃO: ${missingMl.join(", ")} não definida(s). A conexão com o Mercado Livre não vai funcionar.`
    );
  }
}

// Administradores que recebem os pedidos de liberação de contas (vírgula entre e-mails).
const adminEmails = String(process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
if (isProduction && adminEmails.length === 0) {
  console.warn("[env] ATENÇÃO: ADMIN_EMAILS não definida. Ninguém vai receber os pedidos de liberação de contas.");
}

const appUrl = (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3333}`).replace(/\/+$/, "");

export const config = {
  isProduction,
  isLocal,
  adminEmails,
  // Limites do modo teste: a env do Railway tem prioridade; inválido ou vazio usa o padrão.
  teste: {
    maxAnuncios: lerInteiroPositivo(process.env.TESTE_MAX_ANUNCIOS, 50),
    syncsDia: lerInteiroPositivo(process.env.TESTE_SYNCS_DIA, 3),
    dias: lerInteiroPositivo(process.env.TESTE_DIAS, 14),
  },
  port: Number(process.env.PORT) || 3333,
  // Fuso usado pelo agendamento (cron). Servidores em nuvem costumam rodar em UTC.
  timezone: process.env.TZ || "America/Sao_Paulo",
  sessionSecret:
    process.env.SESSION_SECRET || "troque-este-segredo-no-env-por-um-aleatorio",
  // URL pública do app, usada nos links enviados por e-mail (sem barra no final).
  appUrl,
  // Credenciais do app ML da plataforma e redirecionamentos do OAuth.
  ml: {
    appId: process.env.ML_APP_ID || "",
    appSecret: process.env.ML_APP_SECRET || "",
    redirectUri: process.env.ML_REDIRECT_URI || `${appUrl}/api/ml/oauth/callback`,
    mobileRedirect: process.env.MOBILE_OAUTH_REDIRECT || "marketplacehelper://ml/oauth",
  },
  // Envio de e-mails (Resend). Sem domínio verificado, use onboarding@resend.dev
  // (só entrega para o e-mail dono da conta Resend).
  resendApiKey: process.env.RESEND_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || "Marketplace Helper <onboarding@resend.dev>",
  // Segredo dos tokens JWT da API (cai no SESSION_SECRET se não definido).
  jwtSecret:
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "troque-este-segredo-no-env-por-um-aleatorio",

  classifier: {
    modelBaseUrl: (process.env.ML_ENDPOINT || "").replace(/\/+$/, ""),
    cacheDir: process.env.MODEL_CACHE_DIR || "./tmp/models",
    pollMs: Number(process.env.MODEL_POLL_MS || 21600000),
    mlToken: process.env.ML_TOKEN || "",
  },
};
