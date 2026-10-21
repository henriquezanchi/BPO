-- Evento com lanche compartilhado; atividade com matéria e temas do catálogo.
ALTER TABLE "Event" ADD COLUMN "lancheCompartilhado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Activity" ADD COLUMN "materiaSigla" TEXT;
ALTER TABLE "Activity" ADD COLUMN "materiaNome" TEXT;
ALTER TABLE "Activity" ADD COLUMN "temas" TEXT[] DEFAULT ARRAY[]::TEXT[];
