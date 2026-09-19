-- AlterTable
ALTER TABLE "Payable" ADD COLUMN     "rubricaId" TEXT;

-- CreateTable
CREATE TABLE "SchoolPaymentRubrica" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "mercurioRubricaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPaymentRubrica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolPaymentRubrica_schoolId_idx" ON "SchoolPaymentRubrica"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPaymentRubrica_schoolId_mercurioRubricaId_key" ON "SchoolPaymentRubrica"("schoolId", "mercurioRubricaId");

-- CreateIndex
CREATE INDEX "Payable_rubricaId_idx" ON "Payable"("rubricaId");

-- AddForeignKey
ALTER TABLE "SchoolPaymentRubrica" ADD CONSTRAINT "SchoolPaymentRubrica_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_rubricaId_fkey" FOREIGN KEY ("rubricaId") REFERENCES "SchoolPaymentRubrica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
