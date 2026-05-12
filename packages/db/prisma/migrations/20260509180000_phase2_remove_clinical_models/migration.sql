-- BCC AI Front Desk pivot Phase 2: remove clinical models for non-PHI launch
-- Per BCC-PIVOT-MASTER-PLAN.md (v3) Phase 2 + locked compliance posture:
-- "Non-HIPAA, non-PHI at launch. Clinical features removed from schema (not just hidden)."
-- Public copy: "BCC is non-clinical infrastructure. Your PMS remains the system of
-- record for any patient health information."

-- Drop in FK dependency order (children before parents).

DROP TABLE IF EXISTS "aftercare_messages" CASCADE;
DROP TABLE IF EXISTS "aftercare_enrollments" CASCADE;
DROP TABLE IF EXISTS "aftercare_steps" CASCADE;
DROP TABLE IF EXISTS "aftercare_protocols" CASCADE;
DROP TABLE IF EXISTS "photo_comparisons" CASCADE;
DROP TABLE IF EXISTS "clinical_photos" CASCADE;
DROP TABLE IF EXISTS "medical_records" CASCADE;
