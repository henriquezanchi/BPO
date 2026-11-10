-- Data de encerramento das rodadas da avaliação dos instrutores (pedido do usuário 10/11/2026). Só acrescenta uma coluna
-- opcional; rodadas existentes ficam sem data (encerram pelo botão, como antes).
-- Aplicar só com autorização do usuário, via `prisma db execute` + `prisma migrate resolve --applied` (nunca migrate deploy).

ALTER TABLE "AvaliacaoCampanha" ADD COLUMN "encerraEm" DATE;
