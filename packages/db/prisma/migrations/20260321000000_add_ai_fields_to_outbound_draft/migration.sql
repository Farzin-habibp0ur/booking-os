-- AlterTable
ALTER TABLE "outbound_drafts" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "outbound_drafts" ADD COLUMN "sourceMessageId" TEXT;
ALTER TABLE "outbound_drafts" ADD COLUMN "intent" TEXT;
ALTER TABLE "outbound_drafts" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "outbound_drafts" ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "outbound_drafts_businessId_conversationId_status_idx" ON "outbound_drafts"("businessId", "conversationId", "status");
