ALTER TABLE "Member" ADD COLUMN "isSecretarioEscolastica" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ScholasticPendency" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "memberId" TEXT,
    "tipo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScholasticPendency_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScholasticPendency_schoolId_idx" ON "ScholasticPendency"("schoolId");
CREATE INDEX "ScholasticPendency_memberId_idx" ON "ScholasticPendency"("memberId");

ALTER TABLE "ScholasticPendency" ADD CONSTRAINT "ScholasticPendency_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScholasticPendency" ADD CONSTRAINT "ScholasticPendency_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
