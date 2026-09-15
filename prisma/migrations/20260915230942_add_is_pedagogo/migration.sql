-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "isPedagogo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pedagogoSyncedAt" TIMESTAMP(3);
