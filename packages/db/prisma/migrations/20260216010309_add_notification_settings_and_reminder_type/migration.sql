-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "notificationSettings" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'REMINDER';
