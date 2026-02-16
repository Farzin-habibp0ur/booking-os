-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "policySettings" JSONB NOT NULL DEFAULT '{}';
