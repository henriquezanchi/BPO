CREATE TABLE "ResumoNacional" (
    "chave" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dados" JSONB NOT NULL,
    CONSTRAINT "ResumoNacional_pkey" PRIMARY KEY ("chave")
);
ALTER TABLE "ResumoNacional" ENABLE ROW LEVEL SECURITY;
