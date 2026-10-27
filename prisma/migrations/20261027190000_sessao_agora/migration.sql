-- Túnel do Ágora (pedido do usuário 2026-10-27, autorizado): sessão de cada aluno no login unificado, para o Portal
-- chamar o Ágora como o próprio aluno. Tokens e cookie do Ágora guardados cifrados (AES-256-GCM). Uma linha por membro.
CREATE TABLE "SessaoAgora" (
    "memberId" TEXT NOT NULL,
    "accessCifrado" TEXT NOT NULL,
    "refreshCifrado" TEXT,
    "accessExpiraEm" TIMESTAMP(3) NOT NULL,
    "refreshExpiraEm" TIMESTAMP(3),
    "cookieCifrado" TEXT,
    "cookieAte" TIMESTAMP(3),
    "falhaEm" TIMESTAMP(3),
    "falha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessaoAgora_pkey" PRIMARY KEY ("memberId")
);
ALTER TABLE "SessaoAgora" ADD CONSTRAINT "SessaoAgora_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessaoAgora" ENABLE ROW LEVEL SECURITY;
