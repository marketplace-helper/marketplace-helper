import express from "express";
import cookieSession from "cookie-session";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config/env.js";
import routes from "./routes/index.js";
import apiRoutes from "./routes/api.js";
import { openapiSpec } from "./docs/openapi.js";
import { startScheduler } from "./scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Em produção o app fica atrás do proxy HTTPS da hospedagem: confia no
// X-Forwarded-Proto para reconhecer a conexão como segura (cookie "secure").
if (config.isProduction) app.set("trust proxy", 1);

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Sessao por cookie (login)
app.use(
  cookieSession({
    name: "mh_session",
    keys: [config.sessionSecret],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction, // em produção, cookie só trafega por HTTPS
  })
);

// ===== API JSON (para front React / app React Native / IoT) =====
// CORS liberado na API (token Bearer; a web renderizada continua por sessão).
app.use("/api", cors());
// Documentação Swagger (antes do router para não exigir token em /api/docs)
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api/openapi.json", (req, res) => res.json(openapiSpec));
app.use("/api", apiRoutes);
// 404 e erros da API em JSON (antes dos handlers HTML abaixo)
app.use("/api", (req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.use("/api", (err, req, res, next) => {
  console.error("[API ERRO]", err);
  res.status(500).json({ error: err.message || "Erro interno." });
});

// ===== Aplicação web (renderizada) =====
app.use("/", routes);

// 404
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Nao encontrado",
    message: "Pagina nao encontrada.",
  });
});

// Erros
app.use((err, req, res, next) => {
  console.error("[ERRO]", err);
  res.status(500).render("error", {
    title: "Erro",
    message: err.message || "Erro interno.",
  });
});

app.listen(config.port, () => {
  console.log(`\n  Marketplace Helper rodando em http://localhost:${config.port}`);
  startScheduler();
  console.log("");
});
