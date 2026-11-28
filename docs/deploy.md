# Deploy (Railway)

[← Voltar ao README](../README.md)

A aplicação precisa de: **processo sempre ligado** (o *cron* roda dentro do servidor), **disco
persistente** (o banco SQLite é um arquivo) e **HTTPS com domínio público** (exigido pela Redirect URI
do Mercado Livre). O **[Railway](https://railway.com)** atende aos três. Evite planos que hibernam o
app ou não têm disco persistente (Render *free*, Vercel, Netlify): neles o *cron* não dispara e o
banco é apagado a cada reinício.

## Ambientes e fluxo de branches

| Ambiente | Branch | Domínio |
|---|---|---|
| `production` | `main` | `https://app.marketplacehelper.com.br` (landing page em `www.`) |
| `staging` | `dev` | domínio `*.up.railway.app` gerado pelo Railway |

Fluxo: *feature* → PR para `dev` → testar no staging → PR `dev` → `main`. O merge em `dev` já faz
deploy e aplica as migrações no staging. Cada ambiente tem segredos e volume próprios.

## 1. Criar o serviço

1. No Railway: **New Project → Deploy from GitHub repo** e selecione o repositório. O `npm install`
   roda o `postinstall` (`prisma generate`).
2. Em **Settings → Deploy → Custom Start Command**: `npm run start:prod`.
   Esse script aplica as migrações **a cada inicialização** (e não no *build*, porque o volume só
   fica disponível com o serviço rodando), grava as alíquotas tributárias (`prisma/seed/aliquotas.js`,
   por *upsert*; ver [Impostos](impostos.md#como-atualizar-uma-alíquota)) e depois sobe o servidor.

## 2. Volume

**Add Volume** com *mount path* **`/data`**. É onde fica o `prod.db`; sem ele, os dados se perdem a cada deploy.

## 3. Variáveis

Em **Variables** (segredos **novos**, diferentes dos locais e de outros ambientes):

```
NODE_ENV=production
DATABASE_URL=file:/data/prod.db
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
`ENCRYPTION_KEY`. Se os dados somem após um deploy, o `DATABASE_URL` não aponta para o volume ou o
volume não está em `/data`.

## Landing page

1. Em `landing-page/config.js`, aponte `window.APP_URL` para o app publicado.
2. No mesmo projeto: **+ Create → GitHub Repo**, mesmo repositório.
3. **Settings → Source → Root Directory**: `landing-page` (usa o `package.json` da pasta, sem dependências).
4. (Opcional) **Watch Paths**: `/landing-page/**`.
5. **Generate Domain**. Não precisa de volume nem variáveis.

Por ser estática, também pode ir para GitHub Pages, Netlify ou Vercel.

## Backup

O banco inteiro é o arquivo `/data/prod.db`. Use os *backups* de volume do Railway ou baixe o arquivo periodicamente.
