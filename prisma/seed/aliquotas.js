// Linhas oficiais/estimadas da tabela AliquotaTributaria (reforma tributária).
//
// Este arquivo é a fonte das linhas "do sistema": cada uma é gravada por upsert
// pela sua `chave`. Para mudar uma alíquota, encerre a linha antiga (vigenciaFim)
// e acrescente uma nova com outra chave. Linhas criadas à mão no Prisma Studio,
// com chave própria, não são tocadas por este seed.
//
// Uso: npm run seed:aliquotas (também roda no start:prod).
import { pathToFileURL } from "node:url";

const ESTIMATIVA = "Estimativa: alíquota de referência não fixada (out/2026)";
const ANTES = 2000; // início "desde sempre" para as regras atuais

// Meia-noite e fim do dia em Brasília.
const inicio = (ano) => new Date(`${ano}-01-01T00:00:00-03:00`);
const fim = (ano) => new Date(`${ano}-12-31T23:59:59-03:00`);

// Expande uma definição para uma linha por regime.
function linhas({ tributo, regimes, de, ate = null, aliquota, ...flags }) {
  return regimes.map((regime) => ({
    chave: `${tributo}:${regime}:${de}`,
    tributo,
    regime,
    aliquota,
    tipo: flags.tipo || "PERCENTUAL",
    vigenciaInicio: inicio(de),
    vigenciaFim: ate == null ? null : fim(ate),
    naoCumulativo: !!flags.naoCumulativo,
    somenteDestaque: !!flags.somenteDestaque,
    observacao: flags.observacao || null,
  }));
}

const CBS_IBS = ["PRESUMIDO", "REAL", "SIMPLES_HIBRIDO"];
const nc = { naoCumulativo: true };

export const LINHAS_ALIQUOTAS = [
  // PIS/Cofins até a extinção (2026). Presumido: cumulativo. Real: não cumulativo.
  ...linhas({ tributo: "PIS", regimes: ["PRESUMIDO"], de: ANTES, ate: 2026, aliquota: 0.65 }),
  ...linhas({ tributo: "COFINS", regimes: ["PRESUMIDO"], de: ANTES, ate: 2026, aliquota: 3.0 }),
  ...linhas({ tributo: "PIS", regimes: ["REAL"], de: ANTES, ate: 2026, aliquota: 1.65, ...nc }),
  ...linhas({ tributo: "COFINS", regimes: ["REAL"], de: ANTES, ate: 2026, aliquota: 7.6, ...nc }),

  // 2026: ano de teste. Destacado na nota, recolhimento dispensado (LC 214/2025).
  ...linhas({ tributo: "CBS", regimes: ["PRESUMIDO", "REAL"], de: 2026, ate: 2026, aliquota: 0.9, somenteDestaque: true }),
  ...linhas({ tributo: "IBS", regimes: ["PRESUMIDO", "REAL"], de: 2026, ate: 2026, aliquota: 0.1, somenteDestaque: true }),

  // 2027–2028: CBS cheia (referência − 0,1 p.p.) e IBS 0,1%.
  ...linhas({ tributo: "CBS", regimes: CBS_IBS, de: 2027, ate: 2028, aliquota: 8.7, ...nc, observacao: ESTIMATIVA }),
  ...linhas({ tributo: "IBS", regimes: CBS_IBS, de: 2027, ate: 2028, aliquota: 0.1, ...nc }),

  // 2029 em diante: CBS de referência; IBS sobe 10% da referência por ano até 2033.
  ...linhas({ tributo: "CBS", regimes: CBS_IBS, de: 2029, aliquota: 8.8, ...nc, observacao: ESTIMATIVA }),
  ...linhas({ tributo: "IBS", regimes: CBS_IBS, de: 2029, ate: 2029, aliquota: 1.77, ...nc, observacao: ESTIMATIVA }),
  ...linhas({ tributo: "IBS", regimes: CBS_IBS, de: 2030, ate: 2030, aliquota: 3.54, ...nc, observacao: ESTIMATIVA }),
  ...linhas({ tributo: "IBS", regimes: CBS_IBS, de: 2031, ate: 2031, aliquota: 5.31, ...nc, observacao: ESTIMATIVA }),
  ...linhas({ tributo: "IBS", regimes: CBS_IBS, de: 2032, ate: 2032, aliquota: 7.08, ...nc, observacao: ESTIMATIVA }),
  ...linhas({ tributo: "IBS", regimes: CBS_IBS, de: 2033, aliquota: 17.7, ...nc, observacao: ESTIMATIVA }),

  // ICMS: fator sobre a alíquota digitada pelo usuário (redução gradual 2029–2032, extinto em 2033).
  ...linhas({ tributo: "ICMS", regimes: ["TODOS"], de: ANTES, ate: 2028, aliquota: 1, tipo: "FATOR" }),
  ...linhas({ tributo: "ICMS", regimes: ["TODOS"], de: 2029, ate: 2029, aliquota: 0.9, tipo: "FATOR" }),
  ...linhas({ tributo: "ICMS", regimes: ["TODOS"], de: 2030, ate: 2030, aliquota: 0.8, tipo: "FATOR" }),
  ...linhas({ tributo: "ICMS", regimes: ["TODOS"], de: 2031, ate: 2031, aliquota: 0.7, tipo: "FATOR" }),
  ...linhas({ tributo: "ICMS", regimes: ["TODOS"], de: 2032, ate: 2032, aliquota: 0.6, tipo: "FATOR" }),
  ...linhas({ tributo: "ICMS", regimes: ["TODOS"], de: 2033, aliquota: 0, tipo: "FATOR" }),
];

async function main() {
  const { default: prisma } = await import("../../src/config/prisma.js");
  for (const { chave, ...data } of LINHAS_ALIQUOTAS) {
    await prisma.aliquotaTributaria.upsert({
      where: { chave },
      update: data,
      create: { chave, ...data },
    });
  }
  console.log(`[seed] ${LINHAS_ALIQUOTAS.length} alíquotas gravadas.`);
  await prisma.$disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("[seed] erro ao gravar alíquotas:", e);
    process.exit(1);
  });
}
