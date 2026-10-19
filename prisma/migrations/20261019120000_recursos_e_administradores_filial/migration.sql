-- Recursos do Portal liberados por filial e administradores da filial.
CREATE TABLE "RecursoFilial" (
    "schoolId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "alteradoPorId" TEXT NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecursoFilial_pkey" PRIMARY KEY ("schoolId","chave")
);
CREATE TABLE "AdministradorFilial" (
    "schoolId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "designadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdministradorFilial_pkey" PRIMARY KEY ("schoolId","memberId")
);
CREATE INDEX "AdministradorFilial_memberId_idx" ON "AdministradorFilial"("memberId");
-- Mesmo padrão das tabelas novas do Portal: RLS ligada, sem políticas públicas (acesso só pelo servidor).
ALTER TABLE "RecursoFilial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdministradorFilial" ENABLE ROW LEVEL SECURITY;
