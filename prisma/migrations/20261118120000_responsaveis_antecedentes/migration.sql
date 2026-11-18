-- Responsáveis das crianças do Merlin/Janos, retorno dos instrutores e antecedentes do Maat (pedido do usuário 18/11/2026). Só tabelas novas; RLS ligado (o Portal acessa pelo servidor).

-- CreateTable
CREATE TABLE "Responsavel" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "memberId" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "celular" TEXT,
    "cpfCifrado" TEXT,
    "authUserId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoResponsavel" (
    "id" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "parentesco" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'sugerido',
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoResponsavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetornoInstrutor" (
    "id" TEXT NOT NULL,
    "criancaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "programa" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidoEm" TIMESTAMP(3),

    CONSTRAINT "RetornoInstrutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntecedenteVoluntario" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "resultadoCifrado" TEXT NOT NULL,
    "pesquisadoEm" DATE,
    "validade" DATE,
    "obsCifrada" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AntecedenteVoluntario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoAntecedente" (
    "id" TEXT NOT NULL,
    "diretorId" TEXT NOT NULL,
    "memberId" TEXT,
    "acao" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoAntecedente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenhaAntecedentes" (
    "memberId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenhaAntecedentes_pkey" PRIMARY KEY ("memberId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Responsavel_memberId_key" ON "Responsavel"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Responsavel_authUserId_key" ON "Responsavel"("authUserId");

-- CreateIndex
CREATE INDEX "Responsavel_schoolId_idx" ON "Responsavel"("schoolId");

-- CreateIndex
CREATE INDEX "VinculoResponsavel_status_idx" ON "VinculoResponsavel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoResponsavel_criancaId_responsavelId_key" ON "VinculoResponsavel"("criancaId", "responsavelId");

-- CreateIndex
CREATE INDEX "RetornoInstrutor_criancaId_createdAt_idx" ON "RetornoInstrutor"("criancaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AntecedenteVoluntario_memberId_key" ON "AntecedenteVoluntario"("memberId");

-- CreateIndex
CREATE INDEX "AntecedenteVoluntario_schoolId_idx" ON "AntecedenteVoluntario"("schoolId");

-- CreateIndex
CREATE INDEX "AcessoAntecedente_diretorId_em_idx" ON "AcessoAntecedente"("diretorId", "em");

-- AddForeignKey
ALTER TABLE "VinculoResponsavel" ADD CONSTRAINT "VinculoResponsavel_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Responsavel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Responsavel" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "VinculoResponsavel" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "RetornoInstrutor" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "AntecedenteVoluntario" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "AcessoAntecedente" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "SenhaAntecedentes" ENABLE ROW LEVEL SECURITY;
