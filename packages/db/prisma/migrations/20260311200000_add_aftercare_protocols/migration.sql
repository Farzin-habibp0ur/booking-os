-- CreateTable
CREATE TABLE "aftercare_protocols" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aftercare_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftercare_steps" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "aftercare_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftercare_enrollments" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "aftercare_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftercare_messages" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "messageId" TEXT,

    CONSTRAINT "aftercare_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aftercare_protocols_businessId_idx" ON "aftercare_protocols"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "aftercare_protocols_businessId_serviceId_key" ON "aftercare_protocols"("businessId", "serviceId");

-- CreateIndex
CREATE INDEX "aftercare_steps_protocolId_idx" ON "aftercare_steps"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "aftercare_enrollments_bookingId_key" ON "aftercare_enrollments"("bookingId");

-- CreateIndex
CREATE INDEX "aftercare_enrollments_customerId_idx" ON "aftercare_enrollments"("customerId");

-- CreateIndex
CREATE INDEX "aftercare_messages_enrollmentId_idx" ON "aftercare_messages"("enrollmentId");

-- CreateIndex
CREATE INDEX "aftercare_messages_status_scheduledFor_idx" ON "aftercare_messages"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "aftercare_protocols" ADD CONSTRAINT "aftercare_protocols_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_protocols" ADD CONSTRAINT "aftercare_protocols_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_steps" ADD CONSTRAINT "aftercare_steps_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "aftercare_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_enrollments" ADD CONSTRAINT "aftercare_enrollments_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "aftercare_protocols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_enrollments" ADD CONSTRAINT "aftercare_enrollments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_enrollments" ADD CONSTRAINT "aftercare_enrollments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftercare_messages" ADD CONSTRAINT "aftercare_messages_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "aftercare_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
