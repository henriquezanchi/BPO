ALTER TABLE "School" ADD COLUMN "mercurioEscrita" BOOLEAN NOT NULL DEFAULT false;
-- Única filial com escrita no Mercúrio liberada em 19/10/2026.
UPDATE "School" SET "mercurioEscrita" = true WHERE "mercurioUnidade" = 'BGA';
