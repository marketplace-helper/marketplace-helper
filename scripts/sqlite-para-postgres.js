// Copia todos os dados de um banco SQLite antigo (prisma/dev.db, /data/prod.db...)
// para o Postgres do DATABASE_URL. Uso único, na virada de SQLite para Postgres.
//
//   npm run db:migrar-sqlite -- caminho/do/banco.db
//
// Antes: o Postgres de destino precisa estar com as migrations aplicadas
// (npx prisma migrate deploy) e VAZIO. O script se recusa a gravar por cima.
//
// Modo automático (--auto), usado no start:prod do Railway: lê o caminho da
// variável SQLITE_MIGRAR_DE. Sem a variável, não faz nada. Se o Postgres já tem
// dados (boots seguintes), só avisa e segue. Assim a virada acontece sozinha no
// primeiro deploy com Postgres, lendo o SQLite do volume.
//
// Como funciona: lê cada tabela do SQLite com o node:sqlite (Node 22.5+), converte
// cada coluna pelo tipo do schema.prisma (no SQLite o Prisma grava datas como
// milissegundos e booleanos como 0/1) e insere no Postgres na ordem das chaves
// estrangeiras, mantendo os ids. No fim, acerta as sequences dos ids e confere a
// contagem de linhas de cada tabela.
import "dotenv/config";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient, Prisma } from "@prisma/client";

// Pais antes dos filhos (ordem das chaves estrangeiras).
const ORDEM = [
  "User",
  "AuthToken",
  "MlConnection",
  "MlOAuthAttempt",
  "Settings",
  "BusinessRule",
  "AliquotaTributaria",
  "Item",
  "ShippingHistory",
];
const LOTE = 500;

const AUTO = process.argv.includes("--auto");
const caminho = AUTO ? process.env.SQLITE_MIGRAR_DE : process.argv[2];
if (!caminho) {
  if (AUTO) process.exit(0); // virada não configurada: nada a fazer
  console.error("Uso: npm run db:migrar-sqlite -- caminho/do/banco.db");
  process.exit(1);
}
if (AUTO) console.log(`[migrar-sqlite] SQLITE_MIGRAR_DE=${caminho}`);
if (!fs.existsSync(caminho)) {
  console.error(`Arquivo não encontrado: ${caminho}`);
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  console.error("DATABASE_URL precisa apontar para o Postgres de destino (postgresql://...).");
  process.exit(1);
}

const modelos = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const faltando = [...modelos.keys()].filter((n) => !ORDEM.includes(n));
if (faltando.length) {
  console.error(`Modelos sem lugar na ORDEM do script: ${faltando.join(", ")}. Atualize o script.`);
  process.exit(1);
}

// Datas: o Prisma grava milissegundos; linhas criadas por SQL de migration
// (DEFAULT CURRENT_TIMESTAMP) podem ter texto "AAAA-MM-DD HH:MM:SS" em UTC.
function paraData(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "bigint") return new Date(Number(v));
  const s = String(v);
  if (/^\d+$/.test(s)) return new Date(Number(s));
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) return new Date(s.replace(" ", "T") + "Z");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${s}`);
  return d;
}

function converter(campo, v) {
  if (v === null || v === undefined) return null;
  switch (campo.type) {
    case "DateTime":
      return paraData(v);
    case "Boolean":
      return v === 1 || v === 1n || v === true || v === "1" || v === "true";
    case "Int":
      return Number(v);
    case "Float":
      return Number(v);
    default:
      return typeof v === "bigint" ? v.toString() : v;
  }
}

const prisma = new PrismaClient();

// Modo automático: destino com dados = virada já feita num boot anterior.
if (AUTO) {
  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "User"`);
  if (n > 0) {
    console.log(`[migrar-sqlite] Postgres já tem ${n} usuário(s); cópia já feita, pulando.`);
    await prisma.$disconnect();
    process.exit(0);
  }
}

const sqlite = new DatabaseSync(caminho, { readOnly: true });

const tabelasSqlite = new Set(
  sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name),
);

try {
  // Recusa destino com dados
  for (const nome of ORDEM) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${nome}"`);
    if (n > 0) {
      throw new Error(`O Postgres de destino já tem dados em "${nome}" (${n} linhas). Use um banco vazio.`);
    }
  }

  const resumo = [];
  await prisma.$transaction(
    async (tx) => {
      for (const nome of ORDEM) {
        if (!tabelasSqlite.has(nome)) {
          console.warn(`- ${nome}: não existe no SQLite, pulando.`);
          resumo.push({ nome, origem: 0 });
          continue;
        }
        const modelo = modelos.get(nome);
        const escalares = modelo.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
        const colunas = new Set(sqlite.prepare(`PRAGMA table_info("${nome}")`).all().map((c) => c.name));
        const ausentes = escalares.filter((f) => !colunas.has(f.name)).map((f) => f.name);
        if (ausentes.length) console.warn(`- ${nome}: colunas ausentes no SQLite (ficam com o padrão): ${ausentes.join(", ")}`);
        const campos = escalares.filter((f) => colunas.has(f.name));

        const linhas = sqlite.prepare(`SELECT * FROM "${nome}" ORDER BY id`).all();
        const dados = linhas.map((l) => Object.fromEntries(campos.map((f) => [f.name, converter(f, l[f.name])])));

        const delegate = tx[nome.charAt(0).toLowerCase() + nome.slice(1)];
        for (let i = 0; i < dados.length; i += LOTE) {
          await delegate.createMany({ data: dados.slice(i, i + LOTE) });
        }
        // Próximo id = maior id copiado + 1
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${nome}"', 'id'), COALESCE((SELECT MAX(id) FROM "${nome}"), 1), (SELECT MAX(id) FROM "${nome}") IS NOT NULL)`,
        );
        console.log(`- ${nome}: ${dados.length} linha(s)`);
        resumo.push({ nome, origem: dados.length });
      }
    },
    { timeout: 15 * 60 * 1000, maxWait: 30 * 1000 },
  );

  // Conferência
  let ok = true;
  for (const { nome, origem } of resumo) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${nome}"`);
    if (n !== origem) {
      ok = false;
      console.error(`  DIVERGÊNCIA em ${nome}: SQLite ${origem}, Postgres ${n}`);
    }
  }
  if (!ok) throw new Error("Contagens não batem.");
  console.log("\nCópia concluída e conferida.");
} catch (err) {
  console.error(`\nFalhou: ${err.message}`);
  console.error("Nada foi gravado (a cópia roda numa transação única).");
  process.exitCode = 1;
} finally {
  sqlite.close();
  await prisma.$disconnect();
}
