-- AlterTable
ALTER TABLE "School" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "enderecoCompleto" TEXT,
ADD COLUMN     "telefoneUnidade" TEXT,
ADD COLUMN     "fundacao" TIMESTAMP(3),
ADD COLUMN     "unidadeSyncedAt" TIMESTAMP(3);
