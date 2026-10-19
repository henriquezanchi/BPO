ALTER TABLE "Event" ADD COLUMN "refundOnCancellation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventRegistration"
 ADD COLUMN "refundState" TEXT NOT NULL DEFAULT 'nao_solicitado',
 ADD COLUMN "refundSubmittedAt" TIMESTAMP(3),
 ADD COLUMN "refundCheckedAt" TIMESTAMP(3),
 ADD COLUMN "refundNextAttemptAt" TIMESTAMP(3),
 ADD COLUMN "refundLeaseUntil" TIMESTAMP(3),
 ADD COLUMN "refundLockId" TEXT,
 ADD COLUMN "refundAttempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "refundError" TEXT,
 ADD COLUMN "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
 ADD COLUMN "refundedAt" TIMESTAMP(3),
 ADD COLUMN "refundsSnapshot" JSONB NOT NULL DEFAULT '[]',
 ADD COLUMN "mercurioReceiptNo" TEXT,
 ADD COLUMN "mercurioRecordedAt" TIMESTAMP(3),
 ADD COLUMN "mercurioRecordedBy" TEXT;
CREATE INDEX "EventRegistration_refundNextAttemptAt_idx" ON "EventRegistration"("refundNextAttemptAt");
-- As tabelas existentes já têm RLS; preserva a proteção sem políticas públicas.
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventRegistration" ENABLE ROW LEVEL SECURITY;
