-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "brandFaviconUrl" TEXT,
ADD COLUMN     "brandPrimaryColor" TEXT DEFAULT '#71907C',
ADD COLUMN     "brandTagline" TEXT,
ADD COLUMN     "logoUrl" TEXT;

-- CreateIndex
CREATE INDEX "bookings_businessId_startTime_status_idx" ON "bookings"("businessId", "startTime", "status");
