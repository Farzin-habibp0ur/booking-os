-- AlterTable: Add omnichannel fields to customers
ALTER TABLE "customers" ADD COLUMN "facebookPsid" TEXT;
ALTER TABLE "customers" ADD COLUMN "webChatSessionId" TEXT;

-- AlterTable: Add channel to messages (denormalized from conversation)
ALTER TABLE "messages" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WHATSAPP';

-- AlterTable: Add channel configs to locations
ALTER TABLE "locations" ADD COLUMN "facebookConfig" JSONB;
ALTER TABLE "locations" ADD COLUMN "smsConfig" JSONB;
ALTER TABLE "locations" ADD COLUMN "emailConfig" JSONB;
ALTER TABLE "locations" ADD COLUMN "webChatConfig" JSONB;

-- AlterTable: Add channelSettings to businesses
ALTER TABLE "businesses" ADD COLUMN "channelSettings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: MessageUsage for billing tracking
CREATE TABLE "message_usage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "message_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_usage_businessId_idx" ON "message_usage"("businessId");
CREATE INDEX "message_usage_businessId_date_idx" ON "message_usage"("businessId", "date");
CREATE UNIQUE INDEX "message_usage_businessId_channel_direction_date_key" ON "message_usage"("businessId", "channel", "direction", "date");

-- CreateIndex: Unique constraints for new customer identifiers
CREATE UNIQUE INDEX "customers_businessId_facebookPsid_key" ON "customers"("businessId", "facebookPsid");
CREATE UNIQUE INDEX "customers_businessId_webChatSessionId_key" ON "customers"("businessId", "webChatSessionId");

-- AddForeignKey
ALTER TABLE "message_usage" ADD CONSTRAINT "message_usage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: Set message.channel from conversation.channel for existing messages
UPDATE "messages" SET "channel" = c."channel"
FROM "conversations" c
WHERE "messages"."conversationId" = c."id";
