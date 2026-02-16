-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "bookingId" TEXT;

-- CreateIndex
CREATE INDEX "tokens_bookingId_type_idx" ON "tokens"("bookingId", "type");
