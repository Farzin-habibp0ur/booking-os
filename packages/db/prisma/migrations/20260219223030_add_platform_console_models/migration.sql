-- CreateTable
CREATE TABLE "view_as_sessions" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "targetBusinessId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "actionsLog" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_as_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "view_as_sessions_superAdminId_idx" ON "view_as_sessions"("superAdminId");

-- CreateIndex
CREATE INDEX "view_as_sessions_targetBusinessId_idx" ON "view_as_sessions"("targetBusinessId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_actorId_idx" ON "platform_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_action_idx" ON "platform_audit_logs"("action");

-- CreateIndex
CREATE INDEX "platform_audit_logs_targetId_idx" ON "platform_audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "view_as_sessions" ADD CONSTRAINT "view_as_sessions_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_as_sessions" ADD CONSTRAINT "view_as_sessions_targetBusinessId_fkey" FOREIGN KEY ("targetBusinessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
