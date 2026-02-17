-- AlterTable
ALTER TABLE "calendar_connections" ADD COLUMN     "icalFeedTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "currentRedemptions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxRedemptions" INTEGER;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;
