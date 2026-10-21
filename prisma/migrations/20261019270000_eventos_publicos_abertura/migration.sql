ALTER TABLE "Member" ADD COLUMN "nivel" TEXT,
  ADD COLUMN "isHD" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isDirigente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isFV" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "publicos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "abertoA" TEXT NOT NULL DEFAULT 'filial',
  ADD COLUMN "abertoValores" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "School" ADD COLUMN "uf" TEXT;

-- Público atual vira lista; públicos antigos mapeados para os novos.
UPDATE "Event" SET "publicos" = ARRAY[CASE "audience" WHEN 'voluntarios' THEN 'fv' WHEN 'direcao' THEN 'dirigentes' ELSE "audience" END];
UPDATE "School" SET "uf" = 'MT' WHERE "mercurioUnidade" = 'BGA';
UPDATE "School" SET "uf" = 'DF' WHERE "mercurioUnidade" IN ('BSB', 'LGS');
UPDATE "School" SET "uf" = 'GO' WHERE "mercurioUnidade" IN ('GAR', 'JAM', 'STO', 'GYN');
