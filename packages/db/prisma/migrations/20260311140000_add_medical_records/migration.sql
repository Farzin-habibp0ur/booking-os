-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contraindications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "medications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skinType" TEXT,
    "fitzpatrickScale" TEXT,
    "bloodThinners" BOOLEAN NOT NULL DEFAULT false,
    "pregnant" BOOLEAN NOT NULL DEFAULT false,
    "breastfeeding" BOOLEAN NOT NULL DEFAULT false,
    "recentSurgery" TEXT,
    "notes" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medical_records_customerId_idx" ON "medical_records"("customerId");

-- CreateIndex
CREATE INDEX "medical_records_businessId_idx" ON "medical_records"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_customerId_version_key" ON "medical_records"("customerId", "version");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
