-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "referralCode" TEXT;

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerBusinessId" TEXT NOT NULL,
    "referredBusinessId" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_referralCode_key" ON "businesses"("referralCode");

-- CreateIndex
CREATE INDEX "referrals_referrerBusinessId_idx" ON "referrals"("referrerBusinessId");

-- CreateIndex
CREATE INDEX "referrals_referredBusinessId_idx" ON "referrals"("referredBusinessId");

-- CreateIndex
CREATE INDEX "referrals_referralCode_idx" ON "referrals"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrerBusinessId_referredBusinessId_key" ON "referrals"("referrerBusinessId", "referredBusinessId");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerBusinessId_fkey" FOREIGN KEY ("referrerBusinessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredBusinessId_fkey" FOREIGN KEY ("referredBusinessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
