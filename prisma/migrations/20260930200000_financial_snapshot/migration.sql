CREATE TABLE "FinancialSnapshot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialSnapshot_schoolId_ano_mes_key" ON "FinancialSnapshot"("schoolId", "ano", "mes");
CREATE INDEX "FinancialSnapshot_schoolId_idx" ON "FinancialSnapshot"("schoolId");

ALTER TABLE "FinancialSnapshot" ADD CONSTRAINT "FinancialSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
