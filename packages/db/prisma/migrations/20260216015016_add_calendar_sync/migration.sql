-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "externalCalendarEventId" TEXT;

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "icalFeedToken" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_icalFeedToken_key" ON "calendar_connections"("icalFeedToken");

-- CreateIndex
CREATE INDEX "calendar_connections_staffId_idx" ON "calendar_connections"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_staffId_provider_key" ON "calendar_connections"("staffId", "provider");

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
