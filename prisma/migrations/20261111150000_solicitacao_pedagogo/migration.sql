-- Solicitação de inclusão de pedagogo no Mercúrio (pedido do usuário 11/11/2026; aplicação autorizada pelo usuário).
-- Aplicar via `prisma db execute` + `prisma migrate resolve --applied` (nunca migrate deploy).

CREATE TABLE "SolicitacaoPedagogo" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "formacao" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "observacao" TEXT,
    "atendidaEm" TIMESTAMP(3),
    "atendidaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SolicitacaoPedagogo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SolicitacaoPedagogo_schoolId_status_idx" ON "SolicitacaoPedagogo"("schoolId", "status");
CREATE INDEX "SolicitacaoPedagogo_status_createdAt_idx" ON "SolicitacaoPedagogo"("status", "createdAt");
CREATE INDEX "SolicitacaoPedagogo_memberId_idx" ON "SolicitacaoPedagogo"("memberId");
ALTER TABLE "SolicitacaoPedagogo" ENABLE ROW LEVEL SECURITY;
