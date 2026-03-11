-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stockNumber" TEXT NOT NULL,
    "vin" TEXT,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "color" TEXT,
    "mileage" INTEGER,
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "askingPrice" DECIMAL(10,2),
    "costPrice" DECIMAL(10,2),
    "description" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locationId" TEXT,
    "addedById" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_drives" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "staffId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "feedback" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_drives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "vehicles_businessId_idx" ON "vehicles"("businessId");

-- CreateIndex
CREATE INDEX "vehicles_businessId_status_idx" ON "vehicles"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_businessId_stockNumber_key" ON "vehicles"("businessId", "stockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "test_drives_bookingId_key" ON "test_drives"("bookingId");

-- CreateIndex
CREATE INDEX "test_drives_vehicleId_idx" ON "test_drives"("vehicleId");

-- CreateIndex
CREATE INDEX "test_drives_customerId_idx" ON "test_drives"("customerId");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_drives" ADD CONSTRAINT "test_drives_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_drives" ADD CONSTRAINT "test_drives_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_drives" ADD CONSTRAINT "test_drives_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_drives" ADD CONSTRAINT "test_drives_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
