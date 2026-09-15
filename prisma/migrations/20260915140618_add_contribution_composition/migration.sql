-- CreateTable
CREATE TABLE "ContributionCompositionItem" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mercurioGroupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "addedViaPortal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionCompositionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContributionCompositionItem_memberId_idx" ON "ContributionCompositionItem"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionCompositionItem_memberId_mercurioGroupId_key" ON "ContributionCompositionItem"("memberId", "mercurioGroupId");

-- AddForeignKey
ALTER TABLE "ContributionCompositionItem" ADD CONSTRAINT "ContributionCompositionItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
