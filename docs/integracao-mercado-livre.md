# Integração com o Mercado Livre

[← Voltar ao README](../README.md)

## Conexão da conta (OAuth 2.0 + PKCE)

A plataforma tem **um único app** no Mercado Livre (`ML_APP_ID`, `ML_APP_SECRET`); o usuário não
cadastra credenciais. Ele clica em **Conectar** (`GET /ml/conectar`), autoriza no ML e volta ao
sistema já conectado pelo callback `GET /api/ml/oauth/callback`.

- O fluxo usa **PKCE** (o *verifier* fica no servidor; só o *challenge* vai na URL) e um `state` de uso único.
- Os tokens ficam em `MlConnection`, **cifrados**, com `status` `active`, `reconnect_required` ou `disconnected`.
- Segundo a documentação do ML, o *access token* vale 6 h e o *refresh token* é de **uso único**, com
  rotação a cada renovação (aqui protegida por *lock* por usuário).
- Um *cron* a cada 10 min renova os tokens que expiram em menos de 30 min. Se a renovação falhar de
  forma definitiva, o status vira `reconnect_required` e a interface exibe um banner de reconexão.

### Contrato do app mobile

1. `POST /api/ml/oauth/start` (Bearer) devolve `{ url }`.
2. Abrir a `url` com `openAuthSessionAsync(url, "marketplacehelper://ml/oauth")` (`expo-web-browser`).
3. O retorno traz `?status=ok|erro&mensagem=...` no deep link.
4. Confirmar com `GET /api/ml/connection`. Desconectar: `DELETE /api/ml/connection`.

**Risco residual:** no fluxo web o callback confere que a sessão é do mesmo usuário que iniciou a
autorização; o fluxo mobile não confere a sessão. Uma página de confirmação está prevista.

## Configuração no painel do ML

Em <https://developers.mercadolivre.com.br>, no app da plataforma:

- **Redirect URI** idêntica a `ML_REDIRECT_URI` (padrão `APP_URL + /api/ml/oauth/callback`;
  produção: `https://app.marketplacehelper.com.br/api/ml/oauth/callback`).
- **PKCE** habilitado.
- **Notificações** em `https://app.marketplacehelper.com.br/api/ml/webhooks`, tópicos **`items`** e **`orders_v2`**.

## Webhooks

`POST /api/ml/webhooks` é público. As notificações são agrupadas por usuário (`syncQueue.js`) e
disparam um único sync seletivo por lote. Só anúncios do vendedor conectado são gravados
(`sellerFilter.js`). Contas em modo teste não recebem sync por *webhook*.

## Endpoints utilizados

`mlApi.js` encapsula as chamadas. Cada requisição usa o token válido do usuário (renovado se
necessário) e trata *rate limit* (429) e erros transitórios com *retry*; erros definitivos (4xx) não são repetidos.

| Endpoint | Uso |
|---|---|
| `POST /oauth/token` | Troca de `code` e renovação de token |
| `GET /users/me` | Dados do vendedor (nickname, reputação, foto, vendas) |
| `GET /users/{id}/items/search?search_type=scan` | Lista todos os MLBs (paginação por *scroll*) |
| `GET /items?ids=...&include_attributes=all` | Detalhes de até 20 itens por chamada |
| `GET /items/{mlb}/prices` | Preços e promoções ativas |
| `GET /items/{mlb}/shipping_options?zip_code=` | Custo de frete por CEP |
| `GET /visits/items?ids={mlb}` | Visitas (1 item por chamada) |
| `GET /sites/MLB/listing_prices?...` | Comissão por preço/categoria/tipo |
| `GET /sites/MLB/domain_discovery/search?q=` | Predição de categoria a partir do título |
| `GET /categories/{id}` | Caminho da categoria (com cache) |

## Particularidades da API

- **Promoções:** `original_price` vem nulo em promoções de canal; a promoção real vem de
  `/items/{mlb}/prices` (tipo `promotion`, respeitando a janela de validade).
- **Frete:** anúncios pausados/fechados retornam 404 no cálculo de frete. Para itens de baixo valor,
  aplica-se a tabela fixa de contribuição do ML.
- **Visitas:** o endpoint aceita **1 ID por chamada**; a sincronização consulta item a item.
- **Busca pública** (`/sites/MLB/search`) está **bloqueada (403)** para aplicativos; o simulador
  estima o frete a partir dos próprios anúncios do usuário na mesma categoria.
- **Link do anúncio:** usa-se o `permalink` oficial da API.
