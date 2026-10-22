-- Prazo de desistência com devolução (padrão 3 dias; null = sem devolução) e desistência do aluno.
ALTER TABLE "Event" ADD COLUMN "prazoDesistenciaDias" INTEGER DEFAULT 3;
ALTER TABLE "EventRegistration" ADD COLUMN "desistenciaEm" TIMESTAMP(3);
