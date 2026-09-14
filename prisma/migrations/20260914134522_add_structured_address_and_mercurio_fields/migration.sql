/*
  Warnings:

  - You are about to drop the column `address` on the `Member` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Member" DROP COLUMN "address",
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressComplement" TEXT,
ADD COLUMN     "addressNeighborhood" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "addressZip" TEXT,
ADD COLUMN     "whatsappAlt" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "mercurioFilialLabel" TEXT;
