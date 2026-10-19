-- Tesouraria dentro do Portal (substitui o Upstash Redis da ferramenta antiga).
CREATE TABLE "TesourariaArquivo" ("escopo" TEXT NOT NULL, "nome" TEXT NOT NULL, "conteudo" TEXT NOT NULL, "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TesourariaArquivo_pkey" PRIMARY KEY ("escopo","nome"));
CREATE TABLE "TesourariaValor" ("escopo" TEXT NOT NULL, "chave" TEXT NOT NULL, "valor" JSONB NOT NULL, "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TesourariaValor_pkey" PRIMARY KEY ("escopo","chave"));
CREATE TABLE "TesourariaJob" ("id" TEXT NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TesourariaJob_pkey" PRIMARY KEY ("id"));
CREATE INDEX "TesourariaJob_criadoEm_idx" ON "TesourariaJob"("criadoEm");
CREATE TABLE "TesourariaJobEvento" ("jobId" TEXT NOT NULL, "posicao" INTEGER NOT NULL, "evento" JSONB NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TesourariaJobEvento_pkey" PRIMARY KEY ("jobId","posicao"));
CREATE INDEX "TesourariaJobEvento_criadoEm_idx" ON "TesourariaJobEvento"("criadoEm");
CREATE TABLE "TesourariaTrava" ("chave" TEXT NOT NULL, "dono" TEXT NOT NULL, "expiraEm" TIMESTAMP(3) NOT NULL, CONSTRAINT "TesourariaTrava_pkey" PRIMARY KEY ("chave"));
ALTER TABLE "TesourariaArquivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TesourariaValor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TesourariaJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TesourariaJobEvento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TesourariaTrava" ENABLE ROW LEVEL SECURITY;
