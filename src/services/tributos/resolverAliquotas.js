// Escolhe, para cada tributo, a linha de AliquotaTributaria válida para um
// regime, uma data e (opcionalmente) a UF de origem. Função pura: recebe as
// linhas já carregadas (do banco ou do seed) e não acessa nada externo.
//
// Desempate quando mais de uma linha vale ao mesmo tempo:
//   1. UF preenchida ganha de UF vazia;
//   2. regime exato ganha de "TODOS";
//   3. vigenciaInicio mais recente;
//   4. maior id (a linha criada por último).
// Linhas por produto (ncm / cClassTrib) ainda não são usadas e ficam de fora.

const toTime = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

function vale(linha, { regime, data, uf }) {
  if (linha.ncm || linha.cClassTrib) return false;
  // Alíquota interna por UF só sugere o ICMS em Regras (tributos/icmsInterno.js).
  if (linha.tributo === "ICMS_INTERNO") return false;
  if (linha.regime !== regime && linha.regime !== "TODOS") return false;
  if (linha.uf && linha.uf !== uf) return false;
  const t = data.getTime();
  if (toTime(linha.vigenciaInicio) > t) return false;
  if (linha.vigenciaFim != null && toTime(linha.vigenciaFim) < t) return false;
  return true;
}

// Retorna > 0 quando `a` deve ganhar de `b`.
function comparar(a, b, regime) {
  return (
    (a.uf ? 1 : 0) - (b.uf ? 1 : 0) ||
    (a.regime === regime ? 1 : 0) - (b.regime === regime ? 1 : 0) ||
    toTime(a.vigenciaInicio) - toTime(b.vigenciaInicio) ||
    (a.id ?? 0) - (b.id ?? 0)
  );
}

export function resolverAliquotas(linhas, { regime, data, uf = null }) {
  const escolhidas = {};
  for (const linha of linhas) {
    if (!vale(linha, { regime, data, uf })) continue;
    const atual = escolhidas[linha.tributo];
    if (!atual || comparar(linha, atual, regime) > 0) escolhidas[linha.tributo] = linha;
  }
  return escolhidas;
}
