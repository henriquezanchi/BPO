-- Liberação em camadas da área de voluntários (grupos, avisos, escalas).
CREATE TABLE "AcessoVoluntario" (
    "memberId" TEXT NOT NULL,
    "liberadoPorId" TEXT NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcessoVoluntario_pkey" PRIMARY KEY ("memberId")
);
CREATE INDEX "AcessoVoluntario_liberadoPorId_idx" ON "AcessoVoluntario"("liberadoPorId");
