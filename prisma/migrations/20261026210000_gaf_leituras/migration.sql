-- Leituras do GAF (pedido do usuário 2026-10-26): texto escolhido pela coordenação para o encontro (código do
-- cronograma, ex. "teseu-05", ou "nenhuma"). Nulo = automático (sequência). Aditiva; a tabela já tem RLS.
ALTER TABLE "GroupMeeting" ADD COLUMN "leituraGaf" TEXT;
