-- Pedido do usuário 2026-10-08: grupos/perfil de programa dentro da filial,
-- pra limitar quais rubricas aparecem pra cada membro.
ALTER TABLE "Member" ADD COLUMN "isProvacionista" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "isMembroPrograma" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "isCirculoDeAmigos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "isCorrentinha" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "isTavolas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "isJanos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "perfilGruposSyncedAt" TIMESTAMP(3);
