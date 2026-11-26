# Marketplace Helper

> Plataforma web de **inteligência de rentabilidade** para vendedores do Mercado Livre.

Vender no Mercado Livre envolve custos que corroem a margem e raramente são acompanhados em tempo
real: comissão, frete subsidiado, impostos e custo operacional. O **Marketplace Helper** importa os
anúncios pela API oficial, calcula **lucro, margem, comissão e frete** de cada item e mostra, em um
painel com indicadores e *insights*, o que precisa de correção no catálogo.

## Principais recursos

- **Dashboard** com KPIs clicáveis (prejuízo, margem baixa/alta, estoque, custo médio do ML) e *insights* acionáveis.
- **Anúncios** e **Produtos** (por SKU), com custo e medidas aplicados a todos os anúncios do SKU.
- **Frete divergente**: compara o frete cobrado pelo ML com o frete real estimado pela cubagem.
- **Simulador** de anúncio (Clássico × Premium) e **calculadora de frete**.
- **Sincronização automática** (00:00 e 12:00) e por *webhooks* do Mercado Livre.
- **Conexão com o ML em 1 clique** (OAuth 2.0 + PKCE) e **exportação para Excel**.
- **API JSON** (`/api`, com Swagger) para o front React, o app React Native e o dispositivo IoT.
- **Cadastro com ativação por e-mail**: a conta nova entra em **modo teste** até um administrador liberar o acesso completo.

## Tecnologias

Node.js (ESM) · Express · EJS + Bootstrap 5 · Prisma + SQLite · Resend (e-mail) · node-cron · JWT ·
hospedagem no Railway. Acompanha uma **landing page** estática em `landing-page/`.

## Início rápido

```bash
npm install
cp .env.example .env      # preencha SESSION_SECRET e ENCRYPTION_KEY
npx prisma migrate deploy
npm start                 # http://localhost:3333
```

O passo a passo completo está em [docs/rodando-localmente.md](docs/rodando-localmente.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [Rodando localmente](docs/rodando-localmente.md) | Pré-requisitos, `.env`, banco, scripts, testes e solução de problemas |
| [Arquitetura](docs/arquitetura.md) | Camadas, decisões de projeto, estrutura de pastas, modelo de dados e segurança |
| [Regras de negócio e funcionalidades](docs/regras-de-negocio.md) | Cálculo de lucro/margem, saúde do anúncio, frete divergente, módulos e modo teste |
| [Integração com o Mercado Livre](docs/integracao-mercado-livre.md) | OAuth + PKCE, tokens, endpoints usados, *webhooks* e particularidades da API |
| [Rotas e API](docs/rotas-e-api.md) | Mapa de rotas web e da API JSON `/api` |
| [Variáveis de ambiente](docs/variaveis-de-ambiente.md) | Todas as variáveis do `.env` |
| [Deploy](docs/deploy.md) | Publicação no Railway (produção e staging) e landing page |
| [Limitações e próximos passos](docs/limitacoes-e-proximos-passos.md) | O que ainda falta e como escalar |

## Licença

Uso interno / proprietário.
