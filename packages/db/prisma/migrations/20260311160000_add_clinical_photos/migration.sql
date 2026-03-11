-- CreateTable
CREATE TABLE "clinical_photos" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "bodyArea" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "notes" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_comparisons" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "beforePhotoId" TEXT NOT NULL,
    "afterPhotoId" TEXT NOT NULL,
    "bodyArea" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_photos_customerId_idx" ON "clinical_photos"("customerId");

-- CreateIndex
CREATE INDEX "clinical_photos_businessId_idx" ON "clinical_photos"("businessId");

-- CreateIndex
CREATE INDEX "clinical_photos_bookingId_idx" ON "clinical_photos"("bookingId");

-- CreateIndex
CREATE INDEX "photo_comparisons_customerId_idx" ON "photo_comparisons"("customerId");

-- AddForeignKey
ALTER TABLE "clinical_photos" ADD CONSTRAINT "clinical_photos_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_photos" ADD CONSTRAINT "clinical_photos_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_photos" ADD CONSTRAINT "clinical_photos_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_photos" ADD CONSTRAINT "clinical_photos_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_beforePhotoId_fkey" FOREIGN KEY ("beforePhotoId") REFERENCES "clinical_photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comparisons" ADD CONSTRAINT "photo_comparisons_afterPhotoId_fkey" FOREIGN KEY ("afterPhotoId") REFERENCES "clinical_photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
