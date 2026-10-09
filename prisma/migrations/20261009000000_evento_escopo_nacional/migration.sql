-- Pedido do usuário 2026-10-09: evento nacional/regional, importado do
-- Google Calendar da Diretoria — schoolId deixa de ser obrigatório.
ALTER TABLE "Event" ALTER COLUMN "schoolId" DROP NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "price" SET DEFAULT 0;

ALTER TABLE "Event" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'filial';
ALTER TABLE "Event" ADD COLUMN "description" TEXT;
ALTER TABLE "Event" ADD COLUMN "location" TEXT;
ALTER TABLE "Event" ADD COLUMN "endsAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Event" ADD COLUMN "externalUid" TEXT;

CREATE UNIQUE INDEX "Event_externalUid_key" ON "Event"("externalUid");
CREATE INDEX "Event_scope_idx" ON "Event"("scope");
