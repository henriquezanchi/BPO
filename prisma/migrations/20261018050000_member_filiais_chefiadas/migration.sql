-- Filiais (mercurioUnidade) em que a pessoa é Chefe de Filial (unidades.uni_diretor) — pode ser mais de uma e não só a da própria matrícula.
ALTER TABLE "Member" ADD COLUMN "filiaisChefiadas" TEXT[] DEFAULT ARRAY[]::TEXT[];
