CREATE TABLE "RedefinicaoSenha" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "porId" TEXT NOT NULL,
  "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedefinicaoSenha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RedefinicaoSenha_memberId_idx" ON "RedefinicaoSenha"("memberId");
ALTER TABLE "RedefinicaoSenha" ENABLE ROW LEVEL SECURITY;
