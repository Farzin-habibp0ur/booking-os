-- CreateTable
CREATE TABLE "staff_service_prices" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_service_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_service_prices_businessId_idx" ON "staff_service_prices"("businessId");

-- CreateIndex
CREATE INDEX "staff_service_prices_staffId_idx" ON "staff_service_prices"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_service_prices_staffId_serviceId_key" ON "staff_service_prices"("staffId", "serviceId");

-- AddForeignKey
ALTER TABLE "staff_service_prices" ADD CONSTRAINT "staff_service_prices_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_service_prices" ADD CONSTRAINT "staff_service_prices_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_service_prices" ADD CONSTRAINT "staff_service_prices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
