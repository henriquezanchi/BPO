-- CreateTable
CREATE TABLE "GroupMeeting" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "publicDetails" TEXT NOT NULL DEFAULT '',
    "internalDetails" TEXT NOT NULL DEFAULT '',
    "fullUniform" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMeetingResponse" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "justification" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMeetingResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMeetingAudit" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMeetingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMeeting_classGroupId_startsAt_idx" ON "GroupMeeting"("classGroupId", "startsAt");

-- CreateIndex
CREATE INDEX "GroupMeeting_seriesId_startsAt_idx" ON "GroupMeeting"("seriesId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMeetingResponse_meetingId_memberId_key" ON "GroupMeetingResponse"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "GroupMeetingAudit_meetingId_createdAt_idx" ON "GroupMeetingAudit"("meetingId", "createdAt");

-- AddForeignKey
ALTER TABLE "GroupMeeting" ADD CONSTRAINT "GroupMeeting_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMeeting" ADD CONSTRAINT "GroupMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMeetingResponse" ADD CONSTRAINT "GroupMeetingResponse_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GroupMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMeetingResponse" ADD CONSTRAINT "GroupMeetingResponse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMeetingAudit" ADD CONSTRAINT "GroupMeetingAudit_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GroupMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMeetingAudit" ADD CONSTRAINT "GroupMeetingAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Sem leitura/escrita direta pela API pública; o Portal valida o usuário no servidor.
ALTER TABLE "GroupMeeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMeetingResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMeetingAudit" ENABLE ROW LEVEL SECURITY;
