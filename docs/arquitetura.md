# Arquitetura

[← Voltar ao README](../README.md)

## Visão geral

Aplicação **Node.js / Express** com renderização no servidor (**EJS + Bootstrap 5**), persistência
via **Prisma ORM** sobre **PostgreSQL** e padrão **MVC** complementado por uma **camada de serviços**.
É multiusuário, com isolamento de dados por `userId`. Além das páginas, expõe uma **API JSON** em
`/api` que reaproveita os mesmos serviços.

```
Requisição HTTP
      │
      ▼
 [ Rotas ] ──► [ Middleware (auth web / JWT / rate limit) ] ──► [ Controllers ]
                                                                     │
                                                                     ▼
                                                               [ Services ]  ◄──► [ Prisma / Postgres ]
                                                                     │
                                                    ┌────────────────┼────────────────┐
                                                    ▼                ▼                ▼
                                           [ API Mercado Livre ] [ Resend ]     [ Views EJS / JSON ]
```

- **Rotas** (`src/routes/index.js` para a web, `src/routes/api.js` para a API): declaram os *endpoints* e aplicam os *middlewares*.
- **Controllers** (`src/controllers/`): leem parâmetros, chamam serviços e escolhem a *view* ou a resposta JSON. Não contêm regra de negócio.
- **Services** (`src/services/`): lógica de domínio (cálculos, API externa, banco). Reutilizados pela web e pela API.
- **Views** (`src/views/`): *templates* EJS renderizados no servidor.
- **Scheduler** (`src/scheduler.js`): *cron* de sincronização e de renovação de tokens, no mesmo processo da web.

## Decisões de projeto

- **SSR com EJS em vez de SPA.** A aplicação é orientada a formulários e tabelas densas, com pouca
  interatividade no cliente; o SSR elimina o *build* de *frontend* e entrega HTML pronto.
- **PostgreSQL via Prisma.** *Schema* declarativo e migrações versionadas. Começou em SQLite e
  migrou para Postgres em 2026-11 (backup gerenciado, acesso externo, deploy sem volume e caminho
  para várias instâncias). Localmente roda no Docker (`docker-compose.yml`).
- **Isolamento por `userId`.** Toda entidade referencia o usuário dono e toda consulta é escopada.
- **Cálculos derivados sob demanda.** Margem, lucro e "Custo ML" não são persistidos: são calculados
  na leitura, então uma mudança de alíquota reflete na hora, sem recomputar o catálogo.
- **Um único app no Mercado Livre.** O usuário só clica em *Conectar*; não cadastra credenciais.
- **Templates de e-mail no Resend.** O texto dos e-mails fica nos templates publicados no Resend
  (por *alias*), então dá para ajustar sem novo deploy.

## Pilha tecnológica

| Camada | Tecnologia | Papel |
|---|---|---|
| Runtime | **Node.js ≥ 20** (ESM) | Execução |
| Servidor web | **Express 4** | Roteamento e *middleware* |
| Templates | **EJS** + **Bootstrap 5** (CDN) + **Bootstrap Icons** + **Inter** | Renderização e UI |
| ORM / banco | **Prisma 6** + **PostgreSQL** | Persistência e migrações |
| Autenticação | **bcryptjs** + **cookie-session** (web) · **jsonwebtoken** (API) | Login e sessão |
| Criptografia | **node:crypto** (AES-256-GCM) | Tokens do ML em repouso |
| E-mail | **Resend** | Confirmação, recuperação de senha, avisos aos admins |
| Agendamento | **node-cron** | Sincronização e renovação de tokens |
| Exportação | **ExcelJS** | Planilhas `.xlsx` |
| API | **cors** + **swagger-ui-express** | API `/api` e documentação |
| Testes | **node:test** | Testes unitários (`test/`) |

## Estrutura de diretórios

```
marketplace-helper/
├── prisma/
│   ├── schema.prisma          # Modelo de dados
│   └── migrations/            # Migrações versionadas
├── public/
│   ├── css/style.css          # Tema (ver design.md)
│   └── js/                    # app.js (UI), frete-calc.js (calculadora), medir.js (medição simulada)
├── src/
│   ├── config/                # env.js, prisma.js, crypto.js, jwt.js
│   ├── middleware/            # auth.js (web), apiAuth.js (JWT), rateLimit.js
│   ├── controllers/           # Orquestração web (HTML) e apiController (JSON)
│   ├── services/              # Lógica de domínio (tabela abaixo)
│   │   ├── ml/                # OAuth, tokens, webhooks e fila de sync do Mercado Livre
│   │   └── acesso/            # Planos, limites do modo teste e ações de admin
│   ├── views/                 # Templates EJS (+ partials)
│   ├── docs/openapi.js        # Especificação OpenAPI (Swagger)
│   ├── routes/                # index.js (web) e api.js (/api)
│   ├── scheduler.js           # Cron de sync (00:00/12:00) e renovação de tokens (10 min)
│   └── server.js              # Ponto de entrada
├── test/                      # Testes (node --test)
├── landing-page/              # Landing page comercial (site estático independente)
├── docs/                      # Esta documentação
├── .env.example               # Modelo das variáveis de ambiente
├── INICIAR.BAT                # Inicializador para Windows
└── design.md                  # Guia do design system
```

### Serviços

| Arquivo | Responsabilidade |
|---|---|
| `accountService.js` | Criação de usuário, verificação e troca de senha |
| `emailAuthService.js` | Tokens de confirmação de e-mail, troca de e-mail e recuperação de senha |
| `mailService.js` | Envio de e-mails por template do Resend, com *retry* e idempotência |
| `mlAuth.js` | Token válido por usuário, com *retry* único em 401 |
| `mlApi.js` | Chamadas à API do ML (itens, preços, frete, comissão, visitas, categoria) |
| `ml/oauthFlow.js` · `oauthClient.js` · `pkce.js` · `oauthState.js` | Fluxo OAuth 2.0 + PKCE com `state` de uso único |
| `ml/tokenManager.js` · `connectionStore.js` · `cryptoGuard.js` | Renovação dos tokens (com *lock* por usuário) e persistência cifrada |
| `ml/webhookService.js` · `syncQueue.js` · `sellerFilter.js` | Notificações do ML, agrupamento em lote e filtro de anúncios do vendedor |
| `syncService.js` | Orquestração da sincronização e *upsert* dos anúncios; progresso |
| `itemService.js` | Listagem paginada/ordenada e filtros rápidos dos KPIs (`?filter=`) |
| `calcService.js` | Lucro/margem (`calcularCustoProduto`, antigo `computeProfit`) e saúde do anúncio (`computeHealth`) |
| `tributos/` | Contexto tributário do usuário, escolha das alíquotas vigentes e cálculo de cada tributo |
| `dashboardService.js` | KPIs, *insights* e frete divergente |
| `productService.js` | Agrupamento por SKU; custo e medidas em lote; frete cobrado × real |
| `freteTable.js` | Tabela de frete do ML, cubagem e avaliação de divergência |
| `rulesService.js` | Regras de negócio (ICMS, IPI, DIFAL, custo operacional) |
| `simulatorService.js` | Simulação de anúncio (categoria, comissão, frete, retorno) |
| `exportService.js` | Planilha Excel |
| `acesso/plano.js` · `limitesSync.js` · `adminService.js` | Planos da conta, limites do modo teste e liberação/bloqueio por admin |

## Modelo de dados

Definido em `prisma/schema.prisma`. Entidades escopadas a um usuário (exceto `User` e a tabela global `AliquotaTributaria`).

```
User 1───1 MlConnection       (tokens OAuth cifrados e status da conexão)
 │   1───1 Settings           (CEP de frete, data da última sincronização)
 │   1───1 BusinessRule       (regime, UF, crédito, alíquotas de ICMS, IPI, DIFAL, custo operacional)
 │   1───N Item               (anúncios do vendedor)
                 │
                 1───N ShippingHistory  (histórico de frete por item)

AliquotaTributaria  (global: PIS/Cofins/CBS/IBS e fator do ICMS, com vigência)
```

| Entidade | Campos principais | Observações |
|---|---|---|
| **User** | `email` (único), `storeName`, `whatsapp`, `passwordHash`, `emailVerifiedAt`, `plano`, `testeAte`, `testeAvisoEm` | Senha com hash bcrypt; `plano`: `TESTE` / `COMPLETO` / `BLOQUEADO` |
| **MlConnection** | `mlUserId`, `accessToken`, `refreshToken`, `expiresAt`, `status`, `lastRefreshAt`, `lastError` | Tokens cifrados; `status`: `active` / `reconnect_required` / `disconnected` |
| **Settings** | `zipCode`, `lastSyncAt` | CEP usado no cálculo de frete |
| **BusinessRule** | `icms`, `ipi`, `difal`, `custoOperacional`, `regime`, `ufOrigem`, `creditoCompra` | Percentuais (%); `regime` padrão `SIMPLES` |
| **AliquotaTributaria** | `chave` (única), `tributo`, `aliquota`, `tipo`, `regime`, `vigenciaInicio`, `vigenciaFim`, `uf`, `naoCumulativo`, `somenteDestaque`, `observacao` | Ver [Alíquotas tributárias](regras-de-negocio.md#alíquotas-tributárias-reforma-cbsibs) |
| **Item** | `mlb`, `sku`, `titulo`, `thumbnail`, `permalink`, `custoProduto`, medidas, `precoDe`, `precoPor`, `frete`, `comissao`, `comissaoPct`, `visitas`, `vendas`, `estoque`, `status`, `full`, `catalogo`, categorias | Único por `(userId, mlb)`; medidas aplicadas por SKU |
| **ShippingHistory** | `mlb`, `cost`, `capturedAt` | Detecta mudanças de frete |

## Autenticação

1. **Usuário na aplicação web.** Cadastro com e-mail, nome da loja, WhatsApp e senha (mínimo 8
   caracteres, 1 maiúscula e 1 número), armazenada com **bcrypt**. A sessão é um **cookie assinado**
   (`cookie-session`) que guarda só o `userId`; `requireAuth` protege as rotas internas. O e-mail é
   confirmado por link, e há recuperação de senha e troca de e-mail, também por link (Resend).
2. **API JSON (`/api`).** Token **JWT** (`Authorization: Bearer <token>`) emitido no login,
   independente da sessão web. `requireApiAuth` responde **401 em JSON**.
3. **Mercado Livre.** OAuth 2.0 + PKCE; detalhes em [Integração com o Mercado Livre](integracao-mercado-livre.md).

Cadastro, reenvio de confirmação e recuperação de senha somam **5 tentativas por hora por IP**;
login, **20 a cada 15 minutos** (web e API).

## Sincronização e agendamento

A sincronização (`syncService.js`) percorre os anúncios do vendedor buscando detalhes, preços, frete,
comissão, visitas e categoria, e faz *upsert* em `Item`. Roda **em segundo plano**, com o progresso
em `GET /sync/status` (consultado por *polling*). Não sobrescreve frete/comissão válidos por nulo em
falhas transitórias e grava `Settings.lastSyncAt` ao concluir. Dois pedidos simultâneos do mesmo
usuário não iniciam dois syncs.

O `scheduler.js` (node-cron) agenda:

- **Sync de todas as contas autorizadas** às **00:00 e 12:00** (`0 0,12 * * *`), no fuso
  `America/Sao_Paulo` (configurável por `TZ`). Contas em modo teste ficam de fora.
- **Renovação proativa de tokens** do ML a cada **10 minutos** (tokens que expiram em menos de 30 min).

*Webhooks* do ML (`items`, `orders_v2`) disparam um sync seletivo, agrupado em lote por usuário.
Como tudo roda no processo da web, em produção o servidor precisa ficar **sempre ligado**.

## Segurança

- **Senhas:** *hash* bcrypt com *salt*; nunca armazenadas nem exibidas em claro.
- **Tokens do Mercado Livre:** cifrados em repouso com **AES-256-GCM** (`src/config/crypto.js`), no
  formato `enc:v1:<iv>:<tag>:<dados>`, com chave derivada de `ENCRYPTION_KEY`. Mesmo com o banco
  vazado, ficam ilegíveis sem a chave.
- **Sessão:** cookie assinado com `SESSION_SECRET`. Em produção (`NODE_ENV=production`) recebe a flag
  `Secure` e o Express confia no *proxy* (`trust proxy`).
- **Segredos obrigatórios:** em produção, o servidor **recusa iniciar** sem `SESSION_SECRET` e `ENCRYPTION_KEY`.
- **Webhooks públicos:** só anúncios do vendedor conectado são gravados (`sellerFilter.js`).
- **Links de admin:** a ação de liberar/bloquear só acontece no `POST` da página de confirmação, para
  que antivírus e leitores de e-mail que abrem links não aprovem ninguém.
- **Versionamento:** `.env` e `*.db` estão no `.gitignore`.

> `ENCRYPTION_KEY` e `SESSION_SECRET` devem permanecer **estáveis**. Trocar a chave de criptografia
> torna os tokens gravados irrecuperáveis (os usuários teriam de reconectar o ML).
