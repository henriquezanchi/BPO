-- AlterTable
ALTER TABLE "GroupMeeting" ADD COLUMN     "seriesSlot" TEXT;

-- CreateTable
CREATE TABLE "GroupMeetingSeries" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "startsLocal" TEXT NOT NULL,
    "endsLocal" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "untilSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMeetingSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMeetingSeries_classGroupId_idx" ON "GroupMeetingSeries"("classGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMeeting_seriesId_seriesSlot_key" ON "GroupMeeting"("seriesId", "seriesSlot");

-- AddForeignKey
ALTER TABLE "GroupMeetingSeries" ADD CONSTRAINT "GroupMeetingSeries_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMeetingSeries" ADD CONSTRAINT "GroupMeetingSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "GroupMeetingSeries" ENABLE ROW LEVEL SECURITY;
-- Compatibilidade com séries finitas registradas na versão anterior.
INSERT INTO "GroupMeetingSeries" (id,"classGroupId","createdById","startsLocal","endsLocal","timeZone",template,"untilSlot")
SELECT DISTINCT ON (m."seriesId") m."seriesId",m."classGroupId",m."createdById",
 to_char(m."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE m."timeZone",'YYYY-MM-DD"T"HH24:MI'),
 to_char(m."endsAt" AT TIME ZONE 'UTC' AT TIME ZONE m."timeZone",'YYYY-MM-DD"T"HH24:MI'),m."timeZone",
 jsonb_build_object('title',m.title,'publicDetails',m."publicDetails",'internalDetails',m."internalDetails",'fullUniform',m."fullUniform"),
 CASE WHEN EXISTS (SELECT 1 FROM "GroupMeeting" x WHERE x."seriesId"=m."seriesId" AND x.status='agendada') THEN NULL ELSE to_char(m."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE m."timeZone",'YYYY-MM-DD"T"HH24:MI') END
FROM "GroupMeeting" m WHERE m."seriesId" IS NOT NULL ORDER BY m."seriesId",m."startsAt";
UPDATE "GroupMeeting" m SET "seriesSlot"=to_char(m."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE m."timeZone",'YYYY-MM-DD"T"HH24:MI') WHERE m."seriesId" IS NOT NULL AND m."seriesSlot" IS NULL;
