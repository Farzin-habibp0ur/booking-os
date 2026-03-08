-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "recurrenceRule" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "campaigns" ADD COLUMN "nextRunAt" TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN "parentCampaignId" TEXT;

-- CreateIndex
CREATE INDEX "campaigns_parentCampaignId_idx" ON "campaigns"("parentCampaignId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
