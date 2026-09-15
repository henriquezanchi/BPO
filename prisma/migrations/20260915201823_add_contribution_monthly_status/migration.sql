-- CreateEnum
CREATE TYPE "ContributionMonthStatus" AS ENUM ('em_branco', 'paga', 'atrasado', 'isento');

-- CreateTable
CREATE TABLE "ContributionMonthlyStatus" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "ContributionMonthStatus" NOT NULL,
    "registeredAtBR" TEXT,
    "registeredBy" TEXT,
    "mercurioRecId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionMonthlyStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContributionMonthlyStatus_memberId_idx" ON "ContributionMonthlyStatus"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionMonthlyStatus_memberId_year_month_key" ON "ContributionMonthlyStatus"("memberId", "year", "month");

-- AddForeignKey
ALTER TABLE "ContributionMonthlyStatus" ADD CONSTRAINT "ContributionMonthlyStatus_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
