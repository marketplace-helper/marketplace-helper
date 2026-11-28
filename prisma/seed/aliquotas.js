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

// Alíquota interna modal de ICMS de uma UF (sugestão do campo ICMS em Regras; fora do cálculo).
// `desde` "2000-01-01" quando a fonte não traz a data de início.
function icmsInterno(uf, aliquota, desde, lei) {
  return {
    chave: `ICMS_INTERNO:${uf}:${desde}`,
    tributo: "ICMS_INTERNO",
    regime: "TODOS",
    uf,
    aliquota,
    tipo: "PERCENTUAL",
    vigenciaInicio: new Date(`${desde}T00:00:00-03:00`),
    vigenciaFim: null,
    naoCumulativo: false,
    somenteDestaque: false,
    observacao: `Alíquota interna modal (sugestão em Regras). ${lei}. Conferir com contador.`,
  };
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

  // ICMS interno modal por UF. Fonte: tabela da Barbieri Advogados (atualizada nov/2026),
  // que cita a lei de cada estado. As fontes divergem em MA, BA, RO, PI e SE.
  icmsInterno("AC", 19, "2023-04-01", "LC 55/1997 (LC 422/2022)"),
  icmsInterno("AL", 20.5, "2026-04-01", "Lei 5.900/1996 (Lei 9.776/2025)"),
  icmsInterno("AP", 18, "2000-01-01", "Lei 400/1997 (Lei 1.949/2015)"),
  icmsInterno("AM", 20, "2023-04-01", "LC 19/1997 (LCs 242/2022 e 244/2023)"),
  icmsInterno("BA", 20.5, "2024-02-01", "Lei 7.014/1996 (Lei 14.629/2023)"),
  icmsInterno("CE", 20, "2000-01-01", "Lei 12.670/1996 (Lei 18.305/2023)"),
  icmsInterno("DF", 20, "2024-01-01", "Lei 1.254/1996 (Lei 7.326/2023)"),
  icmsInterno("ES", 17, "2000-01-01", "Sefaz-ES"),
  icmsInterno("GO", 19, "2024-04-01", "Lei 11.651/1991 (Lei 22.460/2023)"),
  icmsInterno("MA", 23, "2025-02-23", "Lei 7.799/2002 (Lei 12.426/2024)"),
  icmsInterno("MT", 17, "2000-01-01", "Lei 7.098/1998"),
  icmsInterno("MS", 17, "2000-01-01", "Lei 1.810/1997 (Lei 3.477/2007)"),
  icmsInterno("MG", 18, "2000-01-01", "RICMS/MG (Decreto 48.589/2023)"),
  icmsInterno("PA", 19, "2023-03-01", "Lei 5.530/1989 (Lei 9.755/2022)"),
  icmsInterno("PB", 20, "2024-01-01", "Lei 6.379/1996 (Lei 12.788/2023)"),
  icmsInterno("PR", 19.5, "2024-03-18", "Lei 11.580/1996 (Lei 21.850/2023)"),
  icmsInterno("PE", 20.5, "2024-01-01", "Lei 15.730/2016 (Lei 18.305/2023)"),
  icmsInterno("PI", 22.5, "2025-04-01", "Lei 4.257/1989 (Lei 8.558/2024)"),
  icmsInterno("RJ", 22, "2024-03-20", "Lei 2.657/1996 (Lei 10.253/2023) + 2 pontos do FECP (LC 210/2023)"),
  icmsInterno("RN", 20, "2025-03-01", "Lei 6.968/1996 (Lei 11.999/2024)"),
  icmsInterno("RS", 17, "2000-01-01", "Governo do RS"),
  icmsInterno("RO", 19.5, "2024-01-12", "Lei 688/1996 (Lei 5.634/2023)"),
  icmsInterno("RR", 20, "2023-03-30", "Lei 59/1993 (Lei 1.767/2022)"),
  icmsInterno("SC", 17, "2000-01-01", "RICMS/SC, art. 26, I"),
  icmsInterno("SP", 18, "2000-01-01", "RICMS/SP, art. 52, I"),
  icmsInterno("SE", 19, "2023-04-01", "Lei 3.796/1996 (Lei 9.176/2023)"),
  icmsInterno("TO", 20, "2000-01-01", "Lei 1.287/2001 (Lei 4.141/2023)"),
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
