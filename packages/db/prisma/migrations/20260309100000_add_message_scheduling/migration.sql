-- AlterTable
ALTER TABLE "messages" ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "scheduledJobId" TEXT;
