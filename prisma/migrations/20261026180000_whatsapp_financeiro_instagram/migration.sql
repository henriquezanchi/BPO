-- WhatsApp do financeiro (número central da rede, via Zernio) e Instagram opcional das filiais (pedido do usuário 2026-10-26). Aditiva.
CREATE TABLE "WhatsappEnvio" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "memberId" TEXT,
    "telefone" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "zernioMessageId" TEXT,
    "custoCentavos" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "enviadaEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappEnvio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsappEnvio_referencia_key" ON "WhatsappEnvio"("referencia");
CREATE INDEX "WhatsappEnvio_schoolId_createdAt_idx" ON "WhatsappEnvio"("schoolId", "createdAt");
CREATE INDEX "WhatsappEnvio_zernioMessageId_idx" ON "WhatsappEnvio"("zernioMessageId");
ALTER TABLE "WhatsappEnvio" ADD CONSTRAINT "WhatsappEnvio_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappEnvio" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "WhatsappDescadastro" (
    "telefone" TEXT NOT NULL,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappDescadastro_pkey" PRIMARY KEY ("telefone")
);
ALTER TABLE "WhatsappDescadastro" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "RedeSocialFilial" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "rede" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'contratada',
    "valorMensalCentavos" INTEGER NOT NULL,
    "zernioProfileId" TEXT,
    "zernioAccountId" TEXT,
    "usuario" TEXT,
    "contratadaPorId" TEXT NOT NULL,
    "contratadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conectadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedeSocialFilial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RedeSocialFilial_schoolId_rede_key" ON "RedeSocialFilial"("schoolId", "rede");
CREATE INDEX "RedeSocialFilial_zernioAccountId_idx" ON "RedeSocialFilial"("zernioAccountId");
ALTER TABLE "RedeSocialFilial" ADD CONSTRAINT "RedeSocialFilial_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedeSocialFilial" ENABLE ROW LEVEL SECURITY;
