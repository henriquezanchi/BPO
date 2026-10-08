-- Pedido do usuário 2026-10-08: login automático (provisório) na Acrópole Play.
ALTER TABLE "Member" ADD COLUMN "acropolePlayEmail" TEXT;
ALTER TABLE "Member" ADD COLUMN "acropolePlaySenhaCifrada" TEXT;
