# Regras de negócio e funcionalidades

[← Voltar ao README](../README.md)

## Cálculo financeiro

O cálculo central está em `calcService.js::computeProfit(item, rules)`:

```
base      = precoPor  (se houver promoção)  |  precoDe  (caso contrário)
impostos  = base × (ICMS + IPI + DIFAL + Custo Operacional) / 100
lucro     = base − custoProduto − comissão − frete − impostos
margem    = lucro / base × 100
custoML   = comissão + frete            (quanto o Mercado Livre "consome")
```

As alíquotas vêm de `BusinessRule` (tela *Regras*). O custo do produto é informado pelo vendedor,
por SKU (tela *Produtos*). Comissão e frete vêm da API do Mercado Livre.

## Saúde do anúncio

`computeHealth` avalia em ordem e exibe o primeiro estado aplicável:

`Inativo` (status ≠ ativo) → `Sem estoque` (estoque ≤ 0) → `Preencher custo` (custo ausente) →
`Prejuízo` (margem < 0) → `Margem baixa` (margem < 8%) → `Saudável`.

O limiar de **8%** separa, em toda a aplicação, o **alto desempenho** (margem ≥ 8%) do **baixo
desempenho** (0% ≤ margem < 8%).

## Frete real × cobrado

Com as medidas do produto (por SKU), `freteTable.js` estima o **frete real** pela tabela de cubagem do ML:

```
cubagem      = (largura × altura × comprimento em cm) / 6000
considerado  = maior(peso real, cubagem)
frete real   = tabela_ML(considerado, preço de venda)   (coluna por faixa de preço)
divergente   = |frete real − frete cobrado| ≥ R$ 2
```

O **frete cobrado** é o `Item.frete` vindo da API. Δ positivo = real acima do cobrado (dimensões
**subdeclaradas** no ML, risco de cobrança extra); negativo = **superdeclaradas** (pagando a mais).

## Funcionalidades por módulo

- **Dashboard** (`/`, também `/dashboard`): KPIs clicáveis em três grupos, cada um abrindo a lista de
  anúncios já filtrada:
  - *Desempenho*: no prejuízo, baixo desempenho (0–8%), alto desempenho (≥ 8%), no catálogo;
  - *Estoque & cadastro*: estoque baixo (≤ 5, ativos), Full com estoque baixo, sem custo, ticket médio;
  - *Saúde financeira*: custo médio do ML, lucro líquido médio, margem média, cobertura de custo.

  Inclui também **frete divergente**, *insights* acionáveis, últimos anúncios e distribuição por tipo/Full/Catálogo.
- **Anúncios** (`/anuncios`): tabela com busca (MLB/título/SKU), ordenação e cabeçalho fixo;
  alternador planilha/cards no desktop (cards no mobile); filtros rápidos (`?filter=`); seleção para
  sincronizar um subconjunto; exportação para Excel.
- **Produtos** (`/produtos`): anúncios agrupados por **SKU**. Custo e medidas preenchidos aqui valem
  para todos os anúncios do SKU, com comparação frete cobrado × real.
- **Medição** (`/medir`): simulação do app com câmera + balança Bluetooth. Os valores são editáveis
  e as medidas são salvas no SKU, prontas para serem trocadas pela leitura real no app móvel/IoT.
- **Calculadora de Frete** (`/frete`): cubagem + tabela oficial do ML (MercadoLíder / reputação
  verde / sem reputação), calculada no cliente (`public/js/frete-calc.js`).
- **Regras** (`/regras`): alíquotas, com exemplo dinâmico usando os valores do usuário.
- **Simulador** (`/simulador`): a partir de título e preço, prediz a categoria e compara comissão,
  frete e retorno no **Clássico** e no **Premium**.
- **Autorização** (`/auth`): conectar/desconectar a conta do Mercado Livre e status da conexão.
- **Minha Conta** (`/conta`): nome da loja, e-mail e WhatsApp; troca de senha; dados da conta do ML.

## Contas, modo teste e liberação

O cadastro é aberto, então toda conta nova entra em **modo teste** e só ganha uso completo quando um
administrador libera (`src/services/acesso/`).

| Plano | Entra? | Sincronização |
|---|---|---|
| `TESTE` (no prazo) | Sim | Só manual, até `TESTE_SYNCS_DIA` por dia; no máximo `TESTE_MAX_ANUNCIOS` anúncios; sem agendamento e sem *webhooks* |
| `TESTE` (vencido) | Sim, vê os dados | Pausada |
| `COMPLETO` | Sim | Sem limites |
| `BLOQUEADO` | Não | — |

- O teste começa quando a pessoa **confirma o e-mail** e dura `TESTE_DIAS` dias. A interface mostra
  uma faixa com os limites e a data de fim.
- Ao confirmar, os endereços de `ADMIN_EMAILS` recebem o e-mail **`admin-conta`** com os links
  **Liberar uso completo** e **Bloquear**. O link abre uma página de confirmação
  (`GET /admin/contas/acao`); a ação só acontece no botão (`POST`). Cada link vale uma vez, por 7 dias.
- Quem é liberado recebe o e-mail **`conta-liberada`**. Quando um teste vence, os admins recebem de
  novo o `admin-conta` (motivo "Período de teste terminou"), uma vez, no agendamento das 00:00/12:00.
- Para mudar um plano à mão: Prisma Studio, campo `plano`.

### Templates de e-mail (Resend)

| Alias | Quando | Variáveis |
|---|---|---|
| `confirmar-email` | Cadastro | `STORE_NAME`, `ACTION_URL` |
| `redefinir-senha` | Recuperação de senha | `STORE_NAME`, `ACTION_URL` |
| `confirmar-novo-email` | Troca de e-mail | `STORE_NAME`, `ACTION_URL` |
| `admin-conta` | Nova conta / teste vencido (para admins) | `STORE_NAME`, `CONTA_EMAIL`, `WHATSAPP`, `MOTIVO`, `LIBERAR_URL`, `BLOQUEAR_URL` |
| `conta-liberada` | Conta liberada | `STORE_NAME`, `ACTION_URL` |
