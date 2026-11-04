-- Espelho Mercury → Mercúrio antigo (pedido do usuário 04/11/2026, docs/PLANO-ESPELHO-MERCURY-MERCURIO.md).
-- NÃO APLICADA: o espelho fica parado até a migração da base de BGA para o Mercúrio novo terminar. Aplicar só com
-- autorização do usuário, via `prisma db execute` + `prisma migrate resolve --applied` (nunca migrate deploy).

CREATE TABLE "EspelhoMercuryConfig" (
    "schoolId" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'desligado',
    "desde" TEXT NOT NULL,
    "rodada" TIMESTAMP(3),
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EspelhoMercuryConfig_pkey" PRIMARY KEY ("schoolId")
);
ALTER TABLE "EspelhoMercuryConfig" ADD CONSTRAINT "EspelhoMercuryConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EspelhoMercuryConfig" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "EspelhoMercuryItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "matricula" TEXT,
    "nome" TEXT,
    "resumo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "robo" JSONB,
    "revisao" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "vistoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoPor" TEXT,
    "decididoEm" TIMESTAMP(3),
    "observacao" TEXT,
    "feitoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EspelhoMercuryItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EspelhoMercuryItem_schoolId_chave_key" ON "EspelhoMercuryItem"("schoolId", "chave");
CREATE INDEX "EspelhoMercuryItem_schoolId_status_idx" ON "EspelhoMercuryItem"("schoolId", "status");
ALTER TABLE "EspelhoMercuryItem" ADD CONSTRAINT "EspelhoMercuryItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EspelhoMercuryItem" ENABLE ROW LEVEL SECURITY;
