-- Telas de TV da filial (eventos em rotação por público).
CREATE TABLE "TelaEventos" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "publicos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token" TEXT NOT NULL,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelaEventos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TelaEventos_token_key" ON "TelaEventos"("token");
CREATE INDEX "TelaEventos_schoolId_idx" ON "TelaEventos"("schoolId");
ALTER TABLE "TelaEventos" ADD CONSTRAINT "TelaEventos_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelaEventos" ENABLE ROW LEVEL SECURITY;
