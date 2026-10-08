ALTER TABLE "Member" ADD COLUMN "isSecretarioEconomia" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ContactChangeLog" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'aplicado';
ALTER TABLE "ContactChangeLog" ADD COLUMN "reviewedAt" TIMESTAMP(3);
