-- AlterTable
ALTER TABLE "Member" ADD COLUMN "fortunaClientId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Member_fortunaClientId_key" ON "Member"("fortunaClientId");
