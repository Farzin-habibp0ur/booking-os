-- BCC AI Front Desk pivot Phase 1: baseline + v3 attribution + practiceType
-- Per BCC-PIVOT-MASTER-PLAN.md (v3) Phase 1.

-- AlterTable: Business gets clinic-level open hours and pre-pilot baseline metrics
ALTER TABLE "businesses"
  ADD COLUMN "businessHours" JSONB,
  ADD COLUMN "baselineMonthlyBookings" INTEGER,
  ADD COLUMN "baselineMonthlyRevenue" DECIMAL(12, 2),
  ADD COLUMN "baselineCapturedAt" TIMESTAMP(3),
  ADD COLUMN "baselineSource" TEXT DEFAULT 'concierge_call';

-- AlterTable: FrontDeskAttribution gets v3 two-metric dashboard fields
ALTER TABLE "front_desk_attributions"
  ADD COLUMN "attributionReason" TEXT,
  ADD COLUMN "wouldHaveBeenMissed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "revenueAtBooking" DECIMAL(10, 2);

-- AlterTable: PilotApplication gets practiceType for year-1 MED_SPA gating
ALTER TABLE "pilot_applications"
  ADD COLUMN "practiceType" TEXT;

-- DropIndex: standalone bookingId index becomes redundant once @unique creates one
DROP INDEX "front_desk_attributions_bookingId_idx";

-- CreateIndex: bookingId is now unique (one v3 attribution row per booking)
CREATE UNIQUE INDEX "front_desk_attributions_bookingId_key" ON "front_desk_attributions"("bookingId");

-- CreateIndex: dashboard query patterns
CREATE INDEX "front_desk_attributions_businessId_attributionReason_idx" ON "front_desk_attributions"("businessId", "attributionReason");
CREATE INDEX "front_desk_attributions_businessId_wouldHaveBeenMissed_void_idx" ON "front_desk_attributions"("businessId", "wouldHaveBeenMissed", "voidedAt");
