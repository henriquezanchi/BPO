-- CreateEnum
CREATE TYPE "ChargeMessageStatus" AS ENUM ('pendente_aprovacao', 'aprovado', 'enviado', 'descartado');

-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN     "promisedPaymentDate" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "economicNotes" VARCHAR(255),
ADD COLUMN     "economicNotesSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChargeMessageDraft" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "chargeTriggerId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "body" TEXT NOT NULL,
    "status" "ChargeMessageStatus" NOT NULL DEFAULT 'pendente_aprovacao',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ChargeMessageDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repasse" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "note" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repasse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargeMessageDraft_memberId_idx" ON "ChargeMessageDraft"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeMessageDraft_memberId_chargeTriggerId_cycleKey_key" ON "ChargeMessageDraft"("memberId", "chargeTriggerId", "cycleKey");

-- CreateIndex
CREATE INDEX "Repasse_schoolId_idx" ON "Repasse"("schoolId");

-- AddForeignKey
ALTER TABLE "ChargeMessageDraft" ADD CONSTRAINT "ChargeMessageDraft_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMessageDraft" ADD CONSTRAINT "ChargeMessageDraft_chargeTriggerId_fkey" FOREIGN KEY ("chargeTriggerId") REFERENCES "ChargeTrigger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
