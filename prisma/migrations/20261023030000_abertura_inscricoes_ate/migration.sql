ALTER TABLE "AberturaTurma" ADD COLUMN "inscricoesAte" TIMESTAMP(3);
ALTER TABLE "AberturaTurma" ADD CONSTRAINT "AberturaTurma_inscricoesAte_check" CHECK ("inscricoesAte" IS NULL OR "inscricoesAte" >= "primeiraAula");
