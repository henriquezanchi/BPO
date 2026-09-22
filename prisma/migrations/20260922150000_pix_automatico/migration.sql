-- Pix Automático (Asaas) — débito recorrente de verdade, autorizado 1x pelo aluno.
ALTER TABLE "Member" ADD COLUMN "asaasCustomerId" TEXT;
ALTER TABLE "Member" ADD COLUMN "pixAutomaticAuthorizationId" TEXT;
ALTER TABLE "Member" ADD COLUMN "pixAutomaticStatus" TEXT;
ALTER TABLE "Member" ADD COLUMN "pixAutomaticActivatedAt" TIMESTAMP(3);

ALTER TABLE "PaymentCharge" ADD COLUMN "autoDebito" BOOLEAN NOT NULL DEFAULT false;
