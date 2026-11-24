-- Repertório da Secretaria de Artes (pedido do usuário 24/11/2026): apresentações artísticas registradas (artista
-- voluntário e o que apresentou), para sugerir quando houver eventos programados. Tabela nova, com RLS.

-- CreateTable
CREATE TABLE "RepertorioArtistico" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "artistaId" TEXT,
    "artistaNome" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'musica',
    "duracaoMin" INTEGER,
    "observacoes" TEXT,
    "requisitos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requisitosOutros" TEXT,
    "formatoSimplificado" TEXT,
    "apresentadoEm" TEXT,
    "evento" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepertorioArtistico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepertorioArtistico_schoolId_idx" ON "RepertorioArtistico"("schoolId");

-- CreateIndex
CREATE INDEX "RepertorioArtistico_classGroupId_idx" ON "RepertorioArtistico"("classGroupId");

-- AddForeignKey
ALTER TABLE "RepertorioArtistico" ADD CONSTRAINT "RepertorioArtistico_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RepertorioArtistico" ENABLE ROW LEVEL SECURITY;
