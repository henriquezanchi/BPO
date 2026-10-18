-- Abertura do Portal por filial + testadores liberados por dirigentes (2026-10-18).
ALTER TABLE "School" ADD COLUMN "mercurioUnidade" TEXT;
ALTER TABLE "School" ADD COLUMN "portalAberto" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "School_mercurioUnidade_key" ON "School"("mercurioUnidade");

ALTER TABLE "Member" ADD COLUMN "liberaTestadores" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TestadorLiberado" (
    "mercurioId" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "liberadoPor" TEXT NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestadorLiberado_pkey" PRIMARY KEY ("mercurioId")
);
CREATE INDEX "TestadorLiberado_unidade_idx" ON "TestadorLiberado"("unidade");

CREATE TABLE "LiberadorNacional" (
    "mercurioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiberadorNacional_pkey" PRIMARY KEY ("mercurioId")
);
