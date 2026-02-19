-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autonomyLevel" TEXT NOT NULL DEFAULT 'SUGGEST',
    "config" JSONB NOT NULL DEFAULT '{}',
    "roleVisibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "cardsCreated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_feedback" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actionCardId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_candidates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId1" TEXT NOT NULL,
    "customerId2" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_businessId_agentType_key" ON "agent_configs"("businessId", "agentType");

-- CreateIndex
CREATE INDEX "agent_configs_businessId_idx" ON "agent_configs"("businessId");

-- CreateIndex
CREATE INDEX "agent_runs_businessId_agentType_idx" ON "agent_runs"("businessId", "agentType");

-- CreateIndex
CREATE INDEX "agent_runs_businessId_startedAt_idx" ON "agent_runs"("businessId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_feedback_actionCardId_staffId_key" ON "agent_feedback"("actionCardId", "staffId");

-- CreateIndex
CREATE INDEX "agent_feedback_businessId_idx" ON "agent_feedback"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_candidates_businessId_customerId1_customerId2_key" ON "duplicate_candidates"("businessId", "customerId1", "customerId2");

-- CreateIndex
CREATE INDEX "duplicate_candidates_businessId_status_idx" ON "duplicate_candidates"("businessId", "status");

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_actionCardId_fkey" FOREIGN KEY ("actionCardId") REFERENCES "action_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_customerId1_fkey" FOREIGN KEY ("customerId1") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_customerId2_fkey" FOREIGN KEY ("customerId2") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
