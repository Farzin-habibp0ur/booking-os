-- Phase 0: Campaign, Automation, Testimonial bug fixes

-- Add channel field to campaigns
ALTER TABLE "campaigns" ADD COLUMN "channel" TEXT DEFAULT 'WHATSAPP';

-- Add channel field to campaign_sends
ALTER TABLE "campaign_sends" ADD COLUMN "channel" TEXT;

-- Add submission token and reminder fields to testimonials
ALTER TABLE "testimonials" ADD COLUMN "submissionToken" TEXT;
ALTER TABLE "testimonials" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Create unique index on testimonial submission token
CREATE UNIQUE INDEX "testimonials_submissionToken_key" ON "testimonials"("submissionToken");

-- Deduplicate campaigns before adding unique constraint (keeps one arbitrary row per businessId+name)
DELETE FROM "campaigns" a USING "campaigns" b
WHERE a.id < b.id AND a."businessId" = b."businessId" AND a.name = b.name;

-- Deduplicate automation rules before adding unique constraint (keeps one arbitrary row per businessId+name)
DELETE FROM "automation_rules" a USING "automation_rules" b
WHERE a.id < b.id AND a."businessId" = b."businessId" AND a.name = b.name;

-- Add unique constraint on campaigns (businessId, name)
CREATE UNIQUE INDEX "campaigns_businessId_name_key" ON "campaigns"("businessId", "name");

-- Add unique constraint on automation_rules (businessId, name)
CREATE UNIQUE INDEX "automation_rules_businessId_name_key" ON "automation_rules"("businessId", "name");
