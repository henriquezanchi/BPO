-- Diário filosófico dentro do Portal (pedido do usuário 2026-10-29, autorizado): o dia do diário (Prólogo e Epílogo,
-- virtude, compromisso, frase, práticas marcadas) e as práticas da pessoa. Privado: só a própria pessoa lê; o Portal
-- acessa pelo servidor. origemId guarda o documento do Firebase na importação (reexecução sem duplicar).
CREATE TABLE "DiarioDia" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "virtude" TEXT,
    "compromisso" TEXT,
    "frase" JSONB,
    "prologoEm" TIMESTAMP(3),
    "semPrologo" BOOLEAN NOT NULL DEFAULT false,
    "falhei" TEXT,
    "fizBem" TEXT,
    "deixeiDeFazer" TEXT,
    "reflexaoLivre" TEXT,
    "epilogoEm" TIMESTAMP(3),
    "praticas" JSONB NOT NULL DEFAULT '{}',
    "origem" TEXT NOT NULL DEFAULT 'portal',
    "origemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiarioDia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiarioDia_memberId_data_key" ON "DiarioDia"("memberId", "data");
ALTER TABLE "DiarioDia" ADD CONSTRAINT "DiarioDia_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiarioDia" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "DiarioPratica" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "recorrencia" TEXT NOT NULL DEFAULT 'diaria',
    "diasSemana" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "diaMes" INTEGER,
    "dataBase" TEXT NOT NULL,
    "arquivadaEm" TIMESTAMP(3),
    "origemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiarioPratica_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DiarioPratica_memberId_idx" ON "DiarioPratica"("memberId");
CREATE UNIQUE INDEX "DiarioPratica_memberId_origemId_key" ON "DiarioPratica"("memberId", "origemId");
ALTER TABLE "DiarioPratica" ADD CONSTRAINT "DiarioPratica_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiarioPratica" ENABLE ROW LEVEL SECURITY;
