-- Conta provisória (cobrança pela conta de Barra do Garças em nome das escolas do piloto sem conta própria), repasses e PIN do financeiro (pedido do usuário 23/11/2026). Só tabelas novas; RLS ligado.

-- CreateTable
CREATE TABLE "CobrancaProvisoria" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "titularSchoolId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "referenciaId" TEXT,
    "memberId" TEXT,
    "asaasId" TEXT NOT NULL,
    "valorBruto" DECIMAL(10,2) NOT NULL,
    "splitBpo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxaAsaas" DECIMAL(10,2),
    "valorLiquido" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "pagoEm" TIMESTAMP(3),
    "repasseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CobrancaProvisoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepasseFilial" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "titularSchoolId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "tarifa" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "chavePix" TEXT NOT NULL,
    "tipoChave" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'solicitado',
    "transferId" TEXT,
    "pedidoPorId" TEXT NOT NULL,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "RepasseFilial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinFinanceiro" (
    "memberId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinFinanceiro_pkey" PRIMARY KEY ("memberId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CobrancaProvisoria_asaasId_key" ON "CobrancaProvisoria"("asaasId");

-- CreateIndex
CREATE INDEX "CobrancaProvisoria_schoolId_status_idx" ON "CobrancaProvisoria"("schoolId", "status");

-- CreateIndex
CREATE INDEX "CobrancaProvisoria_repasseId_idx" ON "CobrancaProvisoria"("repasseId");

-- CreateIndex
CREATE UNIQUE INDEX "RepasseFilial_transferId_key" ON "RepasseFilial"("transferId");

-- CreateIndex
CREATE INDEX "RepasseFilial_schoolId_createdAt_idx" ON "RepasseFilial"("schoolId", "createdAt");

ALTER TABLE "CobrancaProvisoria" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "RepasseFilial" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "PinFinanceiro" ENABLE ROW LEVEL SECURITY;
