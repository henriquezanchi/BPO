-- Avisos push agendados já enviados (evita repetição).
CREATE TABLE "PushEnviado" (
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushEnviado_pkey" PRIMARY KEY ("chave")
);

-- Regra do projeto: toda tabela nova com RLS.
ALTER TABLE "PushEnviado" ENABLE ROW LEVEL SECURITY;
