ALTER TABLE "Member" ADD COLUMN "tourCompletedAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN "dataEntradaEscola" TIMESTAMP(3);

CREATE TABLE "MemberBadge" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberBadge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemberLevelHistory" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLevelHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberBadge_memberId_badgeType_key" ON "MemberBadge"("memberId", "badgeType");
CREATE INDEX "MemberBadge_memberId_idx" ON "MemberBadge"("memberId");
CREATE INDEX "MemberLevelHistory_memberId_idx" ON "MemberLevelHistory"("memberId");

ALTER TABLE "MemberBadge" ADD CONSTRAINT "MemberBadge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemberLevelHistory" ADD CONSTRAINT "MemberLevelHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
