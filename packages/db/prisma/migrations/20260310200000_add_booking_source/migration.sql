-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "bookings_businessId_source_idx" ON "bookings"("businessId", "source");
