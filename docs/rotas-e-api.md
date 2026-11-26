# Rotas e API

[← Voltar ao README](../README.md)

## Rotas web

**Públicas:** `GET/POST /login` · `GET/POST /register` · `GET/POST /recuperar-senha` ·
`GET/POST /redefinir-senha` · `GET /verifique-email` · `GET /confirmar-email` ·
`GET /confirmar-novo-email` · `GET/POST /logout` · `GET/POST /admin/contas/acao` (links dos e-mails
aos administradores; o token do link é a autorização).

**Protegidas (exigem login):**

| Método | Rota | Função |
|---|---|---|
| GET | `/` · `/dashboard` | Painel de KPIs e *insights* |
| GET | `/anuncios` | Lista de anúncios (busca, ordenação, `?filter=`) |
| GET | `/produtos` | Produtos por SKU (custo, medidas, frete cobrado × real) |
| POST | `/produtos/custo` | Define o custo de um SKU |
| POST | `/produtos/medidas` | Define as medidas de um SKU e devolve a comparação de frete |
| GET | `/medir` · `/medir/peso` | Medição do produto (câmera + balança simuladas) |
| GET | `/frete` | Calculadora de frete |
| GET/POST | `/regras` | Regras de negócio (impostos/custos) |
| GET/POST | `/simulador` | Simulador de anúncio |
| GET | `/auth` · GET `/ml/conectar` · POST `/ml/desconectar` | Conexão com o Mercado Livre |
| POST | `/sync` · `/sync/selection` · GET `/sync/status` | Sincronização e progresso |
| POST | `/settings/zip` | CEP de cálculo de frete |
| GET | `/export` | Exporta Excel |
| GET | `/conta` · POST `/conta/perfil` · `/conta/senha` | Minha conta |

A lista completa está em `src/routes/index.js`.

## API JSON (`/api`)

Para o front-end React, o app React Native e o dispositivo IoT. Autenticação por **JWT**
(`Authorization: Bearer <token>`), independente da sessão web; **CORS** liberado em `/api`.

- Swagger UI: **`/api/docs`**
- Especificação OpenAPI: **`/api/openapi.json`** (fonte em `src/docs/openapi.js`)

| Método | Rota | Função |
|---|---|---|
| POST | `/api/login` · `/api/register` | Autentica/cria conta e devolve `{ token, user }` (públicas) |
| GET | `/api/me` | Usuário autenticado e status da conexão com o ML |
| GET | `/api/dashboard` | KPIs, *insights* e frete divergente |
| GET | `/api/anuncios` | Anúncios (`search`, `sort`, `dir`, `filter`, `page`) |
| GET | `/api/produtos` | Produtos por SKU |
| POST | `/api/produtos/:sku/custo` · `/api/produtos/:sku/medidas` | Custo / medidas do SKU |
| GET/PUT | `/api/regras` | Regras de negócio |
| GET | `/api/frete/estimar` | Calculadora de frete por cubagem |
| GET/PUT | `/api/config` · `/api/config/cep` | CEP e última sincronização |
| POST/GET | `/api/sync` · `/api/sync/status` | Sincronização e progresso |
| POST | `/api/ml/oauth/start` | Inicia o OAuth e devolve `{ url }` (app mobile) |
| GET · DELETE | `/api/ml/connection` | Status da conexão ML / desconectar |
| GET | `/api/ml/oauth/callback` | (pública) Retorno do ML; redireciona ao web ou ao deep link |
| POST | `/api/ml/webhooks` | (pública) Notificações do ML (`items`, `orders_v2`) |
| POST | `/api/iot/medidas` | Leitura do dispositivo (peso + dimensões), salva no SKU |

As regras de negócio são as mesmas da web: a API só serializa em JSON os resultados dos *services*.
