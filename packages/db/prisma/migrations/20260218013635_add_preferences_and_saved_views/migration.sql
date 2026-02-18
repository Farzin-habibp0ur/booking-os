-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffId" TEXT,
    "page" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isDashboard" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_views_businessId_staffId_idx" ON "saved_views"("businessId", "staffId");

-- CreateIndex
CREATE INDEX "saved_views_businessId_isShared_idx" ON "saved_views"("businessId", "isShared");

-- CreateIndex
CREATE INDEX "saved_views_businessId_page_idx" ON "saved_views"("businessId", "page");

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
