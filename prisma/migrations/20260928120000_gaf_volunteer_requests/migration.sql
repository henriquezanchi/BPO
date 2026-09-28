CREATE TABLE "GafRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GafRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VolunteerOffer" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "secretarias" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GafRequest_memberId_idx" ON "GafRequest"("memberId");
CREATE INDEX "VolunteerOffer_memberId_idx" ON "VolunteerOffer"("memberId");

ALTER TABLE "GafRequest" ADD CONSTRAINT "GafRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VolunteerOffer" ADD CONSTRAINT "VolunteerOffer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
