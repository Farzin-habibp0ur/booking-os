-- AlterTable: Remove referralCode from businesses
ALTER TABLE "businesses" DROP COLUMN IF EXISTS "referralCode";

-- AlterTable: Add referralCode to customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

-- CreateIndex (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "customers_referralCode_key" ON "customers"("referralCode");

-- DropTable (old B2B referrals)
DROP TABLE IF EXISTS "referrals";

-- CreateTable: customer_referrals
CREATE TABLE IF NOT EXISTS "customer_referrals" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referredCustomerId" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "referrerCreditAmount" DOUBLE PRECISION NOT NULL,
    "refereeCreditAmount" DOUBLE PRECISION NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_credits
CREATE TABLE IF NOT EXISTS "customer_credits" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "referralId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: credit_redemptions
CREATE TABLE IF NOT EXISTS "credit_redemptions" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: customer_referrals
CREATE UNIQUE INDEX IF NOT EXISTS "customer_referrals_bookingId_key" ON "customer_referrals"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_referrals_businessId_referrerCustomerId_referredCus_key" ON "customer_referrals"("businessId", "referrerCustomerId", "referredCustomerId");
CREATE INDEX IF NOT EXISTS "customer_referrals_businessId_idx" ON "customer_referrals"("businessId");
CREATE INDEX IF NOT EXISTS "customer_referrals_referrerCustomerId_idx" ON "customer_referrals"("referrerCustomerId");
CREATE INDEX IF NOT EXISTS "customer_referrals_referredCustomerId_idx" ON "customer_referrals"("referredCustomerId");
CREATE INDEX IF NOT EXISTS "customer_referrals_referralCode_idx" ON "customer_referrals"("referralCode");
CREATE INDEX IF NOT EXISTS "customer_referrals_businessId_status_idx" ON "customer_referrals"("businessId", "status");

-- CreateIndex: customer_credits
CREATE INDEX IF NOT EXISTS "customer_credits_businessId_customerId_idx" ON "customer_credits"("businessId", "customerId");
CREATE INDEX IF NOT EXISTS "customer_credits_customerId_source_idx" ON "customer_credits"("customerId", "source");
CREATE INDEX IF NOT EXISTS "customer_credits_expiresAt_idx" ON "customer_credits"("expiresAt");

-- CreateIndex: credit_redemptions
CREATE INDEX IF NOT EXISTS "credit_redemptions_creditId_idx" ON "credit_redemptions"("creditId");
CREATE INDEX IF NOT EXISTS "credit_redemptions_bookingId_idx" ON "credit_redemptions"("bookingId");

-- AddForeignKey: customer_referrals
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referredCustomerId_fkey" FOREIGN KEY ("referredCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: customer_credits
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "customer_referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: credit_redemptions
ALTER TABLE "credit_redemptions" ADD CONSTRAINT "credit_redemptions_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "customer_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_redemptions" ADD CONSTRAINT "credit_redemptions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
