-- Eventos públicos do Ulisses importados pela API pública (sem credencial).
ALTER TABLE "School" ADD COLUMN "ulissesFilialId" INTEGER;
CREATE UNIQUE INDEX "School_ulissesFilialId_key" ON "School"("ulissesFilialId");
ALTER TABLE "Event" ADD COLUMN "imageUrl" TEXT;

-- Filiais conferidas em 19/10/2026 pelo código de cada filial no catálogo
-- público (api.acropolebrasil.com.br/eventos/{id} -> codigoEscola).
UPDATE "School" SET "ulissesFilialId" = 44  WHERE "mercurioUnidade" = 'BGA'; -- bdg, Barra do Garças/MT
UPDATE "School" SET "ulissesFilialId" = 7   WHERE "mercurioUnidade" = 'BSB'; -- bsb, Distrito Federal - Lago Norte
UPDATE "School" SET "ulissesFilialId" = 14  WHERE "mercurioUnidade" = 'GAR'; -- gga, Goiás - Garavelo
UPDATE "School" SET "ulissesFilialId" = 15  WHERE "mercurioUnidade" = 'JAM'; -- jam, Goiás - Goiânia
UPDATE "School" SET "ulissesFilialId" = 132 WHERE "mercurioUnidade" = 'STO'; -- gso, Goiânia - Setor Oeste
UPDATE "School" SET "ulissesFilialId" = 16  WHERE "mercurioUnidade" = 'GYN'; -- gyn, Goiás - Setor Universitário
UPDATE "School" SET "ulissesFilialId" = 8   WHERE "mercurioUnidade" = 'LGS'; -- lgs, Distrito Federal - Lago Sul
