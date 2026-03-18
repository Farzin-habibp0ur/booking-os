-- AlterTable: Add Instagram fields to Customer and Location
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "instagramUserId" TEXT;

-- CreateIndex: Unique index on (businessId, instagramUserId) for Customer
CREATE UNIQUE INDEX IF NOT EXISTS "customers_businessId_instagramUserId_key" ON "customers"("businessId", "instagramUserId");

-- AlterTable: Add Instagram config to Location
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "instagramConfig" JSONB;
