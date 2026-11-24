// Valores fixos de domínio usados pelo cálculo tributário e pelas telas.
// As alíquotas em si NÃO ficam aqui: vêm da tabela AliquotaTributaria.

export const REGIMES = ["SIMPLES", "SIMPLES_HIBRIDO", "PRESUMIDO", "REAL"];

export const REGIME_LABEL = {
  SIMPLES: "Simples Nacional",
  SIMPLES_HIBRIDO: "Simples Nacional (híbrido)",
  PRESUMIDO: "Lucro Presumido",
  REAL: "Lucro Real",
};

export const TRIBUTOS = ["ICMS", "ISS", "PIS", "COFINS", "CBS", "IBS"];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// Anos oferecidos no seletor "simular".
export const ANOS_SIMULAVEIS = [2027, 2029, 2033];
