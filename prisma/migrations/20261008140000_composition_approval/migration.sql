CREATE TABLE "CompositionChangeRequest" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mercurioGroupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompositionChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompositionChangeRequest_memberId_idx" ON "CompositionChangeRequest"("memberId");

ALTER TABLE "CompositionChangeRequest" ADD CONSTRAINT "CompositionChangeRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
