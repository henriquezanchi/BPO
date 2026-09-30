ALTER TABLE "EventRegistration" ADD COLUMN "asaasCustomerId" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "asaasPaymentId" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "pixPayload" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "pixQrCodeBase64" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "EventRegistration_asaasPaymentId_key" ON "EventRegistration"("asaasPaymentId");
CREATE UNIQUE INDEX "EventRegistration_eventId_memberId_key" ON "EventRegistration"("eventId", "memberId");

ALTER TABLE "Member" ADD COLUMN "avatarPath" TEXT;
