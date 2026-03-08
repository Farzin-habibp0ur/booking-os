-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "plan" SET DEFAULT 'starter';
