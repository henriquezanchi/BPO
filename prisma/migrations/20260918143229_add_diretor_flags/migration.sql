-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "isDiretor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSubChefe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "direcaoSyncedAt" TIMESTAMP(3);
