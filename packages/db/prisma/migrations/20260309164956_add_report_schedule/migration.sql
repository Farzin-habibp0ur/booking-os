-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "requestedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "recipients" TEXT[],
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "hour" INTEGER NOT NULL DEFAULT 9,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "testimonials_businessId_idx" ON "testimonials"("businessId");

-- CreateIndex
CREATE INDEX "testimonials_businessId_status_idx" ON "testimonials"("businessId", "status");

-- CreateIndex
CREATE INDEX "report_schedules_businessId_idx" ON "report_schedules"("businessId");

-- CreateIndex
CREATE INDEX "report_schedules_isActive_frequency_idx" ON "report_schedules"("isActive", "frequency");

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
