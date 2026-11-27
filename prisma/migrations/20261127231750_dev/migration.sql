-- CreateTable
CREATE TABLE "ClassificacaoFeedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "versaoModelo" TEXT NOT NULL,
    "classePrevista" TEXT NOT NULL,
    "classeCorreta" TEXT NOT NULL,
    "concordou" BOOLEAN NOT NULL,
    "features" TEXT NOT NULL,
    "probabilidades" TEXT NOT NULL,
    "predicaoId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassificacaoFeedback_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassificacaoFeedback_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassificacaoFeedback_predicaoId_fkey" FOREIGN KEY ("predicaoId") REFERENCES "ClassificacaoPredicao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassificacaoPredicao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "versaoModelo" TEXT NOT NULL,
    "classePrevista" TEXT NOT NULL,
    "probabilidades" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassificacaoPredicao_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassificacaoPredicao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassificacaoFeedback_predicaoId_key" ON "ClassificacaoFeedback"("predicaoId");

-- CreateIndex
CREATE INDEX "ClassificacaoFeedback_itemId_idx" ON "ClassificacaoFeedback"("itemId");

-- CreateIndex
CREATE INDEX "ClassificacaoFeedback_usuarioId_idx" ON "ClassificacaoFeedback"("usuarioId");

-- CreateIndex
CREATE INDEX "ClassificacaoFeedback_criadoEm_idx" ON "ClassificacaoFeedback"("criadoEm");

-- CreateIndex
CREATE INDEX "ClassificacaoFeedback_versaoModelo_idx" ON "ClassificacaoFeedback"("versaoModelo");

-- CreateIndex
CREATE INDEX "ClassificacaoPredicao_itemId_idx" ON "ClassificacaoPredicao"("itemId");

-- CreateIndex
CREATE INDEX "ClassificacaoPredicao_usuarioId_idx" ON "ClassificacaoPredicao"("usuarioId");

-- CreateIndex
CREATE INDEX "ClassificacaoPredicao_criadoEm_idx" ON "ClassificacaoPredicao"("criadoEm");

-- CreateIndex
CREATE INDEX "ClassificacaoPredicao_versaoModelo_idx" ON "ClassificacaoPredicao"("versaoModelo");
