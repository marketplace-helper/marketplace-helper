// Confirma o e-mail e libera o uso completo de uma conta direto no banco do .env.
import "../src/config/env.js";
// Uso: npm run conta:liberar -- email@exemplo.com
import prisma from "../src/config/prisma.js";
import { PLANOS } from "../src/services/acesso/plano.js";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Uso: npm run conta:liberar -- email@exemplo.com");
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email} em ${process.env.DATABASE_URL}.`);
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.user.update({
  where: { id: user.id },
  data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), plano: PLANOS.COMPLETO },
});
console.log(`Conta ${email} (id ${user.id}) confirmada e liberada (COMPLETO) em ${process.env.DATABASE_URL}.`);
await prisma.$disconnect();
