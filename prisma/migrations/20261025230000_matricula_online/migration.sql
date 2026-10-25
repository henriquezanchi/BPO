-- Site de matrículas por abertura (pedido do usuário 2026-10-25). Aditiva.
ALTER TABLE "AberturaTurma" ADD COLUMN "matriculaToken" TEXT;
ALTER TABLE "AberturaTurma" ADD COLUMN "matriculaAberta" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AberturaTurma" ADD COLUMN "valorContribuicaoCentavos" INTEGER;
UPDATE "AberturaTurma" SET "matriculaToken" = replace(gen_random_uuid()::text, '-', '') WHERE "matriculaToken" IS NULL;
CREATE UNIQUE INDEX "AberturaTurma_matriculaToken_key" ON "AberturaTurma"("matriculaToken");

CREATE TABLE "MatriculaOnline" (
    "id" TEXT NOT NULL,
    "aberturaId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "nascimento" TEXT,
    "sexo" TEXT,
    "naturalidade" TEXT,
    "nacionalidade" TEXT,
    "estadoCivil" TEXT,
    "rg" TEXT,
    "rgOrgao" TEXT,
    "rgEmissao" TEXT,
    "cpfInicio" TEXT NOT NULL,
    "cpfCifrado" TEXT,
    "escolaridade" TEXT,
    "profissao" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "comoConheceu" TEXT,
    "consentimentoEm" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    "valorCentavos" INTEGER NOT NULL,
    "asaasCustomerId" TEXT,
    "asaasPaymentId" TEXT,
    "pagoEm" TIMESTAMP(3),
    "lancadaEm" TIMESTAMP(3),
    "mercurioMatricula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatriculaOnline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatriculaOnline_asaasPaymentId_key" ON "MatriculaOnline"("asaasPaymentId");
CREATE INDEX "MatriculaOnline_aberturaId_idx" ON "MatriculaOnline"("aberturaId");
CREATE INDEX "MatriculaOnline_schoolId_status_idx" ON "MatriculaOnline"("schoolId", "status");
ALTER TABLE "MatriculaOnline" ADD CONSTRAINT "MatriculaOnline_aberturaId_fkey" FOREIGN KEY ("aberturaId") REFERENCES "AberturaTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatriculaOnline" ADD CONSTRAINT "MatriculaOnline_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatriculaOnline" ENABLE ROW LEVEL SECURITY;
