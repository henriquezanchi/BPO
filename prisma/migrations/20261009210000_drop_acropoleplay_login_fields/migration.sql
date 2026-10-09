-- Pedido do usuário 2026-10-09: login automático na Acrópole Play nunca
-- funcionou de verdade (proteção CSRF real do lado deles, impossível de
-- contornar só com JS cross-origin) — removido o armazenamento de
-- e-mail/senha de terceiro que só existia pra sustentar essa tentativa.
ALTER TABLE "Member" DROP COLUMN "acropolePlayEmail";
ALTER TABLE "Member" DROP COLUMN "acropolePlaySenhaCifrada";
