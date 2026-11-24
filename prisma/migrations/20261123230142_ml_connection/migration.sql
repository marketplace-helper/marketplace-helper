/*
  Warnings:

  - You are about to drop the `MlAccount` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateTable
CREATE TABLE "MlConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "mlUserId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastRefreshAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MlConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MlOAuthAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nonce" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MlOAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MlConnection_userId_key" ON "MlConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MlConnection_mlUserId_key" ON "MlConnection"("mlUserId");

-- CreateIndex
CREATE INDEX "MlConnection_status_expiresAt_idx" ON "MlConnection"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MlOAuthAttempt_nonce_key" ON "MlOAuthAttempt"("nonce");

-- Conexões existentes viram "reconexão pendente" (tokens foram emitidos para outro app)
INSERT INTO "MlConnection" ("userId", "status", "lastError", "createdAt", "updatedAt")
SELECT "userId", 'reconnect_required', 'Migração para o app da plataforma', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MlAccount" WHERE "accessToken" IS NOT NULL;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MlAccount";
PRAGMA foreign_keys=on;
