-- CreateEnum
CREATE TYPE "AgendaItemType" AS ENUM ('evento', 'atividade');

-- CreateTable
CREATE TABLE "AgendaReaction" (
    "id" TEXT NOT NULL,
    "itemType" "AgendaItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgendaReaction_itemType_itemId_idx" ON "AgendaReaction"("itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaReaction_itemType_itemId_memberId_emoji_key" ON "AgendaReaction"("itemType", "itemId", "memberId", "emoji");

-- AddForeignKey
ALTER TABLE "AgendaReaction" ADD CONSTRAINT "AgendaReaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
