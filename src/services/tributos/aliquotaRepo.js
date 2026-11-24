import prisma from "../../config/prisma.js";

// Leitura da tabela AliquotaTributaria com cache em memória (a tabela é pequena
// e muda raramente). Linhas novas aparecem em até 10 minutos, ou na hora após limparCache().
const TTL_MS = 10 * 60 * 1000;
let cache = null;
let carregadoEm = 0;

export async function carregarAliquotas() {
  if (cache && Date.now() - carregadoEm < TTL_MS) return cache;
  cache = await prisma.aliquotaTributaria.findMany();
  carregadoEm = Date.now();
  return cache;
}

export function limparCache() {
  cache = null;
  carregadoEm = 0;
}
