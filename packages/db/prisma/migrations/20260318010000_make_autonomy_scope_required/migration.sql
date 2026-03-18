-- Backfill NULL scope values to 'OPERATIONAL'
UPDATE "autonomy_configs" SET "scope" = 'OPERATIONAL' WHERE "scope" IS NULL;

-- Make scope non-nullable with default
ALTER TABLE "autonomy_configs" ALTER COLUMN "scope" SET DEFAULT 'OPERATIONAL';
ALTER TABLE "autonomy_configs" ALTER COLUMN "scope" SET NOT NULL;
