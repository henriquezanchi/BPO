-- Oportunidades de voluntariado (pedido do usuário 2026-10-29). Aditiva.
CREATE TABLE "OportunidadeVoluntariado" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'pontual',
    "data" TEXT,
    "horario" TEXT,
    "vagas" INTEGER,
    "abertaAte" TEXT,
    "grupoId" TEXT,
    "encerradaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OportunidadeVoluntariado_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OportunidadeVoluntariado_schoolId_encerradaEm_idx" ON "OportunidadeVoluntariado"("schoolId", "encerradaEm");
CREATE INDEX "OportunidadeVoluntariado_responsavelId_idx" ON "OportunidadeVoluntariado"("responsavelId");
ALTER TABLE "OportunidadeVoluntariado" ADD CONSTRAINT "OportunidadeVoluntariado_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OportunidadeVoluntariado" ADD CONSTRAINT "OportunidadeVoluntariado_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OportunidadeVoluntariado" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "InteresseVoluntariado" (
    "id" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "recado" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "respondidoPorId" TEXT,
    "respondidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InteresseVoluntariado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InteresseVoluntariado_oportunidadeId_memberId_key" ON "InteresseVoluntariado"("oportunidadeId", "memberId");
CREATE INDEX "InteresseVoluntariado_memberId_idx" ON "InteresseVoluntariado"("memberId");
ALTER TABLE "InteresseVoluntariado" ADD CONSTRAINT "InteresseVoluntariado_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "OportunidadeVoluntariado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteresseVoluntariado" ADD CONSTRAINT "InteresseVoluntariado_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteresseVoluntariado" ENABLE ROW LEVEL SECURITY;
