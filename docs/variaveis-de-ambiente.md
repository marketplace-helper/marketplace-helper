# Variáveis de ambiente

[← Voltar ao README](../README.md)

Arquivo `.env` na raiz (modelo em `.env.example`). Em produção, as variáveis ficam no Railway.

| Variável | Descrição |
|---|---|
| `PORT` | Porta do app (padrão **3333**; em nuvem, a hospedagem define) |
| `NODE_ENV` | `production` no servidor: ativa cookie `Secure`, `trust proxy` e a checagem de segredos. Não usar localmente |
| `APP_URL` | URL pública do app, sem barra final. Usada nos links dos e-mails e na Redirect URI padrão |
| `SESSION_SECRET` | Segredo do cookie de sessão (aleatório, estável) — **obrigatório em produção** |
| `JWT_SECRET` | Segredo dos tokens JWT da API (opcional; usa `SESSION_SECRET` se vazio) |
| `ENCRYPTION_KEY` | Chave de 64 hex para cifrar os tokens do ML (estável) — **obrigatório em produção** |
| `DATABASE_URL` | SQLite — local: `file:./dev.db`; produção: `file:/data/prod.db` (volume) |
| `TZ` | Fuso do agendamento (padrão **America/Sao_Paulo**) |
| `RESEND_API_KEY` | Chave *sending access* do Resend. Vazia rodando local: os e-mails aparecem no terminal |
| `MAIL_FROM` | Remetente (padrão `Marketplace Helper <onboarding@resend.dev>`) |
| `ML_APP_ID` · `ML_APP_SECRET` | Credenciais do app único da plataforma no Mercado Livre |
| `ML_REDIRECT_URI` | Redirect URI do OAuth (padrão `${APP_URL}/api/ml/oauth/callback`) |
| `MOBILE_OAUTH_REDIRECT` | Deep link de retorno do app mobile (padrão `marketplacehelper://ml/oauth`) |
| `ADMIN_EMAILS` | E-mails dos administradores que recebem os pedidos de liberação, separados por vírgula |
| `TESTE_MAX_ANUNCIOS` | Máximo de anúncios sincronizados no modo teste (padrão `50`) |
| `TESTE_SYNCS_DIA` | Atualizações manuais por dia no modo teste (padrão `3`) |
| `TESTE_DIAS` | Duração do modo teste em dias (padrão `14`) |

Em produção, o servidor **não inicia** sem `SESSION_SECRET` e `ENCRYPTION_KEY`, e avisa nos logs se
faltarem `APP_URL`, `RESEND_API_KEY`, `ML_APP_ID`, `ML_APP_SECRET` ou `ADMIN_EMAILS`.

Para gerar segredos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
