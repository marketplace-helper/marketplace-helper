// Especificação OpenAPI 3 da API JSON do Marketplace Helper.
// Servida pelo Swagger UI em /api/docs.

const bearer = [{ bearerAuth: [] }];
const json = (example) => ({ content: { "application/json": { example } } });

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Marketplace Helper API",
    version: "1.0.0",
    description:
      "API JSON do Marketplace Helper para consumo por front-end web (React) e aplicativo mobile (React Native), " +
      "além do dispositivo IoT (ESP32). Autenticação por token JWT no cabeçalho Authorization: Bearer <token>.",
  },
  servers: [{ url: "/api", description: "API (mesma origem do servidor)" }],
  tags: [
    { name: "Autenticação" },
    { name: "Conta" },
    { name: "Mercado Livre" },
    { name: "Dados" },
    { name: "Produtos" },
    { name: "Frete" },
    { name: "Sincronização" },
    { name: "Config" },
    { name: "IoT" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Erro: { type: "object", properties: { error: { type: "string" } } },
      Usuario: {
        type: "object",
        properties: {
          id: { type: "integer" },
          email: { type: "string" },
          storeName: { type: "string" },
          whatsapp: { type: "string", nullable: true },
        },
      },
      Login: {
        type: "object",
        required: ["email", "password"],
        properties: { email: { type: "string" }, password: { type: "string" } },
      },
      Medidas: {
        type: "object",
        properties: {
          largura: { type: "number", description: "cm" },
          altura: { type: "number", description: "cm" },
          comprimento: { type: "number", description: "cm" },
          pesoReal: { type: "number", description: "kg" },
        },
      },
    },
  },
  security: bearer,
  paths: {
    "/login": {
      post: {
        tags: ["Autenticação"], summary: "Autentica e retorna um token JWT", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Login" }, example: { email: "vendedor@loja.com", password: "SenhaForte1" } } } },
        responses: {
          200: json({ token: "eyJhbGciOi...", user: { id: 1, email: "vendedor@loja.com", storeName: "Minha Loja", whatsapp: null } }),
          401: { description: "Credenciais inválidas", ...json({ error: "E-mail ou senha inválidos." }) },
          403: { description: "E-mail ainda não confirmado", ...json({ error: "E-mail não confirmado. Use o link enviado no cadastro." }) },
        },
      },
    },
    "/register": {
      post: {
        tags: ["Autenticação"], summary: "Cria uma conta e envia o link de confirmação por e-mail (login liberado após confirmar)", security: [],
        requestBody: { required: true, content: { "application/json": { example: { email: "novo@loja.com", storeName: "Loja Nova", whatsapp: "11999990000", password: "SenhaForte1" } } } },
        responses: {
          201: json({ message: "Conta criada. Enviamos um link de confirmação para o e-mail informado.", user: { id: 2, email: "novo@loja.com", storeName: "Loja Nova", whatsapp: "11999990000" } }),
          400: { description: "Dados inválidos", ...json({ error: "A senha deve ter no mínimo 8 caracteres." }) },
          409: { description: "E-mail já cadastrado", ...json({ error: "E-mail já cadastrado." }) },
        },
      },
    },
    "/me": {
      get: {
        tags: ["Conta"], summary: "Dados do usuário autenticado e status da conexão com o Mercado Livre", security: bearer,
        responses: { 200: json({ user: { id: 1, email: "vendedor@loja.com", storeName: "Minha Loja", whatsapp: null }, mercadoLivre: { authenticated: true } }), 401: { description: "Não autenticado", ...json({ error: "Token inválido ou expirado." }) } },
      },
    },
    "/ml/oauth/start": {
      post: {
        tags: ["Mercado Livre"], summary: "Inicia a conexão OAuth com o Mercado Livre (mobile)", security: bearer,
        description: "Retorna a URL de autorização. Abra-a no navegador do aparelho; ao final o app é reaberto em marketplacehelper://ml/oauth?status=ok|erro&mensagem=...",
        responses: { 200: json({ url: "https://auth.mercadolivre.com.br/authorization?response_type=code&..." }) },
      },
    },
    "/ml/oauth/callback": {
      get: {
        tags: ["Mercado Livre"], summary: "Retorno do Mercado Livre após a autorização (uso interno)", security: [],
        parameters: [
          { name: "code", in: "query", schema: { type: "string" } },
          { name: "state", in: "query", schema: { type: "string" } },
          { name: "error", in: "query", schema: { type: "string" } },
        ],
        responses: { 302: { description: "Redireciona para /auth (web) ou para o deep link do app (mobile)" } },
      },
    },
    "/ml/connection": {
      get: {
        tags: ["Mercado Livre"], summary: "Status da conexão com o Mercado Livre", security: bearer,
        responses: { 200: json({ authenticated: true, status: "active", reconnectRequired: false, mlUserId: "123456", expiresAt: "2026-11-23T18:00:00.000Z" }) },
      },
      delete: {
        tags: ["Mercado Livre"], summary: "Desconecta a conta do Mercado Livre", security: bearer,
        responses: { 204: { description: "Desconectado" } },
      },
    },
    "/dashboard": {
      get: {
        tags: ["Dados"], summary: "KPIs, insights e frete divergente do painel", security: bearer,
        responses: { 200: json({ prejuizo: 3, altoDesempenho: 18, freteDivergente: 5, ticketMedio: 155.78, divergentesTop: [{ mlb: "MLB123", titulo: "Produto X", freteCobrado: 10, freteReal: 58.75, delta: 48.75 }] }) },
      },
    },
    "/anuncios": {
      get: {
        tags: ["Dados"], summary: "Lista de anúncios (com lucro, margem e saúde)", security: bearer,
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "MLB, título ou SKU" },
          { name: "sort", in: "query", schema: { type: "string" }, description: "mlb, titulo, precoDe, margem, lucro, custoML, visitas, vendas, estoque…" },
          { name: "dir", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "filter", in: "query", schema: { type: "string", enum: ["prejuizo", "alto", "baixo", "catalogo", "estoque_baixo", "full_estoque_baixo", "sem_custo", "frete_divergente"] } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: json({ total: 42, page: 1, totalPages: 1, filterLabel: "", items: [{ mlb: "MLB123", titulo: "Produto X", precoDe: 100, precoPor: 100, frete: 16, comissao: 17, _calc: { base: 100, lucro: 40, margem: 40, custoML: 33 } }] }) },
      },
    },
    "/produtos": {
      get: {
        tags: ["Produtos"], summary: "Produtos agrupados por SKU (custo, medidas e frete cobrado × real)", security: bearer,
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: json({ total: 10, page: 1, totalPages: 1, products: [{ sku: "SKA", nome: "Produto A", qtd: 2, custo: 70, largura: 40, altura: 30, comprimento: 50, pesoReal: 2, freteCobrado: 10, freteReal: 58.75, delta: 48.75, divergente: true }] }) },
      },
    },
    "/produtos/export": {
      get: {
        tags: ["Produtos"], summary: "Exporta os produtos (custo, medidas, tamanho no Full e frete) em Excel", security: bearer,
        parameters: [{ name: "search", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Planilha .xlsx", content: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {} } } },
      },
    },
    "/produtos/{sku}/custo": {
      post: {
        tags: ["Produtos"], summary: "Define o custo de um SKU (aplica a todos os anúncios)", security: bearer,
        parameters: [{ name: "sku", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { example: { custo: 70 } } } },
        responses: { 200: json({ ok: true, custoProduto: 70, afetados: 2 }) },
      },
    },
    "/produtos/{sku}/medidas": {
      post: {
        tags: ["Produtos"], summary: "Define as medidas de um SKU e retorna a comparação de frete", security: bearer,
        parameters: [{ name: "sku", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Medidas" }, example: { largura: 40, altura: 30, comprimento: 50, pesoReal: 2 } } } },
        responses: { 200: json({ ok: true, afetados: 1, comparacao: { cubagem: 10, considerado: 10, freteReal: 58.75, freteCobrado: 10, delta: 48.75, divergente: true } }) },
      },
    },
    "/regras": {
      get: { tags: ["Dados"], summary: "Regras de negócio (alíquotas)", security: bearer, responses: { 200: json({ icms: 12, ipi: 0, difal: 0, custoOperacional: 3 }) } },
      put: { tags: ["Dados"], summary: "Atualiza as regras de negócio", security: bearer, requestBody: { required: true, content: { "application/json": { example: { icms: 12, ipi: 0, difal: 0, custoOperacional: 3 } } } }, responses: { 200: json({ ok: true, icms: 12, ipi: 0, difal: 0, custoOperacional: 3 }) } },
    },
    "/frete/estimar": {
      get: {
        tags: ["Frete"], summary: "Calcula o frete por cubagem (calculadora)", security: bearer,
        parameters: [
          { name: "largura", in: "query", required: true, schema: { type: "number" }, description: "cm" },
          { name: "altura", in: "query", required: true, schema: { type: "number" }, description: "cm" },
          { name: "comprimento", in: "query", required: true, schema: { type: "number" }, description: "cm" },
          { name: "peso", in: "query", required: true, schema: { type: "number" }, description: "kg" },
          { name: "preco", in: "query", required: true, schema: { type: "number" }, description: "R$" },
        ],
        responses: { 200: json({ cubagem: 10, considerado: 10, usaCubagem: true, frete: 58.75 }), 400: { description: "Parâmetros inválidos", ...json({ error: "Informe largura, altura, comprimento, peso e preço válidos." }) } },
      },
    },
    "/config": {
      get: { tags: ["Config"], summary: "CEP de frete e última sincronização", security: bearer, responses: { 200: json({ zipCode: "01001000", lastSyncAt: "2026-11-03T12:00:00.000Z" }) } },
    },
    "/config/cep": {
      put: { tags: ["Config"], summary: "Atualiza o CEP usado no cálculo de frete", security: bearer, requestBody: { required: true, content: { "application/json": { example: { zipCode: "18110000" } } } }, responses: { 200: json({ ok: true, zipCode: "18110000" }) } },
    },
    "/sync": {
      post: { tags: ["Sincronização"], summary: "Inicia a sincronização dos anúncios (opcionalmente de uma seleção)", security: bearer, requestBody: { content: { "application/json": { example: { mlbs: ["MLB123", "MLB456"] } } } }, responses: { 200: json({ ok: true, state: { running: true, phase: "iniciando", processed: 0, totalIds: 0 } }) } },
    },
    "/sync/status": {
      get: { tags: ["Sincronização"], summary: "Progresso da sincronização em andamento", security: bearer, responses: { 200: json({ running: false, phase: "concluido", processed: 42, totalIds: 42, novos: 2, atualizados: 40 }) } },
    },
    "/iot/medidas": {
      post: {
        tags: ["IoT"], summary: "Recebe a leitura do dispositivo (peso + dimensões) e salva no SKU", security: bearer,
        description: "O dispositivo ESP32 autentica-se com o mesmo token Bearer do usuário. Diferencie o horário da coleta (capturadoEm, enviado pelo dispositivo) do recebimento (registrado pela API).",
        requestBody: { required: true, content: { "application/json": { example: { deviceId: "esp32-01", sku: "SKA", pesoKg: 2.0, largura: 40, altura: 30, comprimento: 50, capturadoEm: "2026-11-03T14:20:00Z" } } } },
        responses: {
          201: json({ ok: true, afetados: 1, freteReal: 58.75, freteCobrado: 10.0, divergente: true, comparacao: { cubagem: 10, considerado: 10, freteReal: 58.75, freteCobrado: 10, delta: 48.75, divergente: true } }),
          400: { description: "SKU ausente", ...json({ error: "SKU ausente." }) },
          404: { description: "SKU sem anúncio", ...json({ error: "Nenhum anúncio com esse SKU." }) },
        },
      },
    },
  },
};
