-- CreateTable
CREATE TABLE "platform_agent_defaults" (
    "id" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "maxAutonomyLevel" TEXT NOT NULL DEFAULT 'SUGGEST',
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "platform_agent_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_agent_defaults_agentType_key" ON "platform_agent_defaults"("agentType");
