import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

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

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3333,
  // Fuso usado pelo agendamento (cron). Servidores em nuvem costumam rodar em UTC.
  timezone: process.env.TZ || "America/Sao_Paulo",
  sessionSecret:
    process.env.SESSION_SECRET || "troque-este-segredo-no-env-por-um-aleatorio",
  // URL pública do app, usada nos links enviados por e-mail (sem barra no final).
  appUrl: (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3333}`).replace(/\/+$/, ""),
  // Envio de e-mails (Resend). Sem domínio verificado, use onboarding@resend.dev
  // (só entrega para o e-mail dono da conta Resend).
  resendApiKey: process.env.RESEND_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || "Marketplace Helper <onboarding@resend.dev>",
  // Segredo dos tokens JWT da API (cai no SESSION_SECRET se não definido).
  jwtSecret:
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "troque-este-segredo-no-env-por-um-aleatorio",
};
