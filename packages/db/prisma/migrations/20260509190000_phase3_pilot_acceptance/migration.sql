-- BCC AI Front Desk pivot Phase 3: pilot acceptance + provisioning
-- Per BCC-PIVOT-MASTER-PLAN.md (v3) Phase 3.

-- AlterTable: PilotApplication tracks which Business was provisioned on Accept (idempotency anchor)
ALTER TABLE "pilot_applications"
  ADD COLUMN "acceptedBusinessId" TEXT;
