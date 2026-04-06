-- AlterTable
ALTER TABLE "campaign_sends" ADD COLUMN "openedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "campaign_clicks" (
    "id" TEXT NOT NULL,
    "campaignSendId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "campaign_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_clicks_campaignSendId_idx" ON "campaign_clicks"("campaignSendId");

-- AddForeignKey
ALTER TABLE "campaign_clicks" ADD CONSTRAINT "campaign_clicks_campaignSendId_fkey" FOREIGN KEY ("campaignSendId") REFERENCES "campaign_sends"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
