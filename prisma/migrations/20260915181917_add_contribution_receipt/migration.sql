-- CreateTable
CREATE TABLE "ContributionReceipt" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mercurioRecId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "probablyCanceled" BOOLEAN NOT NULL DEFAULT false,
    "rawText" TEXT,
    "canceled" BOOLEAN,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContributionReceipt_mercurioRecId_key" ON "ContributionReceipt"("mercurioRecId");

-- CreateIndex
CREATE INDEX "ContributionReceipt_memberId_idx" ON "ContributionReceipt"("memberId");

-- AddForeignKey
ALTER TABLE "ContributionReceipt" ADD CONSTRAINT "ContributionReceipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
