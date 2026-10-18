-- Termo oficial (V220219): renovação a cada 5 anos e ao mudar de filial —
-- a mesma versão pode ser assinada mais de uma vez; guarda o texto assinado.
DROP INDEX IF EXISTS "VolunteerTermSignature_memberId_termVersion_key";
ALTER TABLE "VolunteerTermSignature" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "VolunteerTermSignature" ADD COLUMN "signedText" TEXT;
