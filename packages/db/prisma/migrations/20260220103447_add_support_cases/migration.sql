-- CreateTable
CREATE TABLE "support_cases" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "category" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_case_notes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_cases_businessId_idx" ON "support_cases"("businessId");

-- CreateIndex
CREATE INDEX "support_cases_status_idx" ON "support_cases"("status");

-- CreateIndex
CREATE INDEX "support_cases_createdAt_idx" ON "support_cases"("createdAt");

-- CreateIndex
CREATE INDEX "support_case_notes_caseId_idx" ON "support_case_notes"("caseId");

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_case_notes" ADD CONSTRAINT "support_case_notes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
