-- AlterTable
ALTER TABLE "Payable" ADD COLUMN     "bankFitId" TEXT,
ADD COLUMN     "predicted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Payable_bankFitId_key" ON "Payable"("bankFitId");
