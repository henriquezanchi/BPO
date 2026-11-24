-- O que foi feito no encontro (pedido do usuário 24/11/2026): texto livre da coordenação quando o encontro aconteceu
-- diferente do programado (outro texto, outra atividade). Aparece na divulgação do mês no lugar da descrição.
ALTER TABLE "GroupMeeting" ADD COLUMN "realizado" TEXT;
