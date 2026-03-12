-- AlterTable: Add missing columns to services
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "requiredResourceType" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "requiresCertification" TEXT;

-- CreateTable: service_packages
CREATE TABLE IF NOT EXISTS "service_packages" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceId" TEXT,
    "totalSessions" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memberOnly" BOOLEAN NOT NULL DEFAULT false,
    "allowedMembershipTiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: package_purchases
CREATE TABLE IF NOT EXISTS "package_purchases" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "notes" TEXT,

    CONSTRAINT "package_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable: package_redemptions
CREATE TABLE IF NOT EXISTS "package_redemptions" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: staff_certifications
CREATE TABLE IF NOT EXISTS "staff_certifications" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recurring_classes
CREATE TABLE IF NOT EXISTS "recurring_classes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "resourceId" TEXT,
    "locationId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_packages_businessId_idx" ON "service_packages"("businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "package_purchases_customerId_idx" ON "package_purchases"("customerId");
CREATE INDEX IF NOT EXISTS "package_purchases_businessId_idx" ON "package_purchases"("businessId");
CREATE INDEX IF NOT EXISTS "package_purchases_status_idx" ON "package_purchases"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "package_purchases_paymentId_key" ON "package_purchases"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "package_redemptions_bookingId_key" ON "package_redemptions"("bookingId");
CREATE INDEX IF NOT EXISTS "package_redemptions_purchaseId_idx" ON "package_redemptions"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_certifications_staffId_name_key" ON "staff_certifications"("staffId", "name");
CREATE INDEX IF NOT EXISTS "staff_certifications_staffId_idx" ON "staff_certifications"("staffId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recurring_classes_businessId_idx" ON "recurring_classes"("businessId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_packages_businessId_fkey') THEN
    ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_packages_serviceId_fkey') THEN
    ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_purchases_packageId_fkey') THEN
    ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_purchases_customerId_fkey') THEN
    ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_purchases_businessId_fkey') THEN
    ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_purchases_paymentId_fkey') THEN
    ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_redemptions_purchaseId_fkey') THEN
    ALTER TABLE "package_redemptions" ADD CONSTRAINT "package_redemptions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "package_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_redemptions_bookingId_fkey') THEN
    ALTER TABLE "package_redemptions" ADD CONSTRAINT "package_redemptions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_certifications_staffId_fkey') THEN
    ALTER TABLE "staff_certifications" ADD CONSTRAINT "staff_certifications_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_classes_businessId_fkey') THEN
    ALTER TABLE "recurring_classes" ADD CONSTRAINT "recurring_classes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_classes_serviceId_fkey') THEN
    ALTER TABLE "recurring_classes" ADD CONSTRAINT "recurring_classes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_classes_staffId_fkey') THEN
    ALTER TABLE "recurring_classes" ADD CONSTRAINT "recurring_classes_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_classes_resourceId_fkey') THEN
    ALTER TABLE "recurring_classes" ADD CONSTRAINT "recurring_classes_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_classes_locationId_fkey') THEN
    ALTER TABLE "recurring_classes" ADD CONSTRAINT "recurring_classes_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
