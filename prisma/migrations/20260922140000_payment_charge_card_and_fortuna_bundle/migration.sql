-- Cartão de crédito como método alternativo ao PIX, e recarga Fortuna
-- combinada na mesma cobrança da contribuição.
ALTER TABLE "PaymentCharge" ADD COLUMN "billingType" TEXT NOT NULL DEFAULT 'PIX';
ALTER TABLE "PaymentCharge" ADD COLUMN "invoiceUrl" TEXT;
ALTER TABLE "PaymentCharge" ADD COLUMN "cardSurcharge" DECIMAL(10,2);
ALTER TABLE "PaymentCharge" ADD COLUMN "fortunaTopUpAmount" DECIMAL(10,2);
ALTER TABLE "PaymentCharge" ADD COLUMN "fortunaTopUpLaunchedAt" TIMESTAMP(3);
ALTER TABLE "PaymentCharge" ADD COLUMN "fortunaTopUpError" TEXT;
