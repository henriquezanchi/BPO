-- AlterTable
ALTER TABLE "Member" ADD COLUMN "authUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_authUserId_key" ON "Member"("authUserId");
