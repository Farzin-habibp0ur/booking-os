-- CreateTable
CREATE TABLE "content_drafts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "pillar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "agentId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_drafts_businessId_idx" ON "content_drafts"("businessId");

-- CreateIndex
CREATE INDEX "content_drafts_businessId_status_idx" ON "content_drafts"("businessId", "status");

-- AddForeignKey
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
