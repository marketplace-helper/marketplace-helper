-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "whatsapp" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerifiedAt" TIMESTAMP(3),
    "pendingEmail" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'TESTE',
    "testeAte" TIMESTAMP(3),
    "testeAvisoEm" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlConnection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mlUserId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastRefreshAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MlConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlOAuthAttempt" (
    "id" SERIAL NOT NULL,
    "nonce" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MlOAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "zipCode" TEXT NOT NULL DEFAULT '01001000',
    "lastSyncAt" TIMESTAMP(3),
    "syncManualDia" TEXT,
    "syncManualQtd" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "icms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ipi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "custoOperacional" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regime" TEXT NOT NULL DEFAULT 'SIMPLES',
    "ufOrigem" TEXT,
    "creditoCompra" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AliquotaTributaria" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "tributo" TEXT NOT NULL,
    "aliquota" DOUBLE PRECISION NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PERCENTUAL',
    "regime" TEXT NOT NULL DEFAULT 'TODOS',
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "uf" TEXT,
    "ncm" TEXT,
    "cClassTrib" TEXT,
    "naoCumulativo" BOOLEAN NOT NULL DEFAULT false,
    "somenteDestaque" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AliquotaTributaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mlb" TEXT NOT NULL,
    "proprio" BOOLEAN NOT NULL DEFAULT true,
    "variacaoIds" TEXT,
    "sku" TEXT,
    "variacaoSkus" TEXT,
    "marca" TEXT,
    "titulo" TEXT NOT NULL DEFAULT '',
    "largura" DOUBLE PRECISION,
    "altura" DOUBLE PRECISION,
    "comprimento" DOUBLE PRECISION,
    "pesoReal" DOUBLE PRECISION,
    "thumbnail" TEXT,
    "permalink" TEXT,
    "custoProduto" DOUBLE PRECISION,
    "precoDe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precoPor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frete" DOUBLE PRECISION,
    "freteAnterior" DOUBLE PRECISION,
    "freteMudou" BOOLEAN NOT NULL DEFAULT false,
    "comissao" DOUBLE PRECISION,
    "comissaoPct" DOUBLE PRECISION,
    "status" TEXT,
    "dataCriacao" TEXT,
    "tipoAnuncio" TEXT,
    "visitas" INTEGER NOT NULL DEFAULT 0,
    "vendas" INTEGER NOT NULL DEFAULT 0,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "catalogo" BOOLEAN NOT NULL DEFAULT false,
    "full" BOOLEAN NOT NULL DEFAULT false,
    "categoria1" TEXT,
    "categoria2" TEXT,
    "categoria3" TEXT,
    "categoria4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingHistory" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "mlb" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MlConnection_userId_key" ON "MlConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MlConnection_mlUserId_key" ON "MlConnection"("mlUserId");

-- CreateIndex
CREATE INDEX "MlConnection_status_expiresAt_idx" ON "MlConnection"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MlOAuthAttempt_nonce_key" ON "MlOAuthAttempt"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRule_userId_key" ON "BusinessRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AliquotaTributaria_chave_key" ON "AliquotaTributaria"("chave");

-- CreateIndex
CREATE INDEX "AliquotaTributaria_tributo_regime_idx" ON "AliquotaTributaria"("tributo", "regime");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "Item_titulo_idx" ON "Item"("titulo");

-- CreateIndex
CREATE INDEX "Item_frete_idx" ON "Item"("frete");

-- CreateIndex
CREATE UNIQUE INDEX "Item_userId_mlb_key" ON "Item"("userId", "mlb");

-- CreateIndex
CREATE INDEX "ShippingHistory_mlb_idx" ON "ShippingHistory"("mlb");

-- CreateIndex
CREATE INDEX "ShippingHistory_capturedAt_idx" ON "ShippingHistory"("capturedAt");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MlConnection" ADD CONSTRAINT "MlConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MlOAuthAttempt" ADD CONSTRAINT "MlOAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRule" ADD CONSTRAINT "BusinessRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingHistory" ADD CONSTRAINT "ShippingHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

