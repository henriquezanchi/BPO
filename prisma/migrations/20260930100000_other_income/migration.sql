CREATE TABLE "OtherIncome" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtherIncome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtherIncome_schoolId_idx" ON "OtherIncome"("schoolId");
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
