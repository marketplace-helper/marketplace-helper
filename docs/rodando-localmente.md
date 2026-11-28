# Rodando localmente

[← Voltar ao README](../README.md)

## Pré-requisitos

- **Node.js 20 ou superior** (desenvolvido em Node 24) — <https://nodejs.org>.
- **Git**.
- **Docker Desktop** — <https://www.docker.com/products/docker-desktop/>. O banco (PostgreSQL)
  roda num container definido no `docker-compose.yml`. No Windows com WSL, ative a integração em
  *Settings → Resources → WSL integration*.
- Para conectar uma conta do Mercado Livre: as credenciais do **app da plataforma** no ML
  (`ML_APP_ID`, `ML_APP_SECRET`), com a Redirect URI `http://localhost:3333/api/ml/oauth/callback`
  cadastrada e **PKCE** habilitado. Ver [Integração com o Mercado Livre](integracao-mercado-livre.md).
- E-mail: **não precisa**. Sem `RESEND_API_KEY`, o app rodando local escreve cada e-mail no
  terminal, com os links (ver [Sem e-mail](#sem-e-mail)). Com a chave do **Resend**, envia de verdade.

## 1. Obter o código

```bash
git clone https://github.com/bebaby-processosdigitais/marketplace-helper.git
cd marketplace-helper
```

## 2. Instalar as dependências

```bash
npm install
```

O `postinstall` já gera o Prisma Client.

## 3. Criar o `.env`

```bash
cp .env.example .env
```

Gere os segredos e cole no `.env`:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Mínimo para subir:

```
PORT=3333
SESSION_SECRET=<valor_gerado>
ENCRYPTION_KEY=<valor_gerado>
DATABASE_URL="postgresql://mh:mh@localhost:5432/marketplace_helper?schema=public"
APP_URL=http://localhost:3333
```

Para o fluxo completo, preencha também `ML_APP_ID`, `ML_APP_SECRET` e, se quiser e-mails de
verdade, `RESEND_API_KEY`, `MAIL_FROM` e `ADMIN_EMAILS`. A lista completa está em [Variáveis de ambiente](variaveis-de-ambiente.md).

> Não defina `NODE_ENV=production` localmente: o *cookie* de sessão passa a exigir HTTPS e o login não "segura".
>
> Guarde a `ENCRYPTION_KEY`. Se ela mudar, os tokens do ML gravados no banco ficam ilegíveis e será
> preciso reconectar a conta.

## 4. Preparar o banco

Com o Docker Desktop aberto:

```bash
npm run db:up            # sobe o Postgres (porta 5432) e espera ficar pronto
npx prisma migrate deploy
npm run seed:aliquotas
```

Cria as tabelas no Postgres local e grava as alíquotas tributárias (PIS/Cofins/CBS/IBS). Os dados
ficam no volume `pgdata` do Docker e sobrevivem a reinícios. Comandos úteis:

- `npm run db:down` para o banco (sem apagar os dados);
- `docker compose down -v` apaga o banco inteiro, para começar do zero;
- `npx prisma studio` abre uma interface para ver e editar as tabelas.

### Vindo do SQLite

Se você já tinha um `prisma/dev.db` com dados, troque o `DATABASE_URL` do seu `.env` pelo de cima,
suba o banco, rode `npx prisma migrate deploy` e copie os dados:

```bash
npm run db:migrar-sqlite -- prisma/dev.db
```

O script exige **Node 22.5+** (usa o `node:sqlite`), só grava num Postgres vazio e confere a
contagem de linhas de cada tabela no fim.

## 5. Iniciar

```bash
npm start        # ou: npm run dev (reinicia ao salvar)
```

- Aplicação: <http://localhost:3333>
- Documentação da API (Swagger): <http://localhost:3333/api/docs>

> **No Windows**, um duplo clique em **`INICIAR.BAT`** faz os passos 2 a 5: instala as dependências
> (na primeira vez), sobe o Postgres no Docker, prepara o banco, libera a porta 3333 e abre o navegador.

## 6. Primeiro uso

1. **Crie uma conta** e libere direto no banco, sem e-mail:

   ```bash
   npm run conta:liberar -- seu@email.com
   ```

   Isso confirma o e-mail e coloca a conta em uso completo (`COMPLETO`). Para testar o modo teste,
   confirme pelo link que aparece no terminal (ver [Sem e-mail](#sem-e-mail)).
2. Em **Autorização**, clique em **Conectar com Mercado Livre** e autorize.
3. Em **Anúncios**, clique em **Atualizar tudo** para importar o catálogo.
4. Em **Produtos**, preencha **custos** e **medidas** por SKU; em **Regras**, informe as **alíquotas**.
5. Veja lucro, margem, *insights* e frete divergente no **Dashboard**.

## Sem e-mail

O app se considera **local** quando `NODE_ENV` não é `production` e não está no Railway (sem
`RAILWAY_ENVIRONMENT`). Rodando local:

- **Sem `RESEND_API_KEY`**, os e-mails não são enviados: aparecem no terminal com todas as
  variáveis, inclusive os links. Exemplo:

  ```
  [mail] (local, não enviado) confirmar-email → loja@exemplo.com
    STORE_NAME: Minha Loja
    ACTION_URL: http://localhost:3333/confirmar-email?token=...
  ```

  Copie o link para o navegador. Vale para confirmação, recuperação de senha, troca de e-mail e os
  e-mails dos admins (com `ADMIN_EMAILS` preenchido, os links de liberar/bloquear também aparecem).
  Os links usam o `APP_URL` do `.env`.
- **Os limites de tentativas por IP ficam desligados** (dá para criar várias contas de teste seguidas).
- Continua valendo o intervalo de 60 s entre dois e-mails do mesmo tipo para a mesma conta.

## Landing page (opcional)

```bash
cd landing-page
npm start        # ou duplo clique em INICIAR-LP.BAT
```

Abre em <http://localhost:8080>. Os botões *Entrar* e *Crie sua conta* usam `window.APP_URL` de
`landing-page/config.js` (padrão `http://localhost:3333`).

## Scripts

| Comando | Ação |
|---|---|
| `npm start` | Inicia o servidor (`node src/server.js`) |
| `npm run dev` | Inicia com *watch* (reinício automático ao salvar) |
| `npm run start:prod` | Aplica as migrações, grava as alíquotas e inicia (usado no deploy) |
| `npm run seed:aliquotas` | Grava/atualiza as linhas de `AliquotaTributaria` a partir de `prisma/seed/aliquotas.js` |
| `npm test` | Roda os testes (`node --test`, pasta `test/`) |
| `npm run prisma:migrate` | Cria/aplica migrações em desenvolvimento |
| `npm run prisma:generate` | Regenera o Prisma Client |
| `npm run prisma:studio` | Abre o Prisma Studio (inspeção visual do banco) |
| `npm run conta:liberar -- <email>` | Confirma o e-mail e libera o uso completo de uma conta no banco do `.env` |
| `npm run mock:anuncios -- <email>` | (só local) Grava 19 anúncios fictícios em 14 SKUs na conta, sem precisar do Mercado Livre. Rodar de novo substitui os fictícios (`MLB99…`) |

## Solução de problemas

- **Porta 3333 ocupada (`EADDRINUSE`):** há um servidor antigo rodando. O `INICIAR.BAT` libera a
  porta sozinho; manualmente, encerre o processo Node.
- **A tela mostra código antigo:** reinicie o servidor (ou use `npm run dev`).
- **Campos do Prisma "unknown" / coluna inexistente:** rode `npx prisma migrate deploy` e `npx prisma generate`.
- **Login não "segura":** remova `NODE_ENV=production` do `.env`.
- **E-mail de confirmação não chega:** local, deixe `RESEND_API_KEY` vazia e pegue o link no terminal,
  ou use `npm run conta:liberar -- <email>`. Com Resend: confira `RESEND_API_KEY` e `MAIL_FROM`
  (com `onboarding@resend.dev`, só o e-mail dono da conta Resend recebe) e olhe o lixo eletrônico.
- **Erro ao conectar o Mercado Livre:** a Redirect URI do painel do ML precisa ser **idêntica** a
  `ML_REDIRECT_URI` (padrão `APP_URL + /api/ml/oauth/callback`), com PKCE habilitado.
- **Banner "reconectar":** a conexão está em `reconnect_required` (refresh recusado ou revogado);
  clique em **Conectar com Mercado Livre** de novo.
- **Imagens/permalinks ausentes em anúncios antigos:** rode um **Atualizar tudo**.
