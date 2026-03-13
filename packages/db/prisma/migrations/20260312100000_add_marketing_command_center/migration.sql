-- AlterTable: autonomy_configs
ALTER TABLE "autonomy_configs" ADD COLUMN "scope" TEXT;

-- AlterTable: agent_configs
ALTER TABLE "agent_configs" ADD COLUMN "runIntervalMinutes" INTEGER;
ALTER TABLE "agent_configs" ADD COLUMN "lastRunAt" TIMESTAMP(3);
ALTER TABLE "agent_configs" ADD COLUMN "nextRunAt" TIMESTAMP(3);
ALTER TABLE "agent_configs" ADD COLUMN "performanceScore" DOUBLE PRECISION;

-- AlterTable: agent_runs
ALTER TABLE "agent_runs" ADD COLUMN "errors" JSONB;

-- AlterTable: content_drafts
ALTER TABLE "content_drafts" ADD COLUMN "tier" TEXT;
ALTER TABLE "content_drafts" ADD COLUMN "slug" TEXT;
ALTER TABLE "content_drafts" ADD COLUMN "qualityScore" INTEGER;
ALTER TABLE "content_drafts" ADD COLUMN "rejectionCode" TEXT;
ALTER TABLE "content_drafts" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "content_drafts" ADD COLUMN "currentGate" TEXT;
ALTER TABLE "content_drafts" ADD COLUMN "platform" TEXT;

-- AlterTable: email_sequences
ALTER TABLE "email_sequences" ADD COLUMN "metrics" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: ab_tests
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metric" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerVariantId" TEXT,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ab_test_variants
CREATE TABLE "ab_test_variants" (
    "id" TEXT NOT NULL,
    "abTestId" TEXT NOT NULL,
    "contentDraftId" TEXT,
    "variantLabel" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_test_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rejection_logs
CREATE TABLE "rejection_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "rejectionCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "agentId" TEXT,
    "reviewedById" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_configs
CREATE TABLE "platform_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'LOCKED',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "postingSchedule" JSONB NOT NULL DEFAULT '{}',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "unlockedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: budget_entries
CREATE TABLE "budget_entries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "period" TEXT NOT NULL,
    "month" INTEGER,
    "year" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: escalation_events
CREATE TABLE "escalation_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "agentId" TEXT,
    "contentDraftId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_drafts_businessId_tier_idx" ON "content_drafts"("businessId", "tier");
CREATE INDEX "content_drafts_businessId_currentGate_idx" ON "content_drafts"("businessId", "currentGate");

CREATE INDEX "ab_tests_businessId_idx" ON "ab_tests"("businessId");
CREATE INDEX "ab_tests_businessId_status_idx" ON "ab_tests"("businessId", "status");

CREATE INDEX "ab_test_variants_abTestId_idx" ON "ab_test_variants"("abTestId");

CREATE INDEX "rejection_logs_businessId_idx" ON "rejection_logs"("businessId");
CREATE INDEX "rejection_logs_businessId_contentDraftId_idx" ON "rejection_logs"("businessId", "contentDraftId");
CREATE INDEX "rejection_logs_businessId_gate_idx" ON "rejection_logs"("businessId", "gate");

CREATE INDEX "platform_configs_businessId_idx" ON "platform_configs"("businessId");
CREATE UNIQUE INDEX "platform_configs_businessId_platform_key" ON "platform_configs"("businessId", "platform");

CREATE INDEX "budget_entries_businessId_idx" ON "budget_entries"("businessId");
CREATE INDEX "budget_entries_businessId_category_idx" ON "budget_entries"("businessId", "category");

CREATE INDEX "escalation_events_businessId_idx" ON "escalation_events"("businessId");
CREATE INDEX "escalation_events_businessId_isResolved_idx" ON "escalation_events"("businessId", "isResolved");
CREATE INDEX "escalation_events_businessId_severity_idx" ON "escalation_events"("businessId", "severity");

-- AddForeignKey
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ab_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "content_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rejection_logs" ADD CONSTRAINT "rejection_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rejection_logs" ADD CONSTRAINT "rejection_logs_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "content_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rejection_logs" ADD CONSTRAINT "rejection_logs_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_configs" ADD CONSTRAINT "platform_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
