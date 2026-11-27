
import { computeProfit } from "../calcService.js";

const num = (v) => {
  if (v === null || v === undefined || v === "") {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
};

const ratio = (a, b) =>
  a !== null && b !== null && b > 0 ? a / b : null;

export function buildFeatures(item, rules = {}, quando = new Date()) {
  const calculo = computeProfit(item, rules);

  const precoVenda = num(calculo.base);
  const custoProduto = num(item.custoProduto);
  const custoFrete = num(item.frete);

  const largura = num(item.largura);
  const altura = num(item.altura);
  const comprimento = num(item.comprimento);

  // As dimensões do cadastro são consideradas em centímetros.
  const cubagem =
    largura !== null &&
    altura !== null &&
    comprimento !== null
      ? (largura * altura * comprimento) / 1000000
      : null;

  // Não utilizar margens calculadas com custo de produto desconhecido.
  const custoConhecido = custoProduto !== null;

  const margemPct = custoConhecido
    ? num(calculo.margem)
    : null;

  const margemRs = custoConhecido
    ? num(calculo.lucro)
    : null;

  return {
    // Numéricas
    preco_venda: precoVenda,
    preco_custo: custoProduto,
    margem_pct: margemPct,
    margem_rs: margemRs,
    comissao_pct: num(item.comissaoPct),
    custo_frete: custoFrete,
    frete_sobre_preco: ratio(custoFrete, precoVenda),
    peso_kg: num(item.pesoReal),
    cubagem_m3: cubagem,
    tamanho_titulo: item.titulo
      ? String(item.titulo).length
      : null,
    mes: quando.getMonth() + 1,

    // Categóricas
    categoria:
      item.categoria4 ||
      item.categoria3 ||
      item.categoria2 ||
      item.categoria1 ||
      null,

    tipo_anuncio: item.tipoAnuncio ?? null,
  };
}
