-- Diário de FV dentro do GDVE (pedido do usuário 2026-10-31, autorizado): o dia de FV (Degrau, Forja, presenças, horas,
-- tarefas do GDVE) e a ficha da pessoa (mestre, Carta de Degrau, calendário, missões do ciclo). Privado: só a própria
-- pessoa; o Portal acessa pelo servidor. origemId guarda o documento do Firebase na importação.
CREATE TABLE "DiarioFvDia" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "itens" JSONB NOT NULL DEFAULT '{}',
    "praticas" JSONB NOT NULL DEFAULT '{}',
    "presencas" JSONB NOT NULL DEFAULT '{}',
    "minutosVoluntariado" INTEGER,
    "minutosAulaAssistida" INTEGER,
    "minutosAulaMinistrada" INTEGER,
    "gdveTarefas" JSONB NOT NULL DEFAULT '{}',
    "gdvePresenca" BOOLEAN NOT NULL DEFAULT false,
    "origem" TEXT NOT NULL DEFAULT 'portal',
    "origemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiarioFvDia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiarioFvDia_memberId_data_key" ON "DiarioFvDia"("memberId", "data");
ALTER TABLE "DiarioFvDia" ADD CONSTRAINT "DiarioFvDia_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiarioFvDia" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "DiarioFvFicha" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "unidade" TEXT,
    "condicao" TEXT,
    "mestre" TEXT,
    "ultimoEncontro" TEXT,
    "ultimaCarta" TEXT,
    "proximaCarta" TEXT,
    "calendario" JSONB NOT NULL DEFAULT '{}',
    "tarefas" JSONB NOT NULL DEFAULT '[]',
    "ciclo" JSONB NOT NULL DEFAULT '{}',
    "proximaReuniao" TEXT,
    "origemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiarioFvFicha_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiarioFvFicha_memberId_key" ON "DiarioFvFicha"("memberId");
ALTER TABLE "DiarioFvFicha" ADD CONSTRAINT "DiarioFvFicha_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiarioFvFicha" ENABLE ROW LEVEL SECURITY;
