-- Voluntários dos programas Merlin e Janos e certidão negativa criminal (pedido do usuário 09/11/2026).
-- Aplicar só com autorização do usuário, via `prisma db execute` + `prisma migrate resolve --applied` (nunca migrate deploy).

CREATE TABLE "VoluntarioInfantojuvenil" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programa" TEXT NOT NULL,
    "certidaoEm" DATE,
    "certidaoValidade" DATE,
    "certidaoOrgao" TEXT,
    "observacao" TEXT,
    "historico" JSONB NOT NULL DEFAULT '[]',
    "marcadoPorId" TEXT NOT NULL,
    "atualizadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoluntarioInfantojuvenil_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VoluntarioInfantojuvenil_memberId_programa_key" ON "VoluntarioInfantojuvenil"("memberId", "programa");
CREATE INDEX "VoluntarioInfantojuvenil_schoolId_programa_idx" ON "VoluntarioInfantojuvenil"("schoolId", "programa");
ALTER TABLE "VoluntarioInfantojuvenil" ENABLE ROW LEVEL SECURITY;
