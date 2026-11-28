# Deploy (Railway)

[← Voltar ao README](../README.md)

A aplicação precisa de: **processo sempre ligado** (o *cron* roda dentro do servidor), um **banco PostgreSQL** e **HTTPS com domínio público** (exigido pela Redirect URI
do Mercado Livre). O **[Railway](https://railway.com)** atende aos três. Evite planos que hibernam o
app (Render *free*, Vercel, Netlify): neles o *cron* não dispara.

## Ambientes e fluxo de branches

| Ambiente | Branch | Domínio |
|---|---|---|
| `production` | `main` | `https://app.marketplacehelper.com.br` (landing page em `www.`) |
| `staging` | `dev` | domínio `*.up.railway.app` gerado pelo Railway |

Fluxo: *feature* → PR para `dev` → testar no staging → PR `dev` → `main`. O merge em `dev` já faz
deploy e aplica as migrações no staging. Cada ambiente tem segredos e banco Postgres próprios.

## 1. Criar o serviço

1. No Railway: **New Project → Deploy from GitHub repo** e selecione o repositório. O `npm install`
   roda o `postinstall` (`prisma generate`).
2. Em **Settings → Deploy → Custom Start Command**: `npm run start:prod`.
   Esse script aplica as migrações **a cada inicialização**, grava as alíquotas tributárias (`prisma/seed/aliquotas.js`,
   por *upsert*; ver [Impostos](impostos.md#como-atualizar-uma-alíquota)) e depois sobe o servidor.

## 2. Banco (PostgreSQL)

No mesmo projeto e ambiente: **+ Create → Database → PostgreSQL**. No serviço do App, o
`DATABASE_URL` referencia a variável do Postgres (`${{Postgres.DATABASE_URL}}`), que usa a rede
privada do Railway.

## 3. Variáveis

Em **Variables** (segredos **novos**, diferentes dos locais e de outros ambientes):

```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://<domínio>
SESSION_SECRET=<gerado>
JWT_SECRET=<gerado>
ENCRYPTION_KEY=<gerado>
TZ=America/Sao_Paulo
RESEND_API_KEY=<chave>
MAIL_FROM=Marketplace Helper <nao-responda@mail.marketplacehelper.com.br>
ML_APP_ID=<id>
ML_APP_SECRET=<secret>
ML_REDIRECT_URI=https://<domínio>/api/ml/oauth/callback
ADMIN_EMAILS=<e-mails>
```

Não defina `PORT`: o Railway injeta a porta. No staging, `APP_URL` e `ML_REDIRECT_URI` podem usar
`${{RAILWAY_PUBLIC_DOMAIN}}` para acompanhar o domínio. Descrição de cada variável em
[Variáveis de ambiente](variaveis-de-ambiente.md).

## 4. Domínio

**Settings → Networking → Generate Domain** (ou domínio próprio). Confira se a tela de login abre e
se `/api/docs` responde.

## 5. Mercado Livre

No painel do app ML, cadastre a Redirect URI **idêntica** a `ML_REDIRECT_URI`, habilite PKCE e
configure as notificações (`https://<domínio>/api/ml/webhooks`, tópicos `items` e `orders_v2`).
Ver [Integração com o Mercado Livre](integracao-mercado-livre.md).

## 6. Verificação

Nos logs do deploy devem aparecer:

```
All migrations have been successfully applied.
  Marketplace Helper rodando em http://localhost:<porta>
  Sincronização automática agendada para 00:00 e 12:00 (America/Sao_Paulo).
```

Se aparecer `Variáveis de ambiente obrigatórias em produção ausentes`, falta `SESSION_SECRET` e/ou
`ENCRYPTION_KEY`. Se aparecer `the URL must start with the protocol postgresql://`, o `DATABASE_URL`
ainda aponta para o SQLite antigo.

## Landing page

1. Em `landing-page/config.js`, aponte `window.APP_URL` para o app publicado.
2. No mesmo projeto: **+ Create → GitHub Repo**, mesmo repositório.
3. **Settings → Source → Root Directory**: `landing-page` (usa o `package.json` da pasta, sem dependências).
4. (Opcional) **Watch Paths**: `/landing-page/**`.
5. **Generate Domain**. Não precisa de volume nem variáveis.

Por ser estática, também pode ir para GitHub Pages, Netlify ou Vercel.

## Backup

Use os *backups* do serviço Postgres no Railway. Para uma cópia manual: `pg_dump` com a
`DATABASE_PUBLIC_URL` do serviço.

## Virada de SQLite para Postgres (uma vez por ambiente)

Até 2026-11 o banco era SQLite num volume (`/data/prod.db`). A cópia roda sozinha no primeiro boot
com Postgres: o `start:prod` chama `scripts/sqlite-para-postgres.js --auto`, que lê o caminho de
`SQLITE_MIGRAR_DE` e só copia se o Postgres estiver vazio (nos boots seguintes, só avisa e segue).
Como o serviço tem volume, o Railway para o container antigo antes de subir o novo, então ninguém
grava no SQLite durante a cópia.

1. Crie o serviço Postgres no ambiente (seção 2).
2. No App, **sem redeploy** (o código em produção ainda é SQLite):
   `DATABASE_URL=${{Postgres.DATABASE_URL}}` e `SQLITE_MIGRAR_DE=/data/prod.db`.
3. Faça o deploy da versão com Postgres (merge na branch do ambiente). Nos logs devem aparecer
   `Cópia concluída e conferida.` e as contagens de cada tabela.
4. Confira login, Anúncios, Regras e Dashboard.
5. Remova `SQLITE_MIGRAR_DE`. Mantenha o volume por alguns dias como *rollback*; depois, remova-o.

*Rollback:* volte o `DATABASE_URL` para `file:/data/prod.db` e faça *rollback* para o último deploy
anterior à virada. O SQLite não é alterado pela cópia (é aberto só para leitura).
