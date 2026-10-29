-- Pedido do usuário 2026-10-29, autorizado ("pode criar os 3"):
-- 1) observações sobre a atividade que já aconteceu: uma só para a administração/professores, outra para os alunos;
-- 2) anotações das aulas (por matéria e tema), com compartilhamento, conferência secreta do professor e resumo por IA;
-- 3) livros da pessoa na Área de Estudos.
ALTER TABLE "Activity" ADD COLUMN "observacaoInterna" TEXT;
ALTER TABLE "Activity" ADD COLUMN "observacaoAlunos" TEXT;

CREATE TABLE "AnotacaoAula" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "materiaSigla" TEXT NOT NULL,
    "materiaNome" TEXT,
    "tema" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "compartilhada" BOOLEAN NOT NULL DEFAULT false,
    "compartilhadaEm" TIMESTAMP(3),
    "revisao" TEXT NOT NULL DEFAULT 'pendente',
    "revisadoPorId" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "resumo" TEXT,
    "resumoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnotacaoAula_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnotacaoAula_memberId_materiaSigla_tema_key" ON "AnotacaoAula"("memberId", "materiaSigla", "tema");
CREATE INDEX "AnotacaoAula_schoolId_materiaSigla_tema_idx" ON "AnotacaoAula"("schoolId", "materiaSigla", "tema");
ALTER TABLE "AnotacaoAula" ADD CONSTRAINT "AnotacaoAula_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnotacaoAula" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "LivroLeitura" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "autor" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'quero_ler',
    "observacao" TEXT,
    "origemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LivroLeitura_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LivroLeitura_memberId_idx" ON "LivroLeitura"("memberId");
CREATE UNIQUE INDEX "LivroLeitura_memberId_origemId_key" ON "LivroLeitura"("memberId", "origemId");
ALTER TABLE "LivroLeitura" ADD CONSTRAINT "LivroLeitura_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivroLeitura" ENABLE ROW LEVEL SECURITY;
