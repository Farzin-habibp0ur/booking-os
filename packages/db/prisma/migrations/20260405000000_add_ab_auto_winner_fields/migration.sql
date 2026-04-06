-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "winnerMetric" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "testDurationMinutes" INTEGER;
ALTER TABLE "campaigns" ADD COLUMN "testAudiencePercent" INTEGER DEFAULT 20;
ALTER TABLE "campaigns" ADD COLUMN "testPhaseEndsAt" TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN "autoWinnerSelected" BOOLEAN NOT NULL DEFAULT false;
