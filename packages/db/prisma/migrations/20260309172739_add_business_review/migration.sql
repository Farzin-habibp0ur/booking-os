-- CreateTable
CREATE TABLE "business_reviews" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_reviews_businessId_idx" ON "business_reviews"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_reviews_businessId_month_key" ON "business_reviews"("businessId", "month");

-- AddForeignKey
ALTER TABLE "business_reviews" ADD CONSTRAINT "business_reviews_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
