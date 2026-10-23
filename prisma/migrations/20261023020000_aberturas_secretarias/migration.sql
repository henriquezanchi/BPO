-- CreateTable
CREATE TABLE "AberturaTurma" (
    "mercurioTurmaId" TEXT,
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "primeiraAula" TIMESTAMP(3) NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL DEFAULT 120,
    "capacidade" INTEGER NOT NULL,
    "metaMatriculas" INTEGER NOT NULL,
    "orcamentoCentavos" INTEGER NOT NULL DEFAULT 0,
    "sala" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "professorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revisao" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AberturaTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AberturaRegistro" (
    "id" TEXT NOT NULL,
    "aberturaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AberturaRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessorDisponibilidade" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "fimMinuto" INTEGER NOT NULL,
    "validaDe" TEXT NOT NULL,
    "validaAte" TEXT NOT NULL,
    "impedimentos" JSONB NOT NULL DEFAULT '[]',
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessorDisponibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretariaEscala" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "secretaria" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMinuto" INTEGER NOT NULL,
    "fimMinuto" INTEGER NOT NULL,
    "validaDe" TEXT NOT NULL,
    "validaAte" TEXT NOT NULL,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretariaEscala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AberturaConfig" (
    "schoolId" TEXT NOT NULL,
    "capacidadeEscola" INTEGER,
    "funcoesNecessarias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "compartilharAprendizados" BOOLEAN NOT NULL DEFAULT false,
    "revisao" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AberturaConfig_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "AberturaCrmCache" (
    "schoolId" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "sincronizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AberturaCrmCache_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "SecretariaMandato" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "secretaria" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "schoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ufs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretariaMandato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretariaPublicacao" (
    "id" TEXT NOT NULL,
    "secretaria" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "url" TEXT,
    "schoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ufs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "exigeLeitura" BOOLEAN NOT NULL DEFAULT false,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretariaPublicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretariaLeitura" (
    "id" TEXT NOT NULL,
    "publicacaoId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretariaLeitura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AberturaTurma_schoolId_primeiraAula_idx" ON "AberturaTurma"("schoolId", "primeiraAula");

-- CreateIndex
CREATE INDEX "AberturaRegistro_aberturaId_tipo_createdAt_idx" ON "AberturaRegistro"("aberturaId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "ProfessorDisponibilidade_schoolId_professorId_idx" ON "ProfessorDisponibilidade"("schoolId", "professorId");

-- CreateIndex
CREATE INDEX "SecretariaEscala_schoolId_diaSemana_idx" ON "SecretariaEscala"("schoolId", "diaSemana");

-- CreateIndex
CREATE INDEX "SecretariaMandato_memberId_ativo_idx" ON "SecretariaMandato"("memberId", "ativo");

-- CreateIndex
CREATE INDEX "SecretariaPublicacao_secretaria_publicado_idx" ON "SecretariaPublicacao"("secretaria", "publicado");

-- CreateIndex
CREATE UNIQUE INDEX "SecretariaLeitura_publicacaoId_memberId_versao_key" ON "SecretariaLeitura"("publicacaoId", "memberId", "versao");

-- AddForeignKey
ALTER TABLE "AberturaRegistro" ADD CONSTRAINT "AberturaRegistro_aberturaId_fkey" FOREIGN KEY ("aberturaId") REFERENCES "AberturaTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Dados operacionais e pessoais são acessíveis exclusivamente pelo servidor.
DO $$ DECLARE tabela text; BEGIN
 FOREACH tabela IN ARRAY ARRAY['AberturaTurma','AberturaRegistro','ProfessorDisponibilidade','SecretariaEscala','AberturaConfig','AberturaCrmCache','SecretariaMandato','SecretariaPublicacao','SecretariaLeitura'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tabela);
  EXECUTE format('REVOKE ALL ON %I FROM anon,authenticated',tabela);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO service_role',tabela);
 END LOOP;
END $$;
ALTER TABLE "AberturaTurma" ADD CHECK ("diaSemana" BETWEEN 0 AND 6 AND "inicioMinuto" BETWEEN 0 AND 1320 AND "duracaoMinutos"=120 AND "capacidade">0 AND "metaMatriculas">0 AND "metaMatriculas"<="capacidade" AND "orcamentoCentavos">=0);
ALTER TABLE "AberturaTurma" ADD FOREIGN KEY ("schoolId") REFERENCES "School"(id);
ALTER TABLE "AberturaTurma" ADD FOREIGN KEY ("autorId") REFERENCES "Member"(id);
ALTER TABLE "ProfessorDisponibilidade" ADD CHECK ("diaSemana" BETWEEN 0 AND 6 AND "inicioMinuto">=0 AND "fimMinuto"<=1440 AND "fimMinuto">"inicioMinuto" AND "validaAte">="validaDe");
ALTER TABLE "SecretariaEscala" ADD CHECK ("diaSemana" BETWEEN 0 AND 6 AND "inicioMinuto">=0 AND "fimMinuto"<=1440 AND "fimMinuto">"inicioMinuto" AND "validaAte">="validaDe");
ALTER TABLE "SecretariaMandato" ADD CHECK (escopo IN ('nacional','regional','local'));
ALTER TABLE "SecretariaPublicacao" ADD CHECK (tipo IN ('material','aviso','reuniao','ideia','plano'));
CREATE OR REPLACE FUNCTION public.aberturas_crm_chave() RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='aberturas_crm_service_key' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.aberturas_crm_chave() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aberturas_crm_chave() TO service_role;
