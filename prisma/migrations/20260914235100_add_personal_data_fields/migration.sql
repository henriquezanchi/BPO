-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "escolaridade" TEXT,
ADD COLUMN     "estadoCivil" TEXT,
ADD COLUMN     "naturalidade" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "rgDataEmissao" TIMESTAMP(3),
ADD COLUMN     "rgNumero" TEXT,
ADD COLUMN     "rgOrgaoEmissor" TEXT;
