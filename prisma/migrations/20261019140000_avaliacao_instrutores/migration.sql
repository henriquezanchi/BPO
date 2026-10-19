-- Avaliação de instrutores: vínculo turma/matéria/instrutor, questionário, rodadas, participação e respostas anônimas.
CREATE TABLE "TurmaMateria" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "materiaSigla" TEXT NOT NULL,
    "materiaNome" TEXT NOT NULL,
    "instrutorMatr" TEXT NOT NULL,
    "instrutorNome" TEXT NOT NULL,
    "instrutorMemberId" TEXT,
    "inicio" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TurmaMateria_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TurmaMateria_classGroupId_materiaSigla_key" ON "TurmaMateria"("classGroupId", "materiaSigla");
CREATE INDEX "TurmaMateria_schoolId_idx" ON "TurmaMateria"("schoolId");
CREATE INDEX "TurmaMateria_instrutorMatr_idx" ON "TurmaMateria"("instrutorMatr");

CREATE TABLE "AvaliacaoQuestionario" (
    "schoolId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "introducao" TEXT NOT NULL,
    "perguntas" JSONB NOT NULL,
    "atualizadoPorId" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvaliacaoQuestionario_pkey" PRIMARY KEY ("schoolId")
);

CREATE TABLE "AvaliacaoCampanha" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "introducao" TEXT NOT NULL,
    "perguntas" JSONB NOT NULL,
    "turmas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    CONSTRAINT "AvaliacaoCampanha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AvaliacaoCampanha_schoolId_status_idx" ON "AvaliacaoCampanha"("schoolId", "status");

CREATE TABLE "AvaliacaoParticipacao" (
    "campanhaId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    CONSTRAINT "AvaliacaoParticipacao_pkey" PRIMARY KEY ("campanhaId","memberId","alvo")
);

CREATE TABLE "AvaliacaoResposta" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parte" TEXT NOT NULL,
    "classGroupId" TEXT,
    "turmaNome" TEXT,
    "instrutorMatr" TEXT,
    "instrutorNome" TEXT,
    "materias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "respostas" JSONB NOT NULL,
    "dia" DATE NOT NULL,
    CONSTRAINT "AvaliacaoResposta_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AvaliacaoResposta_campanhaId_parte_idx" ON "AvaliacaoResposta"("campanhaId", "parte");
CREATE INDEX "AvaliacaoResposta_schoolId_idx" ON "AvaliacaoResposta"("schoolId");
CREATE INDEX "AvaliacaoResposta_instrutorMatr_idx" ON "AvaliacaoResposta"("instrutorMatr");

ALTER TABLE "TurmaMateria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvaliacaoQuestionario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvaliacaoCampanha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvaliacaoParticipacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvaliacaoResposta" ENABLE ROW LEVEL SECURITY;
