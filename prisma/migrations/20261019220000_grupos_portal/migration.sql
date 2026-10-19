-- GAF, GDVE e secretarias: grupos montados no Portal, atividades e presença.
ALTER TABLE "ClassGroup" ADD COLUMN "descricao" TEXT,
  ADD COLUMN "modalidade" TEXT,
  ADD COLUMN "local" TEXT,
  ADD COLUMN "linkOnline" TEXT,
  ADD COLUMN "permiteAlunos" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "programa" TEXT,
  ADD COLUMN "criadoPorId" TEXT,
  ADD COLUMN "arquivadoEm" TIMESTAMP(3);
ALTER TABLE "GroupMeetingSeries" ADD COLUMN "intervaloSemanas" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "GrupoAtividade" (
  "id" TEXT NOT NULL,
  "classGroupId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "responsaveis" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "periodicidade" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ativa',
  "criadoPorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrupoAtividade_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GrupoAtividade_classGroupId_idx" ON "GrupoAtividade"("classGroupId");
ALTER TABLE "GrupoAtividade" ADD CONSTRAINT "GrupoAtividade_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrupoAtividade" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "GrupoPresenca" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "participou" BOOLEAN NOT NULL,
  "motivo" TEXT,
  "naoInformou" BOOLEAN NOT NULL DEFAULT false,
  "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrupoPresenca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrupoPresenca_meetingId_memberId_key" ON "GrupoPresenca"("meetingId", "memberId");
CREATE INDEX "GrupoPresenca_memberId_idx" ON "GrupoPresenca"("memberId");
ALTER TABLE "GrupoPresenca" ADD CONSTRAINT "GrupoPresenca_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GroupMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrupoPresenca" ENABLE ROW LEVEL SECURITY;
