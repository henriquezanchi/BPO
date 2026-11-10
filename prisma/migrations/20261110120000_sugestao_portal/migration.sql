-- Caixa de sugestões do Portal (pedido do usuário 10/11/2026).
-- Aplicar só com autorização do usuário, via `prisma db execute` + `prisma migrate resolve --applied` (nunca migrate deploy).

CREATE TABLE "SugestaoPortal" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "anonima" BOOLEAN NOT NULL DEFAULT false,
    "aparelho" JSONB,
    "status" TEXT NOT NULL DEFAULT 'nova',
    "resposta" TEXT,
    "respondidaEm" TIMESTAMP(3),
    "respondidaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SugestaoPortal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SugestaoPortal_schoolId_status_idx" ON "SugestaoPortal"("schoolId", "status");
CREATE INDEX "SugestaoPortal_categoria_status_idx" ON "SugestaoPortal"("categoria", "status");
CREATE INDEX "SugestaoPortal_memberId_createdAt_idx" ON "SugestaoPortal"("memberId", "createdAt");
ALTER TABLE "SugestaoPortal" ENABLE ROW LEVEL SECURITY;
