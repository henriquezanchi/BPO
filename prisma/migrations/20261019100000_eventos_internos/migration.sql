-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'todos_ativos',
ADD COLUMN     "registrationUrl" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'publicado';

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "amount" DECIMAL(10,2),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInBy" TEXT,
ADD COLUMN     "mercurioStatus" TEXT NOT NULL DEFAULT 'aguardando_integracao',
ADD COLUMN     "paymentState" TEXT NOT NULL DEFAULT 'novo',
ADD COLUMN     "selfReportedAt" TIMESTAMP(3),
ADD COLUMN     "selfReportedAttendance" TEXT;

-- CreateTable
CREATE TABLE "EventReception" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "EventReception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAudit" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventNotice" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aguardando_canal',
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EventNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventReception_memberId_idx" ON "EventReception"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "EventReception_eventId_memberId_key" ON "EventReception"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "EventAudit_eventId_createdAt_idx" ON "EventAudit"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventNotice_status_dueAt_idx" ON "EventNotice"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventNotice_registrationId_kind_key" ON "EventNotice"("registrationId", "kind");

-- AddForeignKey
ALTER TABLE "EventReception" ADD CONSTRAINT "EventReception_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAudit" ADD CONSTRAINT "EventAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventNotice" ADD CONSTRAINT "EventNotice_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "EventReception" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventNotice" ENABLE ROW LEVEL SECURITY;
UPDATE "EventRegistration" r SET amount=e.price,"paymentState"=CASE WHEN r.paid THEN CASE WHEN e.price=0 THEN 'gratuito' ELSE 'pago' END WHEN r."asaasPaymentId" IS NOT NULL THEN 'pendente' ELSE 'novo' END FROM "Event" e WHERE r."eventId"=e.id;

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventRegistration" ENABLE ROW LEVEL SECURITY;
