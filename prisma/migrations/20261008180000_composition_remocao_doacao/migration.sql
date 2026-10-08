-- Pedido do usuário 2026-10-08: CompositionChangeRequest passa a cobrir
-- também remoção (tipo="remocao") de item lançado pela escola no Mercúrio.
ALTER TABLE "CompositionChangeRequest" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'inclusao';
ALTER TABLE "CompositionChangeRequest" ADD COLUMN "compositionItemId" TEXT;

ALTER TABLE "CompositionChangeRequest"
  ADD CONSTRAINT "CompositionChangeRequest_compositionItemId_fkey"
  FOREIGN KEY ("compositionItemId") REFERENCES "ContributionCompositionItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
