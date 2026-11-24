// Cálculo dos tributos de uma venda (função pura).
//
// - ICMS, IPI, DIFAL e Custo operacional vêm do que o usuário digita em Regras
//   (% sobre a venda). O ICMS ainda é multiplicado pelo fator de transição da
//   tabela (1 até 2028, cai até 0 em 2033).
// - PIS, COFINS, CBS e IBS vêm da tabela de alíquotas resolvida para o regime e a data.
//   Débito = base × alíquota. Crédito (só não cumulativo e se o usuário marcou a
//   opção) = custo do produto × alíquota, uma aproximação do imposto pago na compra.
//   Devido = max(0, débito − crédito); linhas "só destaque" (2026) não custam nada.

const TRIBUTOS_DA_TABELA = ["PIS", "COFINS", "CBS", "IBS"];
const pct = (v) => (Number(v) || 0) / 100;

function linhaDoUsuario(tributo, base, aliquota) {
  const valor = base * pct(aliquota);
  return { tributo, aliquota, debito: valor, credito: 0, devido: valor, somenteDestaque: false, estimativa: false };
}

export function calcularTributos({ base, custoProduto, rules, aliquotas }) {
  const fatorIcms = aliquotas.ICMS?.aliquota ?? 1;
  const linhas = [
    linhaDoUsuario("ICMS", base, (Number(rules.icms) || 0) * fatorIcms),
    linhaDoUsuario("IPI", base, rules.ipi),
    linhaDoUsuario("DIFAL", base, rules.difal),
    linhaDoUsuario("CUSTO_OPERACIONAL", base, rules.custoOperacional),
  ];

  for (const tributo of TRIBUTOS_DA_TABELA) {
    const linha = aliquotas[tributo];
    if (!linha) continue;
    const debito = base * pct(linha.aliquota);
    const credito = rules.creditoCompra && linha.naoCumulativo ? (Number(custoProduto) || 0) * pct(linha.aliquota) : 0;
    linhas.push({
      tributo,
      aliquota: linha.aliquota,
      debito,
      credito,
      devido: linha.somenteDestaque ? 0 : Math.max(0, debito - credito),
      somenteDestaque: !!linha.somenteDestaque,
      estimativa: Boolean(linha.observacao?.startsWith("Estimativa")),
    });
  }

  return { linhas, total: linhas.reduce((s, l) => s + l.devido, 0) };
}
