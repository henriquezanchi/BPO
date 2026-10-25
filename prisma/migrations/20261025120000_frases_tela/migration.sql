-- Frases da semana das TVs, por filial.
CREATE TABLE "FraseTela" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "obra" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FraseTela_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FraseTela_schoolId_idx" ON "FraseTela"("schoolId");
ALTER TABLE "FraseTela" ADD CONSTRAINT "FraseTela_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FraseTela" ENABLE ROW LEVEL SECURITY;
