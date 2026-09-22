CREATE TABLE "ErrorNotification" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErrorNotification_fingerprint_key" ON "ErrorNotification"("fingerprint");
