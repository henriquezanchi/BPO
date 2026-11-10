-- Sugestões com subcategoria, assunto curto e contexto (turma ou evento escolhido) — pedido do usuário 10/11/2026.
-- Só acrescenta colunas opcionais; as sugestões já enviadas continuam como estão.
-- Aplicar só com autorização do usuário, via `prisma db execute` + `prisma migrate resolve --applied` (nunca migrate deploy).

ALTER TABLE "SugestaoPortal" ADD COLUMN "subcategoria" TEXT;
ALTER TABLE "SugestaoPortal" ADD COLUMN "titulo" TEXT;
ALTER TABLE "SugestaoPortal" ADD COLUMN "contexto" JSONB;
