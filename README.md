# Marketplace Helper

> Plataforma web de **inteligência de rentabilidade** para vendedores do Mercado Livre.
> Importa os anúncios via API oficial, calcula **lucro, margem, comissão e frete** de cada item,
> simula cenários de precificação e aponta, por meio de indicadores e *insights*, o que precisa
> de correção no catálogo.

Aplicação **Node.js / Express** com renderização no servidor (**EJS + Bootstrap 5**), persistência
via **Prisma ORM** sobre **SQLite**, arquitetura **MVC em camadas** e multiusuário com isolamento
de dados. Acompanha uma **landing page** comercial independente.

---

## Sumário

1. [Visão geral e motivação](#1-visão-geral-e-motivação)
2. [Arquitetura e decisões de projeto](#2-arquitetura-e-decisões-de-projeto)
3. [Pilha tecnológica](#3-pilha-tecnológica)
4. [Estrutura de diretórios](#4-estrutura-de-diretórios)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Autenticação e sessão](#6-autenticação-e-sessão)
7. [Integração com a API do Mercado Livre](#7-integração-com-a-api-do-mercado-livre)
8. [Regras de negócio e cálculo financeiro](#8-regras-de-negócio-e-cálculo-financeiro)
9. [Funcionalidades por módulo](#9-funcionalidades-por-módulo)
10. [Sincronização e agendamento](#10-sincronização-e-agendamento)
11. [Segurança](#11-segurança)
12. [Landing page](#12-landing-page)
13. [Mapa de rotas](#13-mapa-de-rotas)
14. [Variáveis de ambiente](#14-variáveis-de-ambiente)
15. [Passo a passo: executar em uma nova máquina](#15-passo-a-passo-executar-em-uma-nova-máquina)
16. [Publicação online (deploy no Railway)](#16-publicação-online-deploy-no-railway)
17. [Scripts disponíveis](#17-scripts-disponíveis)
18. [Solução de problemas](#18-solução-de-problemas)
19. [Limitações conhecidas e trabalhos futuros](#19-limitações-conhecidas-e-trabalhos-futuros)
20. [Licença](#20-licença)

---

## 1. Visão geral e motivação

Vender no Mercado Livre envolve custos que corroem a margem e raramente são contabilizados em
tempo real: **comissão** (tarifa de venda, variável por categoria e tipo de anúncio), **frete**
(que o vendedor subsidia nas faixas de frete grátis), **impostos** (ICMS, IPI, DIFAL) e o **custo
operacional**. Sem consolidar esses fatores, o vendedor frequentemente descobre que opera no
prejuízo apenas no fechamento do mês.

O **Marketplace Helper** resolve esse problema reunindo, para cada anúncio:

- preço de venda (inclusive promocional),
- custo do produto (informado pelo vendedor, por SKU),
- comissão real (via API),
- frete real (via API),
- impostos (parametrizados pelo vendedor),

e derivando **lucro líquido** e **margem**. Sobre esses dados, a aplicação constrói um painel com
indicadores-chave (KPIs) **clicáveis**, *insights* acionáveis, um simulador de precificação, uma
**calculadora de frete** (cubagem), a detecção de **frete divergente** (real × cobrado) a partir
das medidas do produto e exportação para Excel.

---

## 2. Arquitetura e decisões de projeto

A aplicação adota o padrão **MVC** complementado por uma **camada de serviços** (lógica de
domínio), resultando em quatro responsabilidades bem separadas:

```
Requisição HTTP
      │
      ▼
 [ Rotas ] ──► [ Middleware de autenticação ] ──► [ Controllers ]
                                                        │
                                                        ▼
                                                  [ Services ]  ◄──► [ Prisma / SQLite ]
                                                        │                    ▲
                                                        ▼                    │
                                                 [ API Mercado Livre ]       │
                                                        │                    │
                                                        ▼                    │
                                                  [ Views EJS ] ─────────────┘ (dados renderizados)
```

- **Rotas** (`src/routes/index.js`): declaram os *endpoints* e aplicam o middleware de autenticação.
- **Controllers** (`src/controllers/`): orquestram a requisição — leem parâmetros, chamam serviços
  e escolhem a *view* ou a resposta JSON. Não contêm regra de negócio.
- **Services** (`src/services/`): concentram a lógica de domínio (cálculos, acesso à API externa,
  consultas ao banco). São reutilizáveis e testáveis isoladamente.
- **Views** (`src/views/`): *templates* EJS renderizados no servidor.

**Decisões de projeto relevantes:**

- **Renderização no servidor (SSR) com EJS**, em vez de SPA. Justificativa: a aplicação é
  orientada a formulários e tabelas densas, com pouca interatividade cliente-lado; o SSR reduz
  complexidade, elimina *build* de *frontend* e entrega HTML pronto.
- **SQLite via Prisma.** Para uma ferramenta de uso local, o SQLite é *zero-config* (um único
  arquivo `dev.db`), e o Prisma fornece *schema* declarativo, migrações versionadas e um cliente
  tipado. A troca futura para PostgreSQL exige apenas alterar o *datasource*.
- **Isolamento multiusuário por `userId`.** Toda entidade de dados referencia o usuário dono;
  todas as consultas são escopadas, garantindo que um usuário jamais veja dados de outro.
- **Cálculos derivados sob demanda.** Margem, lucro e "Custo ML" não são persistidos: são
  calculados a cada leitura a partir dos campos base e das regras vigentes, de modo que uma
  mudança de alíquota se reflete imediatamente, sem recomputar o catálogo.

---

## 3. Pilha tecnológica

| Camada | Tecnologia | Papel |
|---|---|---|
| Runtime | **Node.js 24** (ESM) | Ambiente de execução |
| Servidor web | **Express 4** | Roteamento e *middleware* |
| Templates | **EJS** + **Bootstrap 5** (CDN) + **Bootstrap Icons** + **Inter** | Renderização e UI |
| ORM / banco | **Prisma 6** + **SQLite** | Persistência e migrações |
| Autenticação | **bcryptjs** (hash de senha) + **cookie-session** (sessão) | Login e sessão |
| Criptografia | **node:crypto** (AES-256-GCM) | Dados sensíveis em repouso |
| Agendamento | **node-cron** | Sincronização automática |
| Exportação | **ExcelJS** | Geração de `.xlsx` |
| API JSON | **jsonwebtoken** (JWT) + **cors** + **swagger-ui-express** | API `/api` para front/app e documentação |
| Configuração | **dotenv** | Variáveis de ambiente |

---

## 4. Estrutura de diretórios

```
dashboard ML/
├── prisma/
│   ├── schema.prisma          # Definição do modelo de dados
│   ├── migrations/            # Histórico de migrações versionadas
│   └── dev.db                 # Banco SQLite (NÃO versionado)
├── public/
│   ├── css/style.css          # Tema (design system) da aplicação
│   ├── js/app.js              # JS do cliente (sync, seleção, custos/medidas, menu lateral)
│   ├── js/frete-calc.js       # Calculadora de frete (cubagem + tabela do ML, cliente-lado)
│   └── js/medir.js            # Simulação da medição (câmera + balança) da tela /medir
├── src/
│   ├── config/
│   │   ├── env.js             # Carrega e valida variáveis de ambiente
│   │   ├── prisma.js          # Instância única (singleton) do Prisma Client
│   │   ├── crypto.js          # Criptografia AES-256-GCM (encrypt/decrypt)
│   │   └── jwt.js             # Assinatura/verificação dos tokens JWT da API
│   ├── middleware/
│   │   ├── auth.js            # requireAuth: exige login (web), carrega req.user
│   │   └── apiAuth.js         # requireApiAuth: token Bearer, responde 401 JSON
│   ├── controllers/           # Orquestração (web em HTML + apiController em JSON)
│   ├── services/              # Lógica de domínio (ver abaixo)
│   ├── views/                 # Templates EJS (+ partials: head, nav, footer)
│   ├── docs/openapi.js        # Especificação OpenAPI (Swagger)
│   ├── routes/
│   │   ├── index.js           # Rotas da aplicação web (HTML)
│   │   └── api.js             # Rotas da API JSON (/api)
│   ├── scheduler.js           # Cron de sincronização (00:00 e 12:00)
│   └── server.js              # Ponto de entrada (web + API + Swagger + scheduler)
├── landing-page/             # Landing page comercial (site estático independente)
│   ├── index.html · styles.css · config.js · server.js · INICIAR-LP.BAT
├── .env                       # Segredos locais (NÃO versionado)
├── .env.example               # Modelo das variáveis de ambiente
├── INICIAR.BAT                # Inicializador para Windows (app principal)
├── design.md                  # Guia do design system
└── README.md
```

**Serviços (`src/services/`):**

| Arquivo | Responsabilidade |
|---|---|
| `accountService.js` | Criação de usuário, verificação e troca de senha, validação de senha |
| `mlAuth.js` | Token válido por usuário (sobre `MlConnection`), com retry único em 401 |
| `mlApi.js` | Chamadas à API do Mercado Livre (itens, preços, frete, comissão, visitas, categoria) |
| `syncService.js` | Orquestração da sincronização e *upsert* dos anúncios; estado de progresso |
| `itemService.js` | Listagem paginada/ordenada dos anúncios e **filtros rápidos** dos KPIs (`?filter=`) |
| `calcService.js` | Cálculo de lucro/margem (`computeProfit`) e saúde do anúncio (`computeHealth`) |
| `dashboardService.js` | Agregações, KPIs, *insights* e lista de **frete divergente** do painel |
| `productService.js` | Agrupamento por SKU; custo e **medidas** (L/A/C/peso) em lote; comparação frete cobrado × real |
| `freteTable.js` | Tabela de frete do ML no servidor; `freteEstimado` (cubagem) e `avaliaDivergencia` |
| `rulesService.js` | Regras de negócio (ICMS, IPI, DIFAL, custo operacional) |
| `simulatorService.js` | Simulação de anúncio (categoria, comissão, frete, retorno) |
| `exportService.js` | Geração da planilha Excel |

---

## 5. Modelo de dados

Definido em `prisma/schema.prisma`. Seis entidades, todas (exceto `User`) escopadas a um usuário.

```
User 1───1 MlConnection       (tokens OAuth cifrados e status da conexão)
 │   1───1 Settings           (CEP de frete, data da última sincronização)
 │   1───1 BusinessRule       (alíquotas de ICMS, IPI, DIFAL, custo operacional)
 │   1───N Item               (anúncios do vendedor)
                 │
                 1───N ShippingHistory  (histórico de frete por item)
```

| Entidade | Campos principais | Observações |
|---|---|---|
| **User** | `email` (único), `storeName`, `whatsapp`, `passwordHash` | Senha com hash bcrypt |
| **MlConnection** | `mlUserId`, `accessToken`, `refreshToken`, `expiresAt`, `status`, `lastRefreshAt`, `lastError` | *Tokens* **cifrados** (AES-256-GCM); `status`: `active` / `reconnect_required` / `disconnected` |
| **Settings** | `zipCode`, `lastSyncAt` | CEP usado no cálculo de frete |
| **BusinessRule** | `icms`, `ipi`, `difal`, `custoOperacional` | Percentuais (%) |
| **Item** | `mlb`, `sku`, `titulo`, `thumbnail`, `permalink`, `custoProduto`, `largura`, `altura`, `comprimento`, `pesoReal`, `precoDe`, `precoPor`, `frete`, `comissao`, `comissaoPct`, `visitas`, `vendas`, `estoque`, `status`, `full`, `catalogo`, categorias | Único por `(userId, mlb)`. Medidas (L/A/C/peso) são aplicadas por SKU |
| **ShippingHistory** | `mlb`, `cost`, `capturedAt` | Permite detectar mudanças de frete |

---

## 6. Autenticação e sessão

Três níveis de autenticação coexistem:

1. **Autenticação do usuário na aplicação.** Cadastro com e-mail, nome da loja, WhatsApp e senha.
   A senha é validada (mínimo 8 caracteres, ao menos 1 maiúscula e 1 número) e armazenada como
   **hash bcrypt** (10 *rounds*). A sessão é mantida por **cookie assinado** (`cookie-session`),
   guardando apenas o `userId`. O *middleware* `requireAuth` protege todas as rotas internas,
   carregando `req.user` e disponibilizando dados globais às *views* (nome da loja, última sync).

2. **Autorização junto ao Mercado Livre (OAuth 2.0 + PKCE).** A plataforma tem **um único app** no
   Mercado Livre (`ML_APP_ID`, `ML_APP_SECRET`); o usuário não cadastra credenciais. Ele clica em
   **Conectar** (`GET /ml/conectar`), autoriza no Mercado Livre e volta ao sistema já conectado.
   O fluxo usa **PKCE** e um `state` de uso único. Os *tokens* ficam em `MlConnection`, cifrados,
   com `status` **`active`**, **`reconnect_required`** ou **`disconnected`**. Segundo a documentação do ML
   (verificar em developers.mercadolivre.com.br/autenticacao-e-autorizacao), o *access token* vale
   6 h e o *refresh token* é de **uso único**, com rotação a cada renovação (aqui protegida por lock
   por usuário). Um *cron* a cada 10 min renova proativamente os *tokens* que expiram em menos de
   30 min; se a renovação falhar de forma definitiva, o status vira `reconnect_required` e a
   interface exibe um banner de reconexão. Usuários anteriores à mudança foram migrados como
   `reconnect_required` e só precisam clicar em Conectar. Webhooks do ML (`items`, `orders_v2`)
   disparam sincronização seletiva.

   **Contrato do app mobile:**
   1. `POST /api/ml/oauth/start` (Bearer) devolve `{ url }`.
   2. Abrir a `url` com `openAuthSessionAsync(url, "marketplacehelper://ml/oauth")` (`expo-web-browser`).
   3. O retorno traz `?status=ok|erro&mensagem=...` no deep link.
   4. Confirmar com `GET /api/ml/connection` (status da conexão). Desconectar: `DELETE /api/ml/connection`.

   **Risco residual (mobile):** no fluxo web o callback confere que a sessão é do mesmo usuário que
   iniciou a autorização; o fluxo mobile não confere a sessão; uma página de confirmação está prevista.

3. **Token JWT da API (`/api`).** Para o front-end React, o aplicativo React Native e o dispositivo
   IoT, a API JSON autentica por **token JWT** (`Authorization: Bearer <token>`), emitido no login e
   independente da sessão web. O *middleware* `requireApiAuth` responde **401 em JSON**, sem redirecionar.
   Detalhes e endpoints na seção [Mapa de rotas](#13-mapa-de-rotas).

A recuperação de senha por e-mail existe como **placeholder** (interface pronta, envio de e-mail
ainda não configurado).

---

## 7. Integração com a API do Mercado Livre

A camada `mlApi.js` encapsula as chamadas. Cada requisição usa o *token* válido do usuário
(renovado se necessário) e trata *rate limit* (HTTP 429) e erros transitórios com *retry*; erros
definitivos (4xx) não são repetidos.

| Endpoint | Uso |
|---|---|
| `POST /oauth/token` | Troca de `code` e renovação de *token* |
| `GET /users/me` | Dados do vendedor (nickname, reputação, foto, vendas) |
| `GET /users/{id}/items/search?search_type=scan` | Lista **todos** os MLBs (paginação por *scroll*) |
| `GET /items?ids=...&include_attributes=all` | Detalhes de até 20 itens por chamada (*multiget*) |
| `GET /items/{mlb}/prices` | Preços e **promoções** ativas |
| `GET /items/{mlb}/shipping_options?zip_code=` | Custo de **frete** por CEP |
| `GET /visits/items?ids={mlb}` | **Visitas** (apenas 1 item por chamada) |
| `GET /sites/MLB/listing_prices?...` | **Comissão** (tarifa de venda) por preço/categoria/tipo |
| `GET /sites/MLB/domain_discovery/search?q=` | Predição de **categoria** a partir do título |
| `GET /categories/{id}` | Caminho da categoria (com cache) |

**Particularidades tratadas (notas de implementação):**

- **Promoções:** o campo `original_price` do item vem nulo em promoções de canal; a promoção real
  é obtida em `/items/{mlb}/prices` (tipo `promotion`, respeitando a janela de validade).
- **Frete:** anúncios **pausados/fechados** retornam 404 no cálculo de frete (sem estoque para
  cotar). Para itens de baixo valor, aplica-se a tabela fixa de contribuição do ML.
- **Visitas:** o endpoint passou a aceitar **apenas 1 ID por chamada**; a sincronização consulta
  item a item.
- **Busca pública** (`/sites/MLB/search`) está **bloqueada (403)** para aplicativos; por isso o
  simulador estima frete a partir dos **próprios anúncios** do usuário na mesma categoria.
- **Link do anúncio:** usa-se o `permalink` oficial retornado pela API (a rota `/anuncio/MLB...`
  não existe).

---

## 8. Regras de negócio e cálculo financeiro

O cálculo central está em `calcService.js::computeProfit(item, rules)`:

```
base      = precoPor  (se houver promoção)  |  precoDe  (caso contrário)
impostos  = base × (ICMS + IPI + DIFAL + Custo Operacional) / 100
lucro     = base − custoProduto − comissão − frete − impostos
margem    = lucro / base × 100
custoML   = comissão + frete            (quanto o Mercado Livre "consome")
```

As alíquotas vêm da entidade `BusinessRule` (tela *Regras*). O custo do produto é informado pelo
vendedor (tela *Produtos*, por SKU).

**Saúde do anúncio** (`computeHealth`) — avaliada em ordem, exibindo o primeiro estado aplicável:

`Inativo` (status ≠ ativo) → `Sem estoque` (estoque ≤ 0) → `Preencher custo` (custo ausente) →
`Prejuízo` (margem < 0) → `Margem baixa` (margem < 8%) → `Saudável`.

O limiar de **8%** separa, em toda a aplicação, o **alto desempenho** (margem ≥ 8%) do **baixo
desempenho** (0% ≤ margem < 8%).

**Frete real × cobrado** (`freteTable.js`) — com as medidas do produto (largura, altura,
comprimento e peso, por SKU), estima-se o **frete real** pela tabela de cubagem do Mercado Livre:

```
cubagem      = (largura × altura × comprimento em cm) / 6000
considerado  = maior(peso real, cubagem)
frete real   = tabela_ML(considerado, preço de venda)   (coluna por faixa de preço)
divergente   = |frete real − frete cobrado| ≥ R$ 2
```

O **frete cobrado** é o `Item.frete` vindo da API. Δ positivo = real acima do cobrado (dimensões
**subdeclaradas** no ML, risco de cobrança extra); negativo = **superdeclaradas** (pagando a mais).

---

## 9. Funcionalidades por módulo

- **Dashboard** (`/` — **página principal**; também em `/dashboard`): é a tela de entrada da
  aplicação e o destino do logo. Reúne **KPIs clicáveis** organizados em três grupos, em que cada
  cartão abre a lista de anúncios já filtrada:
  - *Desempenho*: nº **no prejuízo**, **baixo desempenho** (0–8%), **alto desempenho** (≥ 8%) e
    **no catálogo**;
  - *Estoque & cadastro*: **estoque baixo** (≤ 5, ativos), **Full com estoque baixo**, **sem custo**
    e **ticket médio**;
  - *Saúde financeira*: **custo médio do ML** (comissão + frete sobre o preço, %), **lucro líquido
    médio**, **margem média** e **cobertura de custo**.

  Traz ainda uma seção **Frete divergente** (anúncios cujo frete real difere do cobrado), a seção de
  **insights** acionáveis (também com *deep-link* para a lista filtrada), **últimos anúncios** em
  cards com cálculo e saúde, distribuição por tipo/Full/Catálogo e análises de frete.
- **Anúncios** (`/anuncios`): tabela densa com busca (MLB/título/SKU), ordenação por coluna e
  **cabeçalho fixo**. No desktop há um **alternador de visualização** entre *planilha* e *cards*
  (os cards em grade, mesmo layout do mobile; a escolha é lembrada no navegador); no mobile é sempre
  em cards. Aceita **filtros rápidos** vindos dos KPIs do dashboard (`?filter=`), com *chip* do
  filtro ativo e botão de limpar. Permite **seleção** para sincronizar um subconjunto e **exportar
  para Excel**. O selo de **Full** aparece como um *badge* verde com raio.
- **Produtos** (`/produtos`): agrupa os anúncios por **SKU**. O **custo** e as **medidas**
  (largura/altura/comprimento/peso) preenchidos aqui são aplicados a **todos** os anúncios daquele
  SKU. Com as medidas, mostra o **frete cobrado × frete real** e um *badge* de divergência por
  produto. Busca por SKU, nome ou MLB.
- **Medição** (`/medir`): simulação do app com **câmera + balança Bluetooth**. A câmera "mede" as
  dimensões, a balança "envia" o peso, o usuário informa o SKU e as medidas são salvas no produto —
  já comparando o frete cobrado com o real. Como a web não tem sensor de profundidade nem a balança
  física, a câmera e a balança são **simuladas** (valores editáveis), prontas para serem trocadas
  pela leitura real no app móvel.
- **Calculadora de Frete** (`/frete`): calcula a **cubagem** (peso volumétrico = L × A × C ÷ 6000),
  usa o **maior** entre peso real e peso cubado e, com o preço de venda, consulta o **custo de
  envio** na tabela oficial do Mercado Livre (MercadoLíder / reputação verde / sem reputação).
  Mostra o resultado em tempo real e destaca a célula correspondente na tabela de referência. É um
  cálculo **cliente-lado** (`public/js/frete-calc.js`), sem chamadas à API.
- **Regras** (`/regras`): cadastro das alíquotas, com explicação do cálculo e um **exemplo
  dinâmico** usando os valores do próprio usuário.
- **Simulador** (`/simulador`): a partir de um título e preço, prediz a categoria, calcula a
  comissão no **Clássico** e no **Premium**, estima o frete e compara o retorno lado a lado.
- **Autorização** (`/auth`): botão Conectar/Desconectar a conta do Mercado Livre e status da conexão.
- **Minha Conta** (`/conta`): edição de nome da loja, e-mail e WhatsApp; troca de senha; e um
  cartão com os **dados e a foto** da conta do Mercado Livre.

---

## 10. Sincronização e agendamento

A sincronização (`syncService.js`) percorre todos os anúncios do vendedor, buscando detalhes,
preços, frete, comissão, visitas e categoria, e faz *upsert* em `Item`. Executa **em segundo
plano**, expondo o progresso via `GET /sync/status` (consumido por *polling* na interface).

Salvaguardas: não sobrescreve um valor válido (frete/comissão) por nulo em caso de falha
transitória; registra `Settings.lastSyncAt` ao concluir.

O `scheduler.js` (node-cron) dispara a sincronização de **todas as contas autorizadas** à
**meia-noite (00:00)** e ao **meio-dia (12:00)** — `cron: 0 0,12 * * *`, no fuso
**America/Sao_Paulo** (configurável por `TZ`), independentemente do relógio do servidor (em nuvem,
normalmente UTC). O agendamento só ocorre com o servidor em execução — por isso, em produção, a
hospedagem precisa manter o processo **sempre ligado** (ver seção 16).

---

## 11. Segurança

- **Senhas:** *hash* **bcrypt** (irreversível, com *salt*). Nunca armazenadas ou exibidas em claro.
- **Dados sensíveis do Mercado Livre:** `accessToken` e `refreshToken` são
  **cifrados em repouso** com **AES-256-GCM** (`crypto.js`), no formato `enc:v1:<iv>:<tag>:<dados>`.
  A chave deriva de `ENCRYPTION_KEY` (variável de ambiente). Mesmo que o arquivo `dev.db` vaze,
  esses segredos permanecem ilegíveis sem a chave. O *secret* nunca é devolvido à interface.
- **Sessão:** *cookie* assinado com `SESSION_SECRET`; guarda apenas o `userId`. Em produção
  (`NODE_ENV=production`) o *cookie* recebe a flag `Secure` (só trafega por HTTPS) e o Express
  confia no *proxy* da hospedagem (`trust proxy`) para reconhecer a conexão HTTPS.
- **Segredos obrigatórios em produção:** com `NODE_ENV=production`, o servidor **recusa iniciar**
  se `SESSION_SECRET` ou `ENCRYPTION_KEY` não estiverem definidos — evita subir com os valores
  padrão do código.
- **Versionamento:** `.env` (segredos) e `dev.db` (banco) estão no `.gitignore` — nada sensível é
  publicado no repositório.

> **Importante:** `ENCRYPTION_KEY` e `SESSION_SECRET` devem permanecer **estáveis**. Alterar a
> chave de criptografia torna os dados cifrados irrecuperáveis (seria necessário reautorizar o ML).

---

## 12. Landing page

A pasta `landing-page/` contém uma **página comercial estática** (HTML/CSS), servida por
um servidor Node **sem dependências** na porta **8080** (`INICIAR-LP.BAT`). Apresenta a solução,
seus recursos, um comparativo "antes × depois", FAQ e um **botão flutuante de WhatsApp**
(número configurável em `config.js`). Os botões *Entrar* e *Crie sua conta* apontam para o
aplicativo (`window.APP_URL`, por padrão `http://localhost:3333`). Por ser estática, pode ser
hospedada em qualquer serviço (Vercel, Netlify, GitHub Pages, etc.) sem o Node.

---

## 13. Mapa de rotas

**Públicas:** `GET/POST /login` · `GET/POST /register` · `GET/POST /recuperar-senha` · `GET/POST /logout`

**Protegidas (exigem login):**

| Método | Rota | Função |
|---|---|---|
| GET | `/` | **Painel de KPIs e insights (página principal)** |
| GET | `/dashboard` | Painel de KPIs e insights (alias de `/`) |
| GET | `/anuncios` | Lista de anúncios (busca, ordenação, `?filter=`) |
| GET | `/produtos` | Produtos agrupados por SKU (custo, medidas, frete cobrado × real) |
| POST | `/produtos/custo` | Define custo de um SKU (aplica a todos os anúncios) |
| POST | `/produtos/medidas` | Define as medidas (L/A/C/peso) de um SKU e devolve a comparação de frete |
| GET | `/medir` | Medição do produto (câmera + balança simuladas) |
| GET | `/frete` | Calculadora de frete (cubagem + tabela do ML) |
| GET/POST | `/regras` | Regras de negócio (impostos/custos) |
| GET/POST | `/simulador` | Simulador de anúncio |
| GET | `/auth` · GET `/ml/conectar` · POST `/ml/desconectar` | Autorização Mercado Livre (1 clique) |
| POST | `/sync` · POST `/sync/selection` · GET `/sync/status` | Sincronização e progresso |
| POST | `/settings/zip` | CEP de cálculo de frete |
| GET | `/export` | Exporta Excel |
| GET | `/conta` · POST `/conta/perfil` · POST `/conta/senha` | Minha conta |

### API JSON (`/api`) — para front React, app React Native e IoT

Além das páginas renderizadas acima, a aplicação expõe uma **API JSON** em `/api`, para um front-end
web (React), um aplicativo mobile (React Native) e o dispositivo IoT. A autenticação é por **token JWT**
(`Authorization: Bearer <token>`), independente da sessão web. O **CORS** é liberado em `/api`. A
documentação interativa (**Swagger UI**) fica em **`/api/docs`** e a especificação OpenAPI em
`/api/openapi.json`.

| Método | Rota | Função |
|---|---|---|
| POST | `/api/login` · `/api/register` | Autentica/cria conta e devolve `{ token, user }` (públicas) |
| GET | `/api/me` | Usuário autenticado e status da conexão com o Mercado Livre |
| GET | `/api/dashboard` | KPIs, insights e frete divergente |
| GET | `/api/anuncios` | Lista de anúncios (`search`, `sort`, `dir`, `filter`, `page`) |
| GET | `/api/produtos` | Produtos por SKU (custo, medidas, frete cobrado × real) |
| POST | `/api/produtos/:sku/custo` · `/api/produtos/:sku/medidas` | Define custo / medidas do SKU |
| GET/PUT | `/api/regras` | Regras de negócio (alíquotas) |
| GET | `/api/frete/estimar` | Calculadora de frete por cubagem |
| GET/PUT | `/api/config` · `/api/config/cep` | CEP e última sincronização |
| POST/GET | `/api/sync` · `/api/sync/status` | Sincronização e progresso |
| POST | `/api/ml/oauth/start` | (Bearer) Inicia o OAuth e devolve `{ url }` para o app mobile |
| GET · DELETE | `/api/ml/connection` | (Bearer) Status da conexão ML / desconectar |
| GET | `/api/ml/oauth/callback` | (pública) Retorno do Mercado Livre; redireciona ao web ou ao deep link |
| POST | `/api/ml/webhooks` | (pública) Notificações do ML (`items`, `orders_v2`) |
| POST | `/api/iot/medidas` | Recebe a leitura do dispositivo (peso + dimensões) e salva no SKU |

As regras de negócio são as mesmas da web: a API apenas serializa em JSON os resultados dos *services*.

---

## 14. Variáveis de ambiente

Arquivo `.env` (modelo em `.env.example`):

| Variável | Descrição |
|---|---|
| `PORT` | Porta do aplicativo (padrão **3333**; em nuvem, a hospedagem define sozinha) |
| `SESSION_SECRET` | Segredo de assinatura do *cookie* de sessão (aleatório, estável) — **obrigatório em produção** |
| `JWT_SECRET` | Segredo dos tokens JWT da API `/api` (opcional; usa `SESSION_SECRET` se vazio) |
| `ENCRYPTION_KEY` | Chave (64 hex) para cifrar segredos do ML no banco (estável) — **obrigatório em produção** |
| `DATABASE_URL` | Caminho do SQLite — local: `file:./dev.db`; produção: `file:/data/prod.db` (volume) |
| `NODE_ENV` | `production` no servidor: ativa *cookie* `Secure`, `trust proxy` e a checagem de segredos |
| `ML_APP_ID` | ID do app único da plataforma no Mercado Livre |
| `ML_APP_SECRET` | Secret do app ML |
| `ML_REDIRECT_URI` | Redirect URI do OAuth (padrão `${APP_URL}/api/ml/oauth/callback`; produção: `https://app.marketplacehelper.com.br/api/ml/oauth/callback`) |
| `MOBILE_OAUTH_REDIRECT` | Deep link de retorno do app mobile (padrão `marketplacehelper://ml/oauth`) |
| `TZ` | Fuso do agendamento (padrão **America/Sao_Paulo**) |

**Painel do app no Mercado Livre** (developers.mercadolivre.com.br): cadastrar a mesma Redirect URI
de `ML_REDIRECT_URI`, **habilitar PKCE** e configurar as notificações com URL
`https://app.marketplacehelper.com.br/api/ml/webhooks` e tópicos **`items`** e **`orders_v2`**.

---

## 15. Passo a passo: executar em uma nova máquina

### Pré-requisitos

- **Node.js 18 ou superior** (desenvolvido em Node 24). Baixe em <https://nodejs.org>.
- **Git** (para clonar) — opcional se você copiar a pasta manualmente.
- Uma **conta de desenvolvedor no Mercado Livre** com **um único aplicativo** da plataforma criado
  (<https://developers.mercadolivre.com.br>). O dono da plataforma obtém o **App ID** e a
  **Secret Key** (`ML_APP_ID`, `ML_APP_SECRET`) e cadastra a **Redirect URI**
  (`<APP_URL>/api/ml/oauth/callback`), com **PKCE** habilitado. Os usuários finais não precisam de
  conta de desenvolvedor.

### 15.1. Obter o código

```bash
git clone https://github.com/bebaby-processosdigitais/marketplace-helper.git
cd marketplace-helper
```

### 15.2. Instalar as dependências

```bash
npm install
```

### 15.3. Criar o arquivo `.env`

Copie o modelo e gere os segredos:

```bash
cp .env.example .env
```

Gere valores aleatórios para `SESSION_SECRET` e `ENCRYPTION_KEY`:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Edite o `.env` deixando-o assim (substituindo pelos valores gerados):

```
PORT=3333
SESSION_SECRET=<valor_gerado>
ENCRYPTION_KEY=<valor_gerado>
DATABASE_URL="file:./dev.db"
```

> Guarde esses valores com segurança. Se perder `ENCRYPTION_KEY` depois de autorizar o ML,
> será preciso reautorizar.

### 15.4. Preparar o banco de dados

```bash
npx prisma migrate deploy
npx prisma generate
```

Isso cria o `dev.db` (vazio) e o cliente do Prisma.

### 15.5. Iniciar a aplicação

```bash
npm start
```

Acesse **<http://localhost:3333>** (aplicação web) e **<http://localhost:3333/api/docs>** (documentação da API).

> **No Windows**, em vez dos passos 15.2 a 15.5, basta um duplo clique em **`INICIAR.BAT`**:
> ele instala dependências (na primeira vez), prepara o banco, libera a porta 3333 e abre o Chrome.

### 15.6. Primeiro uso (dentro do aplicativo)

1. **Crie sua conta** (nome da loja, e-mail, WhatsApp, senha).
2. Em **Autorização**, clique em **Conectar com Mercado Livre**, faça login e autorize. Você volta
   ao sistema já conectado, sem copiar código nem informar credenciais.
3. (Configuração do dono da plataforma, uma única vez: `ML_APP_ID`, `ML_APP_SECRET` e
   `ML_REDIRECT_URI` no `.env`.)
4. Em **Anúncios**, clique em **Atualizar tudo** para importar o catálogo.
5. Em **Produtos**, preencha os **custos** e as **medidas** (L/A/C/peso) por SKU — ou use
   **Medição** para capturar as medidas; em **Regras**, informe as **alíquotas**.
6. Consulte o **Dashboard** para ver lucro, margem, *insights* e **frete divergente**.

### 15.7. (Opcional) Landing page

```bash
cd landing-page
npm start        # ou duplo clique em INICIAR-LP.BAT (Windows)
```

Acesse **<http://localhost:8080>**.

---

## 16. Publicação online (deploy no Railway)

Para hospedar a aplicação, ela precisa de três coisas: **processo sempre ligado** (o *cron* de
sincronização roda dentro do servidor), **disco persistente** (o banco SQLite é um arquivo) e
**HTTPS com domínio público** (exigido pela Redirect URI do Mercado Livre). O
**[Railway](https://railway.com)** atende aos três sem mudanças na arquitetura. Outras opções
equivalentes: **Render** (plano pago, com *disk*) ou **Fly.io** (com *volume*). Evite planos que
"hibernam" o app ou que não têm disco persistente (ex.: Render *free*, Vercel, Netlify) — neles o
*cron* não dispara e o banco é apagado a cada reinício.

### 16.1. Criar o serviço

1. Envie o código para o GitHub (o `.env` e o `*.db` **não** são versionados).
2. No Railway: **New Project → Deploy from GitHub repo** e selecione o repositório. O Node é
   detectado automaticamente e o `npm install` roda o `postinstall` (`prisma generate`).
3. Em **Settings → Deploy → Custom Start Command**, informe:

   ```bash
   npm run start:prod
   ```

   Esse script aplica as migrações (`prisma migrate deploy`) **a cada inicialização** e depois sobe
   o servidor. As migrações precisam rodar no *start* (e não no *build*) porque o volume com o banco
   só fica disponível com o serviço em execução.

### 16.2. Criar o volume (disco persistente)

No serviço, **Add Volume** com *mount path* **`/data`**. É nele que o banco `prod.db` vai morar; sem
o volume, todos os dados seriam perdidos a cada *deploy*.

### 16.3. Variáveis de ambiente

Em **Variables**, cadastre (gere os segredos como na seção 15.3 — valores **novos**, diferentes
dos usados localmente):

```
NODE_ENV=production
DATABASE_URL=file:/data/prod.db
SESSION_SECRET=<valor_gerado>
JWT_SECRET=<valor_gerado>
ENCRYPTION_KEY=<valor_gerado>
TZ=America/Sao_Paulo
```

Não defina `PORT`: o Railway injeta a porta automaticamente e o app já a lê.

### 16.4. Domínio público

Em **Settings → Networking → Generate Domain**. O Railway fornece um endereço
`https://<nome>.up.railway.app` com HTTPS pronto. Acesse-o e confira se a tela de login abre
(e `https://<nome>.up.railway.app/api/docs` para a documentação da API).

### 16.5. Ajustar o Mercado Livre

1. No painel de desenvolvedor do ML (<https://developers.mercadolivre.com.br>), edite o aplicativo
   único da plataforma: cadastre a **Redirect URI**
   `https://<nome>.up.railway.app/api/ml/oauth/callback`, habilite **PKCE** e configure as
   notificações (`https://<nome>.up.railway.app/api/ml/webhooks`, tópicos `items` e `orders_v2`).
2. No serviço do Railway, defina `ML_APP_ID`, `ML_APP_SECRET` e `ML_REDIRECT_URI` com **o mesmo
   valor** da Redirect URI do painel (precisa ser **idêntica** nos dois lugares), além de
   `MOBILE_OAUTH_REDIRECT` se usar o app mobile.
3. Na aplicação publicada, crie sua conta e clique em **Conectar com Mercado Livre**: o ML devolve o
   navegador para `/api/ml/oauth/callback` e o app troca o código pelos tokens sozinho.
4. Rode um **Atualizar tudo** em **Anúncios**.

### 16.6. Verificação

Nos *logs* do *deploy* devem aparecer:

```
All migrations have been successfully applied.
  Marketplace Helper rodando em http://localhost:<porta>
  Sincronização automática agendada para 00:00 e 12:00 (America/Sao_Paulo).
```

Se aparecer `Variáveis de ambiente obrigatórias em produção ausentes`, falta cadastrar
`SESSION_SECRET` e/ou `ENCRYPTION_KEY`.

### 16.7. Landing page

Antes de publicar, troque em `landing-page/config.js` o `window.APP_URL` para o endereço do app
publicado (ex.: `https://<nome>.up.railway.app`) — é ele que monta os botões de login/cadastro.

**No Railway (mesmo projeto, segundo serviço):**

1. No canvas do projeto: **+ Create → GitHub Repo** e selecione **o mesmo repositório**.
2. No novo serviço, **Settings → Source → Root Directory**: `landing-page`. Assim o Railway usa o
   `package.json` da pasta (`npm start` → `node server.js`, sem dependências).
3. (Opcional) **Settings → Source → Watch Paths**: `/landing-page/**` — só redeploya a landing
   quando arquivos dessa pasta mudarem.
4. **Settings → Networking → Generate Domain**. Não é preciso volume nem variáveis: o servidor lê
   a `PORT` injetada pelo Railway.

**Alternativa gratuita:** por ser estática, também pode ir para **GitHub Pages**, **Netlify** ou
**Vercel**, apontando para a pasta `landing-page/`.

> **Backup:** o banco inteiro é o arquivo `/data/prod.db`. Para uma cópia de segurança, use os
> *backups* de volume do Railway ou baixe o arquivo periodicamente.

---

## 17. Scripts disponíveis

| Comando | Ação |
|---|---|
| `npm start` | Inicia o servidor (`node src/server.js`) |
| `npm run start:prod` | Produção: aplica as migrações (`prisma migrate deploy`) e inicia o servidor |
| `npm run dev` | Inicia com *watch* (reinício automático ao salvar) |
| `postinstall` | Automático após `npm install`: gera o Prisma Client |
| `npm run prisma:migrate` | Cria/aplica migrações em desenvolvimento |
| `npm run prisma:generate` | Regenera o Prisma Client |
| `npm run prisma:studio` | Abre o Prisma Studio (inspeção visual do banco) |

---

## 18. Solução de problemas

- **Porta 3333 ocupada / "EADDRINUSE":** há um servidor antigo em execução. O `INICIAR.BAT` já
  libera a porta automaticamente; manualmente, encerre o processo Node correspondente.
- **A tela mostra código antigo após uma atualização:** o processo em memória precisa reiniciar.
  Feche a janela do servidor e rode o `INICIAR.BAT` novamente.
- **Erro de autorização no Mercado Livre:** confira se a **Redirect URI** no painel do ML é
  **idêntica** a `ML_REDIRECT_URI` (padrão `<APP_URL>/api/ml/oauth/callback`) e se o PKCE está
  habilitado.
- **Banner "reconectar" na interface:** a conexão está em `reconnect_required` (refresh recusado
  ou revogado); clique em **Conectar com Mercado Livre** novamente.
- **Campos do Prisma "unknown" / coluna inexistente:** rode `npx prisma migrate deploy` e
  `npx prisma generate` (o `INICIAR.BAT` faz isso a cada início).
- **Login não "segura" localmente com `NODE_ENV=production`:** em produção o *cookie* é `Secure`
  e só é aceito via HTTPS. Para rodar localmente, não defina `NODE_ENV` (ou use `development`).
- **Dados somem após um *deploy* (Railway):** o `DATABASE_URL` não aponta para o volume, ou o
  volume não está montado em `/data` (ver seção 16.2).
- **Imagens/permalinks ausentes nos anúncios antigos:** execute um **Atualizar tudo** — esses
  campos passam a ser capturados na sincronização.

---

## 19. Limitações conhecidas e trabalhos futuros

- **Recuperação de senha por e-mail:** interface pronta; falta integrar um provedor de e-mail.
- **Status de vencedor no catálogo:** o KPI "No catálogo" conta anúncios **no** catálogo; distinguir
  quem está **ganhando** o *buy box* exigiria uma chamada `price_to_win` por item na sincronização.
- **Medição real (câmera + balança):** a tela `/medir` é hoje uma **simulação** — a web não tem
  sensor de profundidade nem acesso à balança física. No app móvel, bastaria trocar os botões de
  simulação pela medição real da câmera e pela leitura **Web Bluetooth** da balança; o cálculo de
  frete real, o armazenamento por SKU e a detecção de divergência já estão prontos.
- **Usuários convidados (equipe):** planejado — permitir que a conta dona conceda acesso de
  leitura a usuários adicionais compartilhando os mesmos dados.
- **Agendamento sempre ativo:** o cron depende do servidor em execução; a hospedagem precisa manter
  o processo ligado (ver seção 16).
- **Escala:** a configuração atual (SQLite + sincronização e *cron* no mesmo processo da web) foi
  pensada para **uma única instância** e poucas dezenas de usuários. Para escalar, os próximos
  passos seriam: migrar para **PostgreSQL** (com índices compostos por `userId`); mover a
  sincronização para uma **fila de *jobs*** com *worker* separado e concorrência controlada (hoje
  o *cron* dispara o *sync* de todas as contas ao mesmo tempo); guardar o progresso do *sync* fora
  da memória; aplicar *lock* na renovação do *token* do ML; e persistir margem/lucro calculados para
  que filtros e ordenações rodem no banco.

---

## 20. Licença

Uso interno / proprietário.
