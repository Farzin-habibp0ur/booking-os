-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "triggerEvent" TEXT,
    "stopOnEvent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequence_enrollments" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "email_sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_sequences_businessId_idx" ON "email_sequences"("businessId");

-- CreateIndex
CREATE INDEX "email_sequences_type_idx" ON "email_sequences"("type");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_sequenceId_status_idx" ON "email_sequence_enrollments"("sequenceId", "status");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_businessId_idx" ON "email_sequence_enrollments"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequence_enrollments_sequenceId_businessId_email_key" ON "email_sequence_enrollments"("sequenceId", "businessId", "email");

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
