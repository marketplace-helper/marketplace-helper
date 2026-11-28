// Alíquota interna modal de ICMS por UF (linhas ICMS_INTERNO da tabela AliquotaTributaria).
// Só serve de sugestão para o campo ICMS em Regras; não entra no cálculo.

const toTime = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

// { "SP": 18, ... } com a linha vigente na data; empate → vigenciaInicio mais recente.
export function icmsInternoPorUf(linhas, data = new Date()) {
  const t = data.getTime();
  const escolhidas = {};
  for (const l of linhas) {
    if (l.tributo !== "ICMS_INTERNO" || !l.uf) continue;
    if (toTime(l.vigenciaInicio) > t) continue;
    if (l.vigenciaFim != null && toTime(l.vigenciaFim) < t) continue;
    const atual = escolhidas[l.uf];
    if (!atual || toTime(l.vigenciaInicio) > toTime(atual.vigenciaInicio)) escolhidas[l.uf] = l;
  }
  return Object.fromEntries(Object.entries(escolhidas).map(([uf, l]) => [uf, l.aliquota]));
}
