-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "defaultLocale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "locale" TEXT;

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translations_businessId_locale_idx" ON "translations"("businessId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "translations_businessId_locale_key_key" ON "translations"("businessId", "locale", "key");

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
