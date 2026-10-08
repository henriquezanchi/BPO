-- Pedido do usuário 2026-10-08: crédito Fortuna recorrente + estado de nudge
-- de contribuição extra (fortuna/biblioteca/criança pelo bem).
ALTER TABLE "Member" ADD COLUMN "fortunaTopUpRecorrente" DECIMAL(10,2);

CREATE TABLE "MemberNudgeState" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "suggestionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemberNudgeState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberNudgeState_memberId_suggestionId_key" ON "MemberNudgeState"("memberId", "suggestionId");

ALTER TABLE "MemberNudgeState"
  ADD CONSTRAINT "MemberNudgeState_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
