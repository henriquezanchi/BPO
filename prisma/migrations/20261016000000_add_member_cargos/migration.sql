-- Cargos de voluntário vindos da Mercury API (/branches/{id}/staff).
ALTER TABLE "Member" ADD COLUMN "cargos" TEXT[] DEFAULT ARRAY[]::TEXT[];
