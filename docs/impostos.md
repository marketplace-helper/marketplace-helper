# Impostos e reforma tributária (CBS/IBS)

[← Voltar ao README](../README.md)

Guia do que o Marketplace Helper calcula de impostos, como configurar e como a reforma tributária
entra na margem. Os detalhes de implementação (fórmula, tabela, código) estão em
[Regras de negócio](regras-de-negocio.md#cálculo-financeiro).

> **Não é consultoria fiscal.** As alíquotas de 2027 em diante são **estimativas** e o modelo atual
> é **global por conta** (não por produto). Confira tudo com um contador — ver
> [Para validar com contador](#para-validar-com-contador).

## Resumo

- Os impostos de cada anúncio são **% sobre a base de venda** (preço promocional, se houver; senão o
  preço cheio) e saem do lucro: `lucro = base − custo − comissão − frete − impostos`.
- Uma parte você digita em **Regras** (ICMS, IPI, DIFAL, custo operacional); outra vem de uma
  **tabela de alíquotas com vigência** conforme o **regime** e o **ano** (PIS, Cofins, CBS, IBS e a
  redução gradual do ICMS).
- O padrão é **Simples Nacional**: a tabela não acrescenta nada e quem não mexer em *Regras* vê as
  mesmas margens de sempre.
- Anúncios, Dashboard, Exportar e Simulador têm o seletor **"Alíquotas de"** (Hoje, 2027, 2029, 2033)
  para ver a margem de cada anúncio em anos futuros.

## Os tributos, em linguagem simples

| Tributo | O que é | De onde vem no app |
|---|---|---|
| **ICMS** | Imposto estadual sobre a venda de mercadorias | Digitado em *Regras* (no Presumido/Real, sugerido pela UF de origem). Reduz de 2029 a 2032 e acaba em 2033 |
| **IPI** | Imposto federal sobre produtos industrializados (quem fabrica ou importa) | Digitado em *Regras* |
| **DIFAL** | Diferença entre a alíquota de ICMS do estado do comprador e a interestadual | Digitado em *Regras* (% fixo; o app não sabe o estado de cada comprador) |
| **Custo operacional** | Embalagem, mão de obra, etc. Não é imposto, mas entra na mesma conta | Digitado em *Regras* |
| **PIS / Cofins** | Contribuições federais sobre a receita. Acabam no fim de 2026 | Tabela, conforme o regime |
| **CBS** | Contribuição federal que substitui PIS/Cofins a partir de 2027 | Tabela, conforme o regime e o ano |
| **IBS** | Imposto estadual/municipal que substitui ICMS e ISS aos poucos (2029–2033) | Tabela, conforme o regime e o ano |

Dois termos que aparecem no detalhamento:

- **Cumulativo × não cumulativo.** No cumulativo (PIS/Cofins do Presumido) o imposto incide sobre a
  venda inteira. No não cumulativo (PIS/Cofins do Real, e CBS/IBS) a empresa abate o imposto que já
  veio embutido na compra — o **crédito**.
- **Só destaque.** Em 2026 a CBS (0,9%) e o IBS (0,1%) aparecem na nota fiscal como teste, mas não são
  cobrados. O app mostra essas linhas e não tira nada do lucro.

## Regimes

Escolha em *Regras* → **Regime tributário**:

| Regime | O que o app soma da tabela | Crédito na compra |
|---|---|---|
| **Simples Nacional** (padrão) | Nada. Só o que você digitar | Não se aplica |
| **Simples Nacional (híbrido)** | CBS e IBS a partir de 2027 (para quem optar por recolhê-los fora do DAS) | Sim, se marcado |
| **Lucro Presumido** | PIS 0,65% + Cofins 3% até 2026; CBS/IBS depois | Não (PIS/Cofins cumulativos); sim para CBS/IBS, se marcado |
| **Lucro Real** | PIS 1,65% + Cofins 7,6% até 2026; CBS/IBS depois | Sim, se marcado |

- **Crédito na compra** (caixa em *Regras*): aproxima o crédito como `custo do produto × alíquota`.
  Imposto devido = `máx(0, débito − crédito)`.
- **Simples Nacional:** o app ainda **não tem campo para a alíquota do DAS**. O que você digitar em
  ICMS/IPI/DIFAL/Custo operacional é o que entra. Atenção: o ICMS digitado é reduzido de 2029 a 2033
  nas simulações; o Custo operacional não muda com o ano.
- Ao trocar para Presumido ou Real, a tela avisa: se você tinha somado PIS/Cofins no ICMS ou no
  Custo operacional, retire-os, porque agora eles são calculados automaticamente.

## Transição ano a ano

| Período | Presumido / Real / Simples híbrido | ICMS digitado |
|---|---|---|
| até 2026 | PIS + Cofins (Presumido cumulativo; Real não cumulativo). Híbrido: nada | × 1 |
| 2026 | + CBS 0,9% e IBS 0,1% **só destaque** (Presumido e Real) | × 1 |
| 2027–2028 | CBS 8,7%\* + IBS 0,1% (PIS/Cofins acabam) | × 1 |
| 2029 | CBS 8,8%\* + IBS 1,77%\* | × 0,9 |
| 2030 | CBS 8,8%\* + IBS 3,54%\* | × 0,8 |
| 2031 | CBS 8,8%\* + IBS 5,31%\* | × 0,7 |
| 2032 | CBS 8,8%\* + IBS 7,08%\* | × 0,6 |
| 2033 em diante | CBS 8,8%\* + IBS 17,7%\* | × 0 (ICMS extinto) |

\* **Estimativa**: a alíquota de referência ainda não foi fixada. As linhas estimadas aparecem com
essa observação no painel "Alíquotas aplicadas hoje" e nas simulações, com o aviso "Simulação de
&lt;ano&gt; com alíquotas estimadas — confira com seu contador.". Anos simulados usam 1º de julho.

## Exemplo

Anúncio de **R$ 100,00**, custo R$ 40,00, comissão R$ 11,50, frete R$ 9,90, ICMS de **18%** (SP),
sem IPI/DIFAL/custo operacional. Valores calculados pelo próprio app:

| Regime | Hoje (2026) | 2027 | 2029 | 2033 |
|---|---|---|---|---|
| **Presumido** | impostos R$ 21,65 → lucro R$ 16,95<br>ICMS 18 + PIS 0,65 + Cofins 3 | R$ 26,80 → R$ 11,80<br>ICMS 18 + CBS 8,70 + IBS 0,10 | R$ 26,77 → R$ 11,83<br>ICMS 16,20 + CBS 8,80 + IBS 1,77 | R$ 26,50 → R$ 12,10<br>CBS 8,80 + IBS 17,70 |
| **Real, sem crédito** | R$ 27,25 → R$ 11,35<br>ICMS 18 + PIS 1,65 + Cofins 7,60 | igual ao Presumido | igual ao Presumido | igual ao Presumido |
| **Real, com crédito** | R$ 23,55 → R$ 15,05<br>PIS 0,99 + Cofins 4,56 (crédito sobre R$ 40) | R$ 23,28 → R$ 15,32 | R$ 22,54 → R$ 16,06 | R$ 15,90 → R$ 22,70 |

No **Simples**, o resultado é o mesmo em todos os anos: só entra o que você digitou. No **Simples
híbrido**, a partir de 2027 somam-se CBS e IBS ao que você digitou.

## ICMS sugerido pela UF de origem

No **Presumido** e no **Real**, escolher a **UF de origem** em *Regras* preenche o ICMS com a
**alíquota interna modal** do estado. É só sugestão:

- o valor continua editável e o cálculo usa o que você salvar;
- abrir a tela não muda nada; mudar o regime para Presumido/Real só preenche se o ICMS estiver vazio ou 0;
- no Simples e no Simples híbrido nada é preenchido (o ICMS está no DAS);
- a alíquota interna vale para venda **dentro do estado**. Venda para outro estado costuma ter 4%, 7%
  ou 12% de ICMS próprio, mais DIFAL — o app ainda não separa esses casos.

Alíquotas cadastradas (fonte: tabela da Barbieri Advogados, atualizada em nov/2026, que cita a lei
de cada estado; a base legal fica na observação de cada linha):

| UF | % | UF | % | UF | % |
|---|---|---|---|---|---|
| AC | 19 | MA | 23 | RJ | 22¹ |
| AL | 20,5 | MG | 18 | RN | 20 |
| AM | 20 | MS | 17 | RO | 19,5 |
| AP | 18 | MT | 17 | RR | 20 |
| BA | 20,5 | PA | 19 | RS | 17 |
| CE | 20 | PB | 20 | SC | 17 |
| DF | 20 | PE | 20,5 | SE | 19 |
| ES | 17 | PI | 22,5 | SP | 18 |
| GO | 19 | PR | 19,5 | TO | 20 |

¹ RJ: 20% + 2 pontos do Fundo de Combate à Pobreza (FECP).

## Onde ver os números

- **Regras** (`/regras`): painel "Alíquotas aplicadas hoje" (linhas da tabela para o seu regime/UF) e
  o mesmo produto de exemplo calculado hoje e em 2027, 2029 e 2033.
- **Anúncios, Dashboard, Exportar, Simulador**: seletor "Alíquotas de" (`?ano=`).
- **API**: `GET /api/regras` (inclui `icmsInternoPorUf`) e `GET /api/tributos/aliquotas?ano=`
  (linhas que valem para o usuário). Ver [Rotas e API](rotas-e-api.md).

## Como atualizar uma alíquota

As alíquotas **não ficam no código**: ficam na tabela `AliquotaTributaria`, cada linha com vigência.

1. Nunca edite uma linha que já esteve em vigor. **Encerre-a** (`vigenciaFim`) e **acrescente** uma
   nova com outra `chave`, em `prisma/seed/aliquotas.js`.
2. O seed roda em todo deploy (`npm run start:prod`); localmente, `npm run seed:aliquotas`.
3. A leitura tem cache de 10 minutos.

Também dá para criar linhas no Prisma Studio, com `chave` própria (o seed não as toca). Detalhes de
como o sistema escolhe a linha vigente em [Regras de negócio](regras-de-negocio.md#alíquotas-tributárias-reforma-cbsibs).

## Limitações atuais

- **Tudo é por conta, não por produto.** NCM, substituição tributária (ST), produto monofásico,
  IPI por produto e alíquotas reduzidas de CBS/IBS ainda não existem. Os campos `ncm` e `cClassTrib`
  da tabela estão reservados para isso.
- **Simples Nacional sem DAS:** não há campo para a alíquota efetiva nem para a repartição do DAS
  entre os tributos.
- **Simples híbrido:** a partir de 2027 o app soma CBS/IBS ao que foi digitado, mas não reduz a parte
  do DAS que eles substituem.
- **Venda interestadual e DIFAL:** o app não sabe o estado de cada comprador (trabalha com anúncios,
  não com pedidos). ICMS e DIFAL são % fixos da conta.
- **Crédito na compra** é uma aproximação (`custo × alíquota`), não o crédito real das notas de entrada.

## Para validar com contador

- Alíquotas de CBS/IBS de 2027 em diante (referência ainda não fixada).
- As 27 alíquotas internas de ICMS — as fontes divergem em MA, BA, RO, PI e SE — e se o RJ deve somar o FECP (22%) ou ficar em 20%.
- Uso da alíquota interna como estimativa para vendas interestaduais; DIFAL no Simples.
- Como representar o DAS no Simples e a redução do DAS no Simples híbrido.
- Se o crédito aproximado pelo custo do produto é razoável para o Lucro Real.
