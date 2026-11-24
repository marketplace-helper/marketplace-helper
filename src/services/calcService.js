// Cálculo de margem e lucro líquido por anúncio.
//
// Base de venda: precoPor (se > 0), senão precoDe.
// Impostos: (ICMS + IPI + DIFAL + Custo Operacional)% sobre a base de venda.
// Lucro líquido = base - custoProduto - comissão - frete - impostos
// Margem % = lucro / base * 100
export function computeProfit(item, rules) {
  const base =
    item.precoPor && item.precoPor > 0 ? item.precoPor : item.precoDe || 0;

  const custo = item.custoProduto || 0;
  const comissao = item.comissao || 0;
  const frete = item.frete || 0;
  const custoML = comissao + frete;

  const pctImpostos =
    ((rules.icms || 0) +
      (rules.ipi || 0) +
      (rules.difal || 0) +
      (rules.custoOperacional || 0)) /
    100;
  const impostos = base * pctImpostos;

  const lucro = base > 0 ? base - custo - comissao - frete - impostos : null;
  const margem = base > 0 && lucro != null ? (lucro / base) * 100 : null;

  return { base, custoML, impostos, lucro, margem };
}

// Anexa o objeto _calc a cada item
export function attachProfit(items, rules) {
  return items.map((it) => ({ ...it, _calc: computeProfit(it, rules) }));
}

// Avalia a "saúde" do anúncio a partir de status, estoque, custo e margem.
// Retorna { label, color (sufixo bootstrap), icon }.
export function computeHealth(item, calc) {
  if (item.status && item.status !== "active") {
    return { label: "Inativo", color: "secondary", icon: "pause-circle" };
  }
  if ((item.estoque || 0) <= 0) {
    return { label: "Sem estoque", color: "danger", icon: "exclamation-triangle" };
  }
  if (item.custoProduto == null) {
    return { label: "Preencher custo", color: "secondary", icon: "tag" };
  }
  if (calc.margem != null && calc.margem < 0) {
    return { label: "Prejuízo", color: "danger", icon: "graph-down-arrow" };
  }
  if (calc.margem != null && calc.margem < 8) {
    return { label: "Margem baixa", color: "warning", icon: "exclamation-circle" };
  }
  return { label: "Saudável", color: "success", icon: "check-circle" };
}
