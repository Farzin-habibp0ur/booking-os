-- Phase 1: Campaign unsubscribe tracking

CREATE TABLE "campaign_unsubscribes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_unsubscribes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_unsubscribes_token_key" ON "campaign_unsubscribes"("token");
CREATE UNIQUE INDEX "campaign_unsubscribes_businessId_customerId_campaignId_key" ON "campaign_unsubscribes"("businessId", "customerId", "campaignId");
CREATE INDEX "campaign_unsubscribes_businessId_customerId_idx" ON "campaign_unsubscribes"("businessId", "customerId");
CREATE INDEX "campaign_unsubscribes_token_idx" ON "campaign_unsubscribes"("token");

ALTER TABLE "campaign_unsubscribes" ADD CONSTRAINT "campaign_unsubscribes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_unsubscribes" ADD CONSTRAINT "campaign_unsubscribes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_unsubscribes" ADD CONSTRAINT "campaign_unsubscribes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
