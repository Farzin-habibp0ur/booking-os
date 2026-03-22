-- AlterTable
ALTER TABLE "outbound_drafts" ADD COLUMN "subject" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "outbound_drafts_conversationId_channel_staffId_key" ON "outbound_drafts"("conversationId", "channel", "staffId");
