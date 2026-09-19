/*
  Warnings:

  - You are about to drop the column `referenceMonth` on the `AccountantDocument` table. All the data in the column will be lost.
  - You are about to drop the column `referenceYear` on the `AccountantDocument` table. All the data in the column will be lost.
  - You are about to drop the column `schoolId` on the `AccountantDocument` table. All the data in the column will be lost.
  - Added the required column `payableId` to the `AccountantDocument` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AccountantDocument" DROP CONSTRAINT "AccountantDocument_schoolId_fkey";

-- DropIndex
DROP INDEX "AccountantDocument_schoolId_idx";

-- AlterTable
ALTER TABLE "AccountantDocument" DROP COLUMN "referenceMonth",
DROP COLUMN "referenceYear",
DROP COLUMN "schoolId",
ADD COLUMN     "payableId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AccountantDocument_payableId_idx" ON "AccountantDocument"("payableId");

-- AddForeignKey
ALTER TABLE "AccountantDocument" ADD CONSTRAINT "AccountantDocument_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
