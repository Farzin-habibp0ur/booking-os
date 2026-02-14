-- AlterTable
ALTER TABLE "services" ADD COLUMN     "bufferAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBefore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT;
