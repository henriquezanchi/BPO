-- CreateTable
CREATE TABLE "VolunteerTermSignature" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "termVersion" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerTermSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerTermSignature_memberId_idx" ON "VolunteerTermSignature"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerTermSignature_memberId_termVersion_key" ON "VolunteerTermSignature"("memberId", "termVersion");

-- AddForeignKey
ALTER TABLE "VolunteerTermSignature" ADD CONSTRAINT "VolunteerTermSignature_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
