CREATE TABLE "MemberIntegrationCourse" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "dateBR" TEXT NOT NULL,
    "courseDate" TIMESTAMP(3),
    "instructor" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberIntegrationCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberIntegrationCourse_memberId_courseName_dateBR_key" ON "MemberIntegrationCourse"("memberId", "courseName", "dateBR");
CREATE INDEX "MemberIntegrationCourse_memberId_idx" ON "MemberIntegrationCourse"("memberId");

ALTER TABLE "MemberIntegrationCourse" ADD CONSTRAINT "MemberIntegrationCourse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
