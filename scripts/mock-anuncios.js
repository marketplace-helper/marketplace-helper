// Popula uma conta local com anúncios fictícios (sem precisar do Mercado Livre).
// Uso: npm run mock:anuncios -- email@exemplo.com
// Rodar de novo substitui os anúncios fictícios anteriores (MLB99...) da conta. Só roda local.
import { config } from "../src/config/env.js";
import prisma from "../src/config/prisma.js";

if (!config.isLocal) {
  console.error("mock:anuncios só roda local (sem NODE_ENV=production e fora do Railway).");
  process.exit(1);
}

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Uso: npm run mock:anuncios -- email@exemplo.com");
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email} em ${process.env.DATABASE_URL}.`);
  await prisma.$disconnect();
  process.exit(1);
}

const PREFIXO = "MLB99";
const dias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// Produtos: medidas em cm, peso em kg. custo null = sem custo informado (aparece como pendente).
const PRODUTOS = [
  { sku: "CAN-INOX-500", nome: "Garrafa Térmica Inox 500ml", custo: 28.9, m: [8, 25, 8, 0.45], cat: ["Casa", "Cozinha", "Garrafas"] },
  { sku: "FONE-BT-X1", nome: "Fone Bluetooth X1 com Case", custo: 41.5, m: [10, 5, 10, 0.18], cat: ["Eletrônicos", "Áudio", "Fones"] },
  { sku: "TAP-YOGA-6MM", nome: "Tapete de Yoga 6mm Antiderrapante", custo: 37.0, m: [15, 15, 62, 1.2], cat: ["Esportes", "Fitness", "Yoga"] },
  { sku: "LUM-LED-MESA", nome: "Luminária LED de Mesa Articulada", custo: 55.0, m: [18, 45, 18, 0.9], cat: ["Casa", "Iluminação", "Luminárias"] },
  { sku: "KIT-PANELA-5", nome: "Jogo de Panelas Antiaderente 5 Peças", custo: 149.9, m: [32, 28, 45, 6.8], cat: ["Casa", "Cozinha", "Panelas"] },
  { sku: "CAPA-IP15", nome: "Capa Silicone iPhone 15", custo: 6.2, m: [9, 2, 16, 0.05], cat: ["Celulares", "Acessórios", "Capas"] },
  { sku: "MOCH-NOTE-15", nome: "Mochila para Notebook 15,6\" Impermeável", custo: 62.0, m: [30, 12, 45, 0.85], cat: ["Bolsas", "Mochilas"] },
  { sku: "CAD-GAMER-PRO", nome: "Cadeira Gamer Pro Reclinável", custo: 489.0, m: [70, 35, 80, 21.5], cat: ["Casa", "Móveis", "Cadeiras"] },
  { sku: "SUP-NOTE-ALU", nome: "Suporte para Notebook em Alumínio", custo: 34.5, m: null, cat: ["Informática", "Acessórios"] },
  { sku: "BAL-COZ-10KG", nome: "Balança Digital de Cozinha 10kg", custo: null, m: [16, 3, 22, 0.4], cat: ["Casa", "Cozinha", "Balanças"] },
  { sku: "ESC-DENT-ELE", nome: "Escova de Dentes Elétrica Recarregável", custo: 39.9, m: [7, 6, 25, 0.3], cat: ["Beleza", "Higiene bucal"] },
  { sku: "CAB-USBC-2M", nome: "Cabo USB-C 2m Nylon Trançado", custo: 4.8, m: [10, 2, 12, 0.06], cat: ["Celulares", "Acessórios", "Cabos"] },
  { sku: "PUFF-BAU-VER", nome: "Puff Baú Veludo Verde", custo: 78.0, m: [40, 42, 40, 4.2], cat: ["Casa", "Móveis", "Puffs"] },
  { sku: "KIT-FERR-129", nome: "Maleta de Ferramentas 129 Peças", custo: 118.0, m: null, cat: ["Ferramentas", "Kits"] },
];

// Anúncios: vários por SKU em alguns casos (clássico × premium, catálogo, kit).
// frete: o que o ML cobra; fator > 1 deixa o frete divergente das medidas.
const ANUNCIOS = [
  { sku: "CAN-INOX-500", de: 79.9, por: 64.9, tipo: "gold_special", vendas: 312, visitas: 5400, estoque: 120, full: true, frete: 21.45 },
  { sku: "CAN-INOX-500", de: 84.9, tipo: "gold_pro", vendas: 88, visitas: 2100, estoque: 120, catalogo: true, frete: 21.45 },
  { sku: "FONE-BT-X1", de: 129.9, por: 99.9, tipo: "gold_pro", vendas: 540, visitas: 12800, estoque: 60, full: true, frete: 19.95 },
  { sku: "FONE-BT-X1", de: 119.9, tipo: "gold_special", vendas: 75, visitas: 3100, estoque: 60, frete: 19.95, freteAnterior: 17.45 },
  { sku: "TAP-YOGA-6MM", de: 109.9, tipo: "gold_special", vendas: 140, visitas: 4300, estoque: 35, frete: 22.95 },
  { sku: "LUM-LED-MESA", de: 149.9, por: 129.9, tipo: "gold_pro", vendas: 66, visitas: 2900, estoque: 18, frete: 24.95, freteAnterior: 21.95 },
  { sku: "KIT-PANELA-5", de: 399.9, por: 349.9, tipo: "gold_pro", vendas: 41, visitas: 3800, estoque: 9, frete: 32.9 },
  { sku: "KIT-PANELA-5", de: 389.9, tipo: "gold_special", vendas: 12, visitas: 900, estoque: 9, frete: 32.9 },
  { sku: "CAPA-IP15", de: 29.9, tipo: "gold_special", vendas: 1250, visitas: 21000, estoque: 400, full: true, frete: 0 },
  { sku: "CAPA-IP15", de: 49.9, titulo: "Kit 2 Capas Silicone iPhone 15", tipo: "gold_special", vendas: 230, visitas: 4800, estoque: 200, frete: 0 },
  { sku: "MOCH-NOTE-15", de: 189.9, tipo: "gold_pro", vendas: 57, visitas: 2600, estoque: 25, frete: 18.95 },
  { sku: "CAD-GAMER-PRO", de: 1299.9, por: 1099.9, tipo: "gold_pro", vendas: 14, visitas: 6100, estoque: 4, frete: 79.9 },
  { sku: "SUP-NOTE-ALU", de: 89.9, tipo: "gold_special", vendas: 97, visitas: 2700, estoque: 50, frete: 19.95 },
  { sku: "BAL-COZ-10KG", de: 49.9, tipo: "gold_special", vendas: 410, visitas: 7600, estoque: 150, frete: 0 },
  { sku: "ESC-DENT-ELE", de: 139.9, tipo: "gold_pro", vendas: 3, visitas: 1400, estoque: 40, frete: 18.45 },
  { sku: "CAB-USBC-2M", de: 24.9, tipo: "gold_special", vendas: 2100, visitas: 30500, estoque: 800, full: true, frete: 0 },
  { sku: "PUFF-BAU-VER", de: 219.9, tipo: "gold_special", vendas: 22, visitas: 1900, estoque: 0, status: "paused", frete: 36.9 },
  { sku: "KIT-FERR-129", de: 259.9, por: 229.9, tipo: "gold_pro", vendas: 35, visitas: 2200, estoque: 12, frete: 29.9 },
  // Sem SKU: aparece em Anúncios, mas não em Produtos.
  { sku: null, titulo: "Organizador de Gaveta (sem SKU)", de: 39.9, tipo: "gold_special", vendas: 8, visitas: 600, estoque: 30, frete: 0 },
];

const COMISSAO = { gold_special: 0.12, gold_pro: 0.17 };
const porSku = new Map(PRODUTOS.map((p) => [p.sku, p]));

await prisma.item.deleteMany({ where: { userId: user.id, mlb: { startsWith: PREFIXO } } });

let n = 0;
for (const a of ANUNCIOS) {
  n++;
  const p = a.sku ? porSku.get(a.sku) : null;
  const mlb = `${PREFIXO}${String(n).padStart(8, "0")}`;
  const base = a.por || a.de;
  const comissaoPct = COMISSAO[a.tipo] * 100;
  const [largura, altura, comprimento, pesoReal] = p?.m ?? [null, null, null, null];
  const item = await prisma.item.create({
    data: {
      userId: user.id,
      mlb,
      sku: a.sku,
      titulo: a.titulo || p?.nome || "Anúncio fictício",
      permalink: `https://produto.mercadolivre.com.br/${mlb.replace("MLB", "MLB-")}-anuncio-ficticio`,
      custoProduto: p?.custo ?? null,
      largura, altura, comprimento, pesoReal,
      precoDe: a.de,
      precoPor: a.por || 0,
      frete: a.frete,
      freteAnterior: a.freteAnterior ?? null,
      freteMudou: a.freteAnterior != null,
      comissao: +(base * COMISSAO[a.tipo]).toFixed(2),
      comissaoPct,
      status: a.status || "active",
      dataCriacao: dias(30 + n * 11).toISOString().slice(0, 10),
      tipoAnuncio: a.tipo,
      visitas: a.visitas,
      vendas: a.vendas,
      estoque: a.estoque,
      catalogo: Boolean(a.catalogo),
      full: Boolean(a.full),
      categoria1: p?.cat[0] ?? "Casa",
      categoria2: p?.cat[1] ?? null,
      categoria3: p?.cat[2] ?? null,
    },
  });
  // Histórico de frete: quem mudou de valor tem o preço antigo registrado.
  const hist = a.freteAnterior != null
    ? [{ cost: a.freteAnterior, capturedAt: dias(20) }, { cost: a.frete, capturedAt: dias(1) }]
    : [{ cost: a.frete, capturedAt: dias(1) }];
  await prisma.shippingHistory.createMany({ data: hist.map((h) => ({ ...h, itemId: item.id, mlb })) });
}

await prisma.settings.upsert({
  where: { userId: user.id },
  update: { lastSyncAt: new Date() },
  create: { userId: user.id, lastSyncAt: new Date() },
});

console.log(`${ANUNCIOS.length} anúncios fictícios (${PRODUTOS.length} SKUs) gravados para ${email} em ${process.env.DATABASE_URL}.`);
await prisma.$disconnect();
