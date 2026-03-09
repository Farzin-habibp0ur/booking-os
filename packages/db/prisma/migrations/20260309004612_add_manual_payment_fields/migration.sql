-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_bookingId_fkey";

-- AlterTable: add new columns (businessId nullable initially for backfill)
ALTER TABLE "payments" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'STRIPE',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "reference" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL,
ALTER COLUMN "stripePaymentIntentId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

-- Backfill businessId from related booking
UPDATE "payments" SET "businessId" = b."businessId"
FROM "bookings" b WHERE "payments"."bookingId" = b."id";

-- Now make businessId required
ALTER TABLE "payments" ALTER COLUMN "businessId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "payments_businessId_idx" ON "payments"("businessId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
