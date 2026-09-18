-- CreateEnum
CREATE TYPE "PaymentChargeStatus" AS ENUM ('pendente', 'pago', 'expirado', 'cancelado');

-- CreateTable
CREATE TABLE "PaymentCharge" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentChargeStatus" NOT NULL DEFAULT 'pendente',
    "asaasCustomerId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "pixPayload" TEXT,
    "pixQrCodeBase64" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCharge_asaasPaymentId_key" ON "PaymentCharge"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "PaymentCharge_memberId_idx" ON "PaymentCharge"("memberId");

-- AddForeignKey
ALTER TABLE "PaymentCharge" ADD CONSTRAINT "PaymentCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
