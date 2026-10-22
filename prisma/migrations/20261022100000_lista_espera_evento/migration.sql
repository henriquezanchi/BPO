-- Lista de espera de eventos lotados.
CREATE TABLE "EventWaitlist" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avisadoEm" TIMESTAMP(3),
    CONSTRAINT "EventWaitlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventWaitlist_eventId_memberId_key" ON "EventWaitlist"("eventId", "memberId");
CREATE INDEX "EventWaitlist_eventId_createdAt_idx" ON "EventWaitlist"("eventId", "createdAt");

-- Regra do projeto: toda tabela nova com RLS.
ALTER TABLE "EventWaitlist" ENABLE ROW LEVEL SECURITY;
