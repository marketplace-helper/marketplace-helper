import { getBusinessRules } from "../rulesService.js";
import { carregarAliquotas } from "./aliquotaRepo.js";
import { resolverAliquotas } from "./resolverAliquotas.js";
import { REGIMES } from "./constantes.js";

const ANO_MAXIMO = 2040;

// Converte o ?ano= da URL. Só aceita inteiros do ano atual até 2040; qualquer
// outra coisa vira null (= calcular com a data de hoje).
export function parseAno(valor, anoAtual = new Date().getFullYear()) {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const texto = String(valor).trim();
  if (!/^\d{4}$/.test(texto)) return null;
  const ano = Number(texto);
  return ano >= anoAtual && ano <= ANO_MAXIMO ? ano : null;
}

// Data usada para escolher as alíquotas: hoje, ou o meio do ano simulado.
export function dataDoCalculo(ano, agora = new Date()) {
  if (ano == null) return agora;
  return new Date(`${ano}-07-01T12:00:00-03:00`);
}

// Parte pura: monta o contexto a partir das regras do usuário e das linhas da tabela.
export function montarContexto(rules, linhas, { ano = null } = {}) {
  const regime = REGIMES.includes(rules?.regime) ? rules.regime : "SIMPLES";
  const data = dataDoCalculo(ano);
  const aliquotas = resolverAliquotas(linhas, { regime, data, uf: rules?.ufOrigem || null });
  return { rules, aliquotas, data, ano, regime };
}

// Contexto tributário do usuário: { rules, aliquotas, data, ano, regime }.
// É o segundo argumento de calcularCustoProduto(item, ctx).
export async function criarContextoTributario(userId, { ano = null } = {}) {
  const [rules, linhas] = await Promise.all([getBusinessRules(userId), carregarAliquotas()]);
  return montarContexto(rules, linhas, { ano: parseAno(ano) });
}
