-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "planChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_credits" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "stripeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_credits_businessId_idx" ON "billing_credits"("businessId");

-- CreateIndex
CREATE INDEX "billing_credits_issuedById_idx" ON "billing_credits"("issuedById");

-- AddForeignKey
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
