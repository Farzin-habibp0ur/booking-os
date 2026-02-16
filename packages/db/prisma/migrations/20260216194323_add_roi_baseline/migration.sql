-- CreateTable
CREATE TABLE "roi_baselines" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "goLiveDate" TIMESTAMP(3) NOT NULL,
    "baselineStart" TIMESTAMP(3) NOT NULL,
    "baselineEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roi_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roi_baselines_businessId_idx" ON "roi_baselines"("businessId");

-- AddForeignKey
ALTER TABLE "roi_baselines" ADD CONSTRAINT "roi_baselines_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
