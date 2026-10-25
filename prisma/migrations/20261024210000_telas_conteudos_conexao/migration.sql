-- Telas de TV: conteúdos além dos eventos, orientação, cartões da filial e conexão pelo controle remoto.
ALTER TABLE "TelaEventos" ADD COLUMN "conteudos" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TelaEventos" ADD COLUMN "orientacao" TEXT NOT NULL DEFAULT 'auto';

CREATE TABLE "TelaCartao" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT,
    "link" TEXT,
    "ate" TIMESTAMP(3),
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelaCartao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TelaCartao_schoolId_idx" ON "TelaCartao"("schoolId");
ALTER TABLE "TelaCartao" ADD CONSTRAINT "TelaCartao_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelaCartao" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "TvConexao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "segredo" TEXT NOT NULL,
    "telaId" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "conectadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TvConexao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TvConexao_codigo_key" ON "TvConexao"("codigo");
CREATE UNIQUE INDEX "TvConexao_segredo_key" ON "TvConexao"("segredo");
CREATE INDEX "TvConexao_expiraEm_idx" ON "TvConexao"("expiraEm");
ALTER TABLE "TvConexao" ADD CONSTRAINT "TvConexao_telaId_fkey" FOREIGN KEY ("telaId") REFERENCES "TelaEventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TvConexao" ENABLE ROW LEVEL SECURITY;
