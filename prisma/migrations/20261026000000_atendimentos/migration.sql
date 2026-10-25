-- Atendimentos individuais com o instrutor (pedido do usuário 2026-10-25). Aditiva.
CREATE TABLE "AtendimentoJanela" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "instrutorId" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "data" TEXT,
    "inicioMinuto" INTEGER NOT NULL,
    "fimMinuto" INTEGER NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL DEFAULT 30,
    "modalidade" TEXT NOT NULL DEFAULT 'presencial',
    "local" TEXT,
    "linkOnline" TEXT,
    "datasFechadas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtendimentoJanela_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AtendimentoJanela_instrutorId_idx" ON "AtendimentoJanela"("instrutorId");
CREATE INDEX "AtendimentoJanela_schoolId_idx" ON "AtendimentoJanela"("schoolId");
ALTER TABLE "AtendimentoJanela" ADD CONSTRAINT "AtendimentoJanela_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtendimentoJanela" ADD CONSTRAINT "AtendimentoJanela_instrutorId_fkey" FOREIGN KEY ("instrutorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtendimentoJanela" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "AtendimentoReserva" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "instrutorId" TEXT NOT NULL,
    "alunoId" TEXT,
    "janelaId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "modalidade" TEXT NOT NULL DEFAULT 'presencial',
    "local" TEXT,
    "linkOnline" TEXT,
    "assunto" TEXT,
    "status" TEXT NOT NULL DEFAULT 'marcada',
    "canceladoPor" TEXT,
    "motivoCancelamento" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "lembreteEnviadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtendimentoReserva_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AtendimentoReserva_instrutorId_inicio_idx" ON "AtendimentoReserva"("instrutorId", "inicio");
CREATE INDEX "AtendimentoReserva_alunoId_inicio_idx" ON "AtendimentoReserva"("alunoId", "inicio");
CREATE INDEX "AtendimentoReserva_schoolId_inicio_idx" ON "AtendimentoReserva"("schoolId", "inicio");
-- Um horário do instrutor só pode ter uma reserva ou um bloqueio em vigor (evita marcação dupla simultânea).
CREATE UNIQUE INDEX "AtendimentoReserva_instrutor_inicio_ativo" ON "AtendimentoReserva"("instrutorId", "inicio") WHERE "status" IN ('marcada', 'bloqueio');
ALTER TABLE "AtendimentoReserva" ADD CONSTRAINT "AtendimentoReserva_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtendimentoReserva" ADD CONSTRAINT "AtendimentoReserva_instrutorId_fkey" FOREIGN KEY ("instrutorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtendimentoReserva" ADD CONSTRAINT "AtendimentoReserva_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtendimentoReserva" ADD CONSTRAINT "AtendimentoReserva_janelaId_fkey" FOREIGN KEY ("janelaId") REFERENCES "AtendimentoJanela"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AtendimentoReserva" ENABLE ROW LEVEL SECURITY;
