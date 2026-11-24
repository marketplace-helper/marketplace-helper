import { calcularTributos } from "./tributos/calcularTributos.js";

// Cálculo de margem e lucro líquido por anúncio.
//
// Base de venda: precoPor (se > 0), senão precoDe.
// Impostos: tributos de calcularTributos() — ICMS/IPI/DIFAL/Custo operacional
// digitados pelo usuário + PIS/Cofins/CBS/IBS da tabela, conforme regime e data.
// Custo ML = comissão + frete (os tributos ficam em `impostos`).
// Lucro líquido = base - custoProduto - comissão - frete - impostos
// Margem % = lucro / base * 100
//
// `ctx` é o contexto tributário ({ rules, aliquotas }, ver tributos/contexto.js).
// Se vier só o BusinessRule (sem `aliquotas`), calcula como antes da reforma.
export function calcularCustoProduto(item, ctx) {
  const { rules, aliquotas } = ctx?.aliquotas ? ctx : { rules: ctx || {}, aliquotas: {} };
  const base =
    item.precoPor && item.precoPor > 0 ? item.precoPor : item.precoDe || 0;

  const custo = item.custoProduto || 0;
  const comissao = item.comissao || 0;
  const frete = item.frete || 0;
  const custoML = comissao + frete;

  const tributos = calcularTributos({ base, custoProduto: item.custoProduto, rules, aliquotas });
  const impostos = tributos.total;

  const lucro = base > 0 ? base - custo - comissao - frete - impostos : null;
  const margem = base > 0 && lucro != null ? (lucro / base) * 100 : null;

  return { base, custoML, impostos, tributos, lucro, margem };
}

export const computeProfit = calcularCustoProduto;

// Anexa o objeto _calc a cada item
export function attachProfit(items, ctx) {
  return items.map((it) => ({ ...it, _calc: calcularCustoProduto(it, ctx) }));
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
