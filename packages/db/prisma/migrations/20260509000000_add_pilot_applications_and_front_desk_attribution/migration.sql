-- CreateTable
CREATE TABLE "pilot_applications" (
    "id" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "websiteOrInstagram" TEXT,
    "countryTimezone" TEXT,
    "monthlyLeadVolume" TEXT,
    "currentChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "biggestFrontDeskPain" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilot_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "front_desk_attributions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "conversationId" TEXT,
    "bookingId" TEXT,
    "actionCardId" TEXT,
    "outboundDraftId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "channel" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 14,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "front_desk_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pilot_applications_status_submittedAt_idx" ON "pilot_applications"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "pilot_applications_email_idx" ON "pilot_applications"("email");

-- CreateIndex
CREATE UNIQUE INDEX "front_desk_attributions_outboundDraftId_key" ON "front_desk_attributions"("outboundDraftId");

-- CreateIndex
CREATE INDEX "front_desk_attributions_businessId_status_idx" ON "front_desk_attributions"("businessId", "status");

-- CreateIndex
CREATE INDEX "front_desk_attributions_businessId_source_idx" ON "front_desk_attributions"("businessId", "source");

-- CreateIndex
CREATE INDEX "front_desk_attributions_businessId_createdAt_idx" ON "front_desk_attributions"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "front_desk_attributions_bookingId_idx" ON "front_desk_attributions"("bookingId");

-- AddForeignKey
ALTER TABLE "front_desk_attributions" ADD CONSTRAINT "front_desk_attributions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_attributions" ADD CONSTRAINT "front_desk_attributions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_attributions" ADD CONSTRAINT "front_desk_attributions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_attributions" ADD CONSTRAINT "front_desk_attributions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_attributions" ADD CONSTRAINT "front_desk_attributions_actionCardId_fkey" FOREIGN KEY ("actionCardId") REFERENCES "action_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "front_desk_attributions" ADD CONSTRAINT "front_desk_attributions_outboundDraftId_fkey" FOREIGN KEY ("outboundDraftId") REFERENCES "outbound_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
