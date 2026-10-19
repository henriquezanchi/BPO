-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "contactInfo" TEXT,
ADD COLUMN     "participantInstructions" TEXT,
ADD COLUMN     "posterPath" TEXT,
ADD COLUMN     "registrationClosesAt" TIMESTAMP(3);


ALTER TABLE "Event" ADD CONSTRAINT "Event_capacity_valid" CHECK (capacity IS NULL OR (capacity>=1 AND capacity<=100000));
ALTER TABLE "Event" ADD CONSTRAINT "Event_registration_deadline_valid" CHECK ("registrationClosesAt" IS NULL OR "registrationClosesAt"<="startsAt");
