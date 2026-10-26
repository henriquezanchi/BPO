-- Escala de apresentações nas turmas de pedagogos e planos de aula (pedido do usuário 2026-10-26). Aditiva.
CREATE TABLE "ApresentacaoPedagogo" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "pedagogoId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "materiaSigla" TEXT,
    "tema" TEXT NOT NULL,
    "topicos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "lembretePlanoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApresentacaoPedagogo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApresentacaoPedagogo_classGroupId_data_idx" ON "ApresentacaoPedagogo"("classGroupId", "data");
CREATE INDEX "ApresentacaoPedagogo_pedagogoId_data_idx" ON "ApresentacaoPedagogo"("pedagogoId", "data");
CREATE INDEX "ApresentacaoPedagogo_schoolId_data_idx" ON "ApresentacaoPedagogo"("schoolId", "data");
ALTER TABLE "ApresentacaoPedagogo" ADD CONSTRAINT "ApresentacaoPedagogo_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApresentacaoPedagogo" ADD CONSTRAINT "ApresentacaoPedagogo_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApresentacaoPedagogo" ADD CONSTRAINT "ApresentacaoPedagogo_pedagogoId_fkey" FOREIGN KEY ("pedagogoId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApresentacaoPedagogo" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "PlanoAula" (
    "id" TEXT NOT NULL,
    "apresentacaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "sintese" TEXT,
    "praticaFilosofica" TEXT,
    "ponteParaVida" TEXT,
    "consequencias" TEXT,
    "arquivoPath" TEXT,
    "arquivoNome" TEXT,
    "arquivoTipo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "entregueEm" TIMESTAMP(3),
    "comentarioInstrutor" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "revisadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanoAula_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanoAula_apresentacaoId_key" ON "PlanoAula"("apresentacaoId");
ALTER TABLE "PlanoAula" ADD CONSTRAINT "PlanoAula_apresentacaoId_fkey" FOREIGN KEY ("apresentacaoId") REFERENCES "ApresentacaoPedagogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanoAula" ADD CONSTRAINT "PlanoAula_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanoAula" ENABLE ROW LEVEL SECURITY;
