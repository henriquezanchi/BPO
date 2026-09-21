-- CreateTable
CREATE TABLE "FortunaTopUpCharge" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentChargeStatus" NOT NULL DEFAULT 'pendente',
    "asaasCustomerId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "pixPayload" TEXT,
    "pixQrCodeBase64" TEXT,
    "paidAt" TIMESTAMP(3),
    "launchedAt" TIMESTAMP(3),
    "launchedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FortunaTopUpCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FortunaTopUpCharge_asaasPaymentId_key" ON "FortunaTopUpCharge"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "FortunaTopUpCharge_memberId_idx" ON "FortunaTopUpCharge"("memberId");

-- AddForeignKey
ALTER TABLE "FortunaTopUpCharge" ADD CONSTRAINT "FortunaTopUpCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
