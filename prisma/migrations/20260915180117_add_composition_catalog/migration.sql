-- CreateTable
CREATE TABLE "SchoolCompositionCatalogItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "mercurioGroupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolCompositionCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolCompositionCatalogItem_schoolId_idx" ON "SchoolCompositionCatalogItem"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCompositionCatalogItem_schoolId_mercurioGroupId_key" ON "SchoolCompositionCatalogItem"("schoolId", "mercurioGroupId");

-- AddForeignKey
ALTER TABLE "SchoolCompositionCatalogItem" ADD CONSTRAINT "SchoolCompositionCatalogItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
