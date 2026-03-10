-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "colorLabel" TEXT;

-- AlterTable
ALTER TABLE "campaign_sends" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "isABTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variants" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "winnerSelectedAt" TIMESTAMP(3),
ADD COLUMN     "winnerVariantId" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "backupCodes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "automation_steps" (
    "id" TEXT NOT NULL,
    "automationRuleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "parentStepId" TEXT,
    "branchLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL,
    "automationRuleId" TEXT NOT NULL,
    "stepId" TEXT,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "bookingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_segments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_audit_logs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_steps_automationRuleId_order_idx" ON "automation_steps"("automationRuleId", "order");

-- CreateIndex
CREATE INDEX "automation_executions_automationRuleId_status_idx" ON "automation_executions"("automationRuleId", "status");

-- CreateIndex
CREATE INDEX "automation_executions_status_scheduledAt_idx" ON "automation_executions"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "saved_segments_businessId_idx" ON "saved_segments"("businessId");

-- CreateIndex
CREATE INDEX "booking_audit_logs_bookingId_idx" ON "booking_audit_logs"("bookingId");

-- CreateIndex
CREATE INDEX "booking_audit_logs_businessId_createdAt_idx" ON "booking_audit_logs"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_parentStepId_fkey" FOREIGN KEY ("parentStepId") REFERENCES "automation_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "automation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "automation_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_segments" ADD CONSTRAINT "saved_segments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
