# Regras de negócio e funcionalidades

[← Voltar ao README](../README.md)

## Cálculo financeiro

> Guia dos impostos em linguagem simples (regimes, transição, exemplos, limitações):
> [Impostos e reforma tributária](impostos.md).

O cálculo central está em `calcService.js::calcularCustoProduto(item, ctx)` (o nome antigo
`computeProfit` continua exportado). `ctx` é o **contexto tributário** do usuário
(`tributos/contexto.js::criarContextoTributario(userId, { ano })`): as regras da tela *Regras* e
as alíquotas da tabela `AliquotaTributaria` válidas para o regime, a UF e a data do cálculo.

```
base      = precoPor  (se houver promoção)  |  precoDe  (caso contrário)
impostos  = Σ devido de cada tributo (tributos/calcularTributos.js)
            ICMS     = base × ICMS% × fator de transição (1 até 2028 … 0 em 2033)
            IPI, DIFAL, Custo Operacional = base × %
            PIS, COFINS, CBS, IBS = max(0, débito − crédito)
                débito  = base × alíquota da tabela
                crédito = custoProduto × alíquota   (só não cumulativos e com "crédito na compra" ligado)
lucro     = base − custoProduto − comissão − frete − impostos
margem    = lucro / base × 100
custoML   = comissão + frete            (quanto o Mercado Livre "consome")
```

O regime tributário, a UF de origem, a opção de crédito e as alíquotas de ICMS/IPI/DIFAL/Custo
operacional vêm de `BusinessRule` (tela *Regras*). O padrão é **Simples Nacional**, que não
acrescenta PIS/Cofins/CBS/IBS: para quem não mexer em *Regras*, as margens são as mesmas de antes.
O custo do produto é informado pelo vendedor, por SKU (tela *Produtos*). Comissão e frete vêm da
API do Mercado Livre.

**Simulação por ano** — Anúncios, Dashboard, Exportar e Simulador aceitam `?ano=` (seletor
"Alíquotas de": Hoje, 2027, 2029, 2033). Anos simulados usam a data de 1º de julho daquele ano e
mostram o aviso "Simulação de &lt;ano&gt; com alíquotas estimadas — confira com seu contador.".

## Alíquotas tributárias (reforma CBS/IBS)

As alíquotas **não ficam no código**: ficam na tabela `AliquotaTributaria`, cada linha com sua
vigência. A escolha (`tributos/resolverAliquotas.js`) filtra por regime (exato ou `TODOS`), data e
UF e, se mais de uma linha vale, prefere UF preenchida → regime exato → início mais recente → maior
`id`. Linhas com `ncm`/`cClassTrib` ainda são ignoradas (reservadas para alíquotas por produto).

| Período | Presumido / Real | Simples híbrido | Simples | ICMS (fator) |
|---|---|---|---|---|
| até 2026 | PIS 0,65% + Cofins 3% (Presumido, cumulativo); PIS 1,65% + Cofins 7,6% (Real, não cumulativo) | — | — | × 1 |
| 2026 | + CBS 0,9% e IBS 0,1% **só destaque** (não custam) | — | — | × 1 |
| 2027–2028 | CBS 8,7%* + IBS 0,1% | igual | — | × 1 |
| 2029–2032 | CBS 8,8%* + IBS 1,77 / 3,54 / 5,31 / 7,08%* | igual | — | × 0,9 / 0,8 / 0,7 / 0,6 |
| 2033 em diante | CBS 8,8%* + IBS 17,7%* | igual | — | × 0 |

\* **Estimativa**: a alíquota de referência ainda não foi fixada (out/2026). Os valores precisam
ser revisados por um contador e atualizados quando o Senado/Comitê Gestor publicar as alíquotas.

**Como atualizar uma alíquota** — nunca edite a linha que já está em vigor no passado. Encerre-a
(`vigenciaFim`) e acrescente uma nova linha com outra `chave`, em `prisma/seed/aliquotas.js`
(fonte das linhas do sistema, gravadas por *upsert* pela `chave`) ou direto no Prisma Studio.
O seed roda em todo `start:prod` e pode ser rodado à mão com `npm run seed:aliquotas`. A leitura
tem cache de 10 minutos. A API `GET /api/tributos/aliquotas?ano=` mostra as linhas que valem para
o usuário.

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
  No Presumido e no Real, escolher a **UF de origem** preenche o ICMS com a alíquota interna modal
  do estado (linhas `ICMS_INTERNO` de `AliquotaTributaria`, uma por UF, com a base legal na
  observação). É só sugestão: o valor continua editável, abrir a tela não muda nada e o cálculo usa o
  que foi salvo. Ao mudar o regime para Presumido/Real, o ICMS só é preenchido se estiver vazio ou 0.
  Venda para outro estado costuma ter 4%, 7% ou 12% (fora do escopo por enquanto). As 27 alíquotas
  precisam ser conferidas por um contador; `GET /api/regras` devolve o mesmo mapa em `icmsInternoPorUf`.
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
