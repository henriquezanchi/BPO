-- Resumo diário da filial (Relatório do Painel do Diretor).
CREATE TABLE "ResumoFilial" (
    "schoolId" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dados" JSONB NOT NULL,
    CONSTRAINT "ResumoFilial_pkey" PRIMARY KEY ("schoolId")
);
ALTER TABLE "ResumoFilial" ENABLE ROW LEVEL SECURITY;
