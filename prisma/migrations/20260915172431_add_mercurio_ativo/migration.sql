-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "mercurioAtivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mercurioAtivoSync" TIMESTAMP(3);
