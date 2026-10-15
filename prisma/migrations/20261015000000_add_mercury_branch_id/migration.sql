-- Pedido do usuário 2026-10-15: id numérico da filial na API externa de
-- leitura "Mercury" (viaja como string no JSON, ex: "4").
ALTER TABLE "School" ADD COLUMN "mercuryBranchId" TEXT;
