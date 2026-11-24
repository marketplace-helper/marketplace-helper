-- CreateTable
CREATE TABLE "AliquotaTributaria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chave" TEXT NOT NULL,
    "tributo" TEXT NOT NULL,
    "aliquota" REAL NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PERCENTUAL',
    "regime" TEXT NOT NULL DEFAULT 'TODOS',
    "vigenciaInicio" DATETIME NOT NULL,
    "vigenciaFim" DATETIME,
    "uf" TEXT,
    "ncm" TEXT,
    "cClassTrib" TEXT,
    "naoCumulativo" BOOLEAN NOT NULL DEFAULT false,
    "somenteDestaque" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "icms" REAL NOT NULL DEFAULT 0,
    "ipi" REAL NOT NULL DEFAULT 0,
    "difal" REAL NOT NULL DEFAULT 0,
    "custoOperacional" REAL NOT NULL DEFAULT 0,
    "regime" TEXT NOT NULL DEFAULT 'SIMPLES',
    "ufOrigem" TEXT,
    "creditoCompra" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BusinessRule" ("custoOperacional", "difal", "icms", "id", "ipi", "updatedAt", "userId") SELECT "custoOperacional", "difal", "icms", "id", "ipi", "updatedAt", "userId" FROM "BusinessRule";
DROP TABLE "BusinessRule";
ALTER TABLE "new_BusinessRule" RENAME TO "BusinessRule";
CREATE UNIQUE INDEX "BusinessRule_userId_key" ON "BusinessRule"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AliquotaTributaria_chave_key" ON "AliquotaTributaria"("chave");

-- CreateIndex
CREATE INDEX "AliquotaTributaria_tributo_regime_idx" ON "AliquotaTributaria"("tributo", "regime");
