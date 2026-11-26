-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "zipCode" TEXT NOT NULL DEFAULT '01001000',
    "lastSyncAt" DATETIME,
    "syncManualDia" TEXT,
    "syncManualQtd" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("id", "lastSyncAt", "updatedAt", "userId", "zipCode") SELECT "id", "lastSyncAt", "updatedAt", "userId", "zipCode" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "whatsapp" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerifiedAt" DATETIME,
    "pendingEmail" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'TESTE',
    "testeAte" DATETIME,
    "testeAvisoEm" DATETIME
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerifiedAt", "id", "passwordHash", "pendingEmail", "storeName", "whatsapp") SELECT "createdAt", "email", "emailVerifiedAt", "id", "passwordHash", "pendingEmail", "storeName", "whatsapp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Contas que já existiam e já confirmaram o e-mail continuam com uso completo.
UPDATE "User" SET "plano" = 'COMPLETO' WHERE "emailVerifiedAt" IS NOT NULL;
