-- AlterTable
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolloutStage" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolloutPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolloutStartedAt" TIMESTAMP(3);
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolloutCompletedAt" TIMESTAMP(3);
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolloutPausedAt" TIMESTAMP(3);
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolledBackAt" TIMESTAMP(3);
ALTER TABLE "vertical_pack_versions" ADD COLUMN "rolledBackReason" TEXT;

-- CreateTable
CREATE TABLE "pack_tenant_pins" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "packSlug" TEXT NOT NULL,
    "pinnedVersion" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_tenant_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pack_tenant_pins_packSlug_idx" ON "pack_tenant_pins"("packSlug");

-- CreateIndex
CREATE UNIQUE INDEX "pack_tenant_pins_businessId_packSlug_key" ON "pack_tenant_pins"("businessId", "packSlug");

-- AddForeignKey
ALTER TABLE "pack_tenant_pins" ADD CONSTRAINT "pack_tenant_pins_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_tenant_pins" ADD CONSTRAINT "pack_tenant_pins_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
