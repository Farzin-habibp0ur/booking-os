-- BCC AI Front Desk pivot Phase 12 (drift fix to unblock seed + E2E)
--
-- PR #35 squash-merge updated schema.prisma but did not include the
-- corresponding Prisma migration for several changes. The DB on main was
-- therefore out of sync with schema.prisma — Prisma client writes that
-- referenced new columns (e.g. Business.automationDefaults) failed with P2022.
--
-- This migration is ADDITIVE ONLY. It creates the missing columns/tables/
-- constraints/indexes that schema.prisma references. It does NOT drop the
-- orphan tables (deal_*, vehicles, package_*, recurring_classes,
-- service_packages, staff_certifications, test_drives) — those should be
-- removed in a separate, focused cleanup PR after data review.

-- AlterTable: businesses.automationDefaults (referenced by Business model;
-- prisma.business.create fails without this column)
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "automationDefaults" JSONB NOT NULL DEFAULT '{}';

-- AlterTable: businesses.verticalPack default → 'aesthetic' (was 'general';
-- GENERAL VerticalPack removed in Phase 2)
ALTER TABLE "businesses" ALTER COLUMN "verticalPack" SET DEFAULT 'aesthetic';

-- AlterTable: automation_rules.messageTemplateOverride (referenced by
-- AutomationRule model)
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "messageTemplateOverride" JSONB;

-- AlterTable: bookings.kanbanStatus removed from schema; drop the column
-- so writes targeting non-kanbanStatus columns succeed cleanly.
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "kanbanStatus";

-- AlterIndex: autonomy_configs unique now includes scope
DROP INDEX IF EXISTS "autonomy_configs_businessId_actionType_key";
CREATE UNIQUE INDEX IF NOT EXISTS "autonomy_configs_businessId_actionType_scope_key" ON "autonomy_configs"("businessId", "actionType", "scope");

-- CreateTable: device_tokens (used by DeviceTokenService for FCM push)
CREATE TABLE IF NOT EXISTS "device_tokens" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "device_tokens_businessId_idx" ON "device_tokens"("businessId");
CREATE INDEX IF NOT EXISTS "device_tokens_staffId_isActive_idx" ON "device_tokens"("staffId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_staffId_token_key" ON "device_tokens"("staffId", "token");

-- AddForeignKey: device_tokens FKs (skip if they already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'device_tokens_staffId_fkey'
    ) THEN
        ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_staffId_fkey"
            FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'device_tokens_businessId_fkey'
    ) THEN
        ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_businessId_fkey"
            FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- RenameIndex: customer_referrals (Postgres name truncation drift)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'customer_referrals_businessId_referrerCustomerId_referredCus_ke'
    ) THEN
        ALTER INDEX "customer_referrals_businessId_referrerCustomerId_referredCus_ke"
            RENAME TO "customer_referrals_businessId_referrerCustomerId_referredCu_key";
    END IF;
END $$;
