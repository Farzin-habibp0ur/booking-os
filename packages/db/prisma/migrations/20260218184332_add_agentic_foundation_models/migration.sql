-- CreateTable
CREATE TABLE "action_cards" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "preview" JSONB,
    "ctaConfig" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "autonomyLevel" TEXT NOT NULL DEFAULT 'ASSISTED',
    "snoozedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "customerId" TEXT,
    "conversationId" TEXT,
    "staffId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_history" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT,
    "diff" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autonomy_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "autonomyLevel" TEXT NOT NULL DEFAULT 'ASSISTED',
    "requiredRole" TEXT,
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autonomy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_drafts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_cards_businessId_status_idx" ON "action_cards"("businessId", "status");

-- CreateIndex
CREATE INDEX "action_cards_businessId_category_status_idx" ON "action_cards"("businessId", "category", "status");

-- CreateIndex
CREATE INDEX "action_cards_businessId_staffId_status_idx" ON "action_cards"("businessId", "staffId", "status");

-- CreateIndex
CREATE INDEX "action_cards_businessId_type_status_idx" ON "action_cards"("businessId", "type", "status");

-- CreateIndex
CREATE INDEX "action_cards_expiresAt_idx" ON "action_cards"("expiresAt");

-- CreateIndex
CREATE INDEX "action_history_businessId_createdAt_idx" ON "action_history"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "action_history_businessId_entityType_entityId_idx" ON "action_history"("businessId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "action_history_businessId_actorId_idx" ON "action_history"("businessId", "actorId");

-- CreateIndex
CREATE INDEX "autonomy_configs_businessId_idx" ON "autonomy_configs"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "autonomy_configs_businessId_actionType_key" ON "autonomy_configs"("businessId", "actionType");

-- CreateIndex
CREATE INDEX "outbound_drafts_businessId_status_idx" ON "outbound_drafts"("businessId", "status");

-- CreateIndex
CREATE INDEX "outbound_drafts_businessId_customerId_idx" ON "outbound_drafts"("businessId", "customerId");

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_history" ADD CONSTRAINT "action_history_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autonomy_configs" ADD CONSTRAINT "autonomy_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_drafts" ADD CONSTRAINT "outbound_drafts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_drafts" ADD CONSTRAINT "outbound_drafts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_drafts" ADD CONSTRAINT "outbound_drafts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_drafts" ADD CONSTRAINT "outbound_drafts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_drafts" ADD CONSTRAINT "outbound_drafts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
