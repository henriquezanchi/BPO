CREATE TABLE "AcessoRetiradoSubchefe" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "porId" TEXT NOT NULL,
  "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcessoRetiradoSubchefe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcessoRetiradoSubchefe_schoolId_memberId_area_key" ON "AcessoRetiradoSubchefe"("schoolId", "memberId", "area");
CREATE INDEX "AcessoRetiradoSubchefe_memberId_idx" ON "AcessoRetiradoSubchefe"("memberId");
ALTER TABLE "AcessoRetiradoSubchefe" ENABLE ROW LEVEL SECURITY;
