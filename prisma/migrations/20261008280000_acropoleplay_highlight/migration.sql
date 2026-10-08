-- Pedido do usuário 2026-10-08: card de destaque da Acrópole Play no Portal.
CREATE TABLE "AcropolePlayHighlight" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "imagemUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AcropolePlayHighlight_pkey" PRIMARY KEY ("id")
);
