// Servidor estático leve (sem dependências) para a Landing Page.
// Serve os arquivos desta pasta em http://localhost:8080
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// PORT é injetada pela hospedagem (ex.: Railway); LP_PORT/8080 para uso local.
const PORT = Number(process.env.PORT || process.env.LP_PORT) || 8080;

// Endereço do sistema. Rotas do app acessadas pelo www (links antigos de e-mail,
// endereço digitado errado) são redirecionadas para lá em vez de dar 404.
const APP_URL = (process.env.APP_URL || "https://app.marketplacehelper.com.br").replace(/\/+$/, "");
const APP_ROUTES = [
  "/login", "/register", "/logout", "/recuperar-senha", "/redefinir-senha",
  "/verifique-email", "/confirmar-email", "/confirmar-novo-email",
  "/auth", "/callback", "/conta", "/dashboard", "/anuncios", "/produtos",
  "/medir", "/regras", "/simulador", "/frete", "/api",
];
const isAppRoute = (p) => APP_ROUTES.some((r) => p === r || p.startsWith(r + "/"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    const url = req.url || "/";
    let rel = decodeURIComponent(url.split("?")[0]);

    if (isAppRoute(rel)) {
      res.writeHead(301, { Location: APP_URL + url });
      return res.end();
    }

    if (rel === "/") rel = "/index.html";

    const filePath = path.join(__dirname, rel);
    // bloqueia path traversal (sair da pasta)
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<h1>404 - Página não encontrada</h1>");
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream",
        // Sempre revalida: sem isso o navegador reaproveita config.js antigo
        // depois de um deploy (ex.: botões apontando para a URL velha do app).
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`\n  Landing Page rodando em http://localhost:${PORT}\n`);
  });
