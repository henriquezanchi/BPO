-- CreateTable
CREATE TABLE "AccountantDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountantDocument_schoolId_idx" ON "AccountantDocument"("schoolId");

-- AddForeignKey
ALTER TABLE "AccountantDocument" ADD CONSTRAINT "AccountantDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
