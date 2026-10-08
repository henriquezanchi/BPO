-- Pedido do usuário 2026-10-08: snapshot do status do membro na hora da
-- cobrança, pra calcular "reversão de inadimplência" (ver
-- getCrescimentoContribuicoes em economia-actions.ts).
ALTER TABLE "PaymentCharge" ADD COLUMN "memberWasOverdue" BOOLEAN NOT NULL DEFAULT false;
