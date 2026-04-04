# BookingOS Vertical Consolidation Plan: Aesthetic-Only Focus

**Date:** April 3, 2026
**Author:** Senior Developer (AI-assisted)
**Status:** Draft — Ready for Founder Review

---

## Executive Summary

This plan covers removing the Dealership, Wellness, Salon, Tutoring, and General verticals from BookingOS to focus exclusively on Aesthetic clinics. The codebase currently has 6 vertical values, ~9 vertical-specific API modules, ~20 vertical-specific frontend components, 13 vertical-specific Prisma models, and conditional logic scattered across ~59 files. The work breaks into 8 phases over an estimated 3–4 weeks of focused dev time.

**Key decision to make before starting:** Do you want to keep the Vertical Pack *infrastructure* (the dynamic field system, pack builder, `VerticalPackDefinition` pattern) for future extensibility? Or hardcode everything for aesthetic and rip out the abstraction layer too? This plan assumes **Option A: keep the infrastructure but remove non-aesthetic packs**, which is safer and faster. Option B (hardcode) is noted where relevant.

---

## Phase 1: Pre-Work — Branch, Backup, Audit (Day 1)

**Goal:** Safe starting point with no risk to production.

**Steps:**

1. Create a long-lived feature branch: `git checkout -b feat/aesthetic-only-consolidation`
2. Tag the current main as a restore point: `git tag pre-vertical-consolidation`
3. Export production database snapshot (pg_dump) — this is your rollback if seed data changes go wrong
4. Run the full test suite to confirm green baseline: `npm run format:check && npm run lint && npm test`
5. Document current test count per package so you can track removals vs breakage

**Files touched:** None (branch/tag/backup only)

---

## Phase 2: Database Schema — Remove Non-Aesthetic Models (Days 2–3)

**Goal:** Remove 10 Prisma models and their enums that belong to Dealership and Wellness verticals.

**Models to remove (10):**

| Model | Vertical | Schema line | Relations to sever |
|---|---|---|---|
| `Vehicle` | Dealership | ~1806 | Business, Staff, Customer, TestDrive, Deal |
| `TestDrive` | Dealership | ~1842 | Vehicle, Customer, Staff, Business |
| `Deal` | Dealership | ~1867 | Customer, Staff, Business, DealStageHistory, DealActivity |
| `DealStageHistory` | Dealership | ~1899 | Deal, Staff |
| `DealActivity` | Dealership | ~1916 | Deal, Staff |
| `ServicePackage` | Wellness | ~1937 | Business, PackagePurchase |
| `PackagePurchase` | Wellness | ~1961 | ServicePackage, Customer, PackageRedemption |
| `PackageRedemption` | Wellness | ~1986 | PackagePurchase, Booking |
| `RecurringClass` | Wellness | ~2017 | Business, Staff, Location |
| `StaffCertification` | Multi (wellness/aesthetic) | ~1999 | Staff |

**Models to keep (aesthetic-specific):** MedicalRecord, ClinicalPhoto, PhotoComparison, TreatmentPlan, TreatmentSession, AftercareProtocol, AftercareStep, AftercareEnrollment, AftercareMessage — all stay.

**Decision needed on `StaffCertification`:** This is used by wellness practitioners but could be useful for aesthetic clinics (nurse certifications, laser certifications). Recommend **keeping it** and reframing as aesthetic staff credentials.

**Enums to simplify in `packages/shared/src/enums.ts`:**

| Enum | Current values | After consolidation |
|---|---|---|
| `VerticalPack` | AESTHETIC, SALON, TUTORING, GENERAL, DEALERSHIP, WELLNESS | AESTHETIC only (or keep GENERAL as fallback) |
| `KanbanStatus` | CHECKED_IN, DIAGNOSING, AWAITING_APPROVAL, IN_PROGRESS, READY_FOR_PICKUP | Remove entirely (dealership-only) |
| `ServiceKind` | CONSULT, TREATMENT, OTHER | Keep all (aesthetic uses CONSULT + TREATMENT) |

**Dealership enums to remove from schema (defined as Prisma enums or string fields):**
- `VehicleStatus` (IN_STOCK, RESERVED, SOLD, etc.)
- `VehicleCondition` (NEW, USED, CERTIFIED_PRE_OWNED)
- `TestDriveStatus` (SCHEDULED, COMPLETED, NO_SHOW, CANCELLED)
- `DealStage` (INQUIRY through CLOSED_LOST)
- `DealActivityType` (NOTE, CALL, EMAIL, etc.)
- `DealSource` (WALK_IN, PHONE, WEBSITE, etc.)
- `DealType` (NEW_PURCHASE, USED_PURCHASE, TRADE_IN, LEASE)

**Steps:**

1. Edit `packages/db/prisma/schema.prisma`: remove the 10 models listed above and their relation fields from Business (lines ~88-92), Staff (lines ~146-152, 7 fields), Customer (lines ~196-198), Booking (lines ~260, ~289, ~290), Service (lines ~243-244), Payment (line ~547), Location (lines ~849-850), Resource (line ~868)
2. Remove dealership/wellness enum definitions from the schema
3. Edit `packages/shared/src/enums.ts`: reduce `VerticalPack` to `AESTHETIC` only (or AESTHETIC + GENERAL), remove `KanbanStatus`
4. Edit `packages/shared/src/types.ts`: remove `KanbanStatus` import and `kanbanStatus` from the Booking type interface (line ~75)
5. Change `Business.verticalPack` default from `"general"` to `"aesthetic"` in the schema
6. Create migration: `npx prisma migrate dev --name remove_non_aesthetic_verticals --schema=packages/db/prisma/schema.prisma`
7. Regenerate client: `npx prisma generate --schema=packages/db/prisma/schema.prisma`

**Also in the Booking model (schema line ~260):** The `kanbanStatus` field (`String?`) on the Booking model is dealership-specific. Decision needed: remove the field in this migration (cleaner) or leave it nullable and unused (safer, avoids touching the core Booking model). Recommendation: remove it — it's only used by the dealership kanban board and service-board page.

**Risk:** This migration is destructive (drops tables). Production data for Metro Auto Group and Serenity Wellness Spa businesses will be lost. That's fine if they're demo-only, but verify no real customers use those verticals.

---

## Phase 3: Remove Dealership & Wellness API Modules (Days 3–5)

**Goal:** Delete 5 entire NestJS modules and clean up their registrations.

**Modules to delete entirely (5 directories):**

| Module | Path | What it does |
|---|---|---|
| `vehicle` | `apps/api/src/modules/vehicle/` | Vehicle CRUD, inventory stats |
| `test-drive` | `apps/api/src/modules/test-drive/` | Test drive scheduling |
| `deal` | `apps/api/src/modules/deal/` | Deal pipeline, stages, activities |
| `package` | `apps/api/src/modules/package/` | Wellness service packages |
| `recurring-class` | `apps/api/src/modules/recurring-class/` | Wellness recurring classes |

**Steps:**

1. Delete the 5 module directories listed above
2. Edit `apps/api/src/app.module.ts`: remove imports and registrations for `VehicleModule`, `TestDriveModule`, `DealModule`, `PackageModule`, `RecurringClassModule` (currently at lines 79–83 and 185–189)
3. Delete dealership/wellness pack definition files:
   - `apps/api/src/modules/vertical-pack/packs/dealership.pack.ts`
   - `apps/api/src/modules/vertical-pack/packs/wellness.pack.ts`
4. Update `apps/api/src/modules/vertical-pack/vertical-pack.service.ts`: remove references to dealership and wellness packs
5. Update `apps/api/src/modules/vertical-pack/vertical-pack.service.spec.ts`: remove dealership/wellness test cases

**Conditional logic to clean in shared modules (34 files total, key ones):**

| File | What to change |
|---|---|
| `modules/customer/customer.service.ts` | Remove `if (business?.verticalPack !== 'dealership')` guard — the vehicle-linking logic goes away entirely |
| `modules/dashboard/dashboard.service.ts` | Remove dealership kanban section (`if (verticalPack === 'dealership' \|\| packConfig?.kanbanEnabled)`) |
| `modules/portal/portal.service.ts` | Remove `if (biz.verticalPack !== 'wellness')` guard for package portal access |
| `modules/referral/referral.service.ts` + `referral.controller.ts` | Change allowed verticals from `['AESTHETIC', 'WELLNESS']` to just `['AESTHETIC']` (or remove the check entirely) |
| `modules/booking/booking.service.ts` | Remove wellness package redemption/unredemption logic AND `updateKanbanStatus()`/`kanbanBoard()` methods (see kanban items below) |
| `modules/ai/vertical-action-handler.ts` | Remove dealership and wellness case branches |
| `modules/ai/intent-detector.ts` | Remove dealership/wellness vertical context from prompts |
| `modules/ai/ai.service.ts` | Remove vertical-specific AI routing for dealership/wellness |
| `modules/agent-skills/agent-skills.service.ts` | Remove dealership/wellness skill sets from `getSkillsForPack()` |
| `modules/automation/automation.service.ts` | Remove dealership/wellness-specific automation triggers if any |
| `modules/auth/auth.service.ts` | No structural change needed — just ensure verticalPack still gets returned |
| `modules/booking/booking.controller.ts` | Remove `GET /bookings/kanban` endpoint and `PATCH /bookings/:id/kanban-status` endpoint (+ `UpdateKanbanStatusDto` import) |
| `modules/booking/booking.service.ts` | (consolidated into row above) |
| `modules/booking/booking.service.spec.ts` | Remove kanban-related test cases |
| `modules/booking/booking.controller.spec.ts` | Remove kanban endpoint tests |
| `modules/notification/notification.service.ts` | Remove `sendKanbanStatusUpdate()` method |
| `modules/notification/notification.service.spec.ts` | Remove kanban notification tests |
| `modules/quote/quote.service.ts` | Remove KanbanStatus references |
| `modules/quote/quote.service.spec.ts` | Remove kanban-related test cases |
| `common/dto.ts` | Remove `UpdateKanbanStatusDto` class (has `kanbanStatus` with CHECKED_IN/DIAGNOSING/etc validation) |
| `test/mocks.ts` | Remove KanbanStatus from mock data |

**Test files to update:** Every `.spec.ts` file for the modules above. The dealership/wellness test cases in shared module specs (ai.service.spec.ts, intent-detector.spec.ts, vertical-action-handler.spec.ts, referral.service.spec.ts, customer-journey.spec.ts, agent-skills.service.spec.ts, dashboard.service.ts, pack-builder.service.spec.ts, console-skills.service.spec.ts) need their non-aesthetic test scenarios removed.

---

## Phase 4: Remove Dealership & Wellness Frontend Code (Days 5–7)

**Goal:** Delete vertical-specific components, pages, and clean up navigation.

**Component directories to delete (25 files):**

| Directory | Files (component + test pairs) |
|---|---|
| `apps/web/src/components/dealership/` | pipeline-stats, vehicle-selector, vehicle-card, customer-journey-board (4 components + 4 tests = 8 files) |
| `apps/web/src/components/wellness/` | wellness-intake-card, class-schedule, package-tracker, membership-badge, package-purchase-modal, package-redeem-selector, practitioner-profile, certification-manager, plus index.ts (8 components + 8 tests + 1 barrel = 17 files; note: certification-manager may be worth keeping — see Phase 2 StaffCertification decision) |

**Pages to delete (3 routes, 11 files):**

| Route | Files | Vertical |
|---|---|---|
| `/inventory` | `page.tsx`, `inventory.test.tsx`, `[id]/page.tsx` (vehicle detail) | Dealership |
| `/pipeline` | `page.tsx`, `pipeline.test.tsx`, `deal-detail.test.tsx`, `[id]/page.tsx` (deal detail) | Dealership |
| `/packages` | `page.tsx`, `packages.test.tsx` | Wellness |

**Navigation cleanup:**

| File | Change |
|---|---|
| `apps/web/src/lib/nav-config.ts` | Remove dealership conditional (lines 86–91: `/inventory`, `/pipeline`), remove wellness conditional (lines 94–96: `/packages`), remove `general` exclusion for `/roi` (line 108–110). Remove `Car`, `Package`, `Compass` icon imports if now unused |
| `apps/web/src/lib/mode-config.ts` | Remove `isDealership` variable and conditional `/inventory`/`/pipeline` injection in `getAdminSections()` (lines 48–54). Remove `/packages` from tools if conditionally added |
| `apps/web/src/lib/design-tokens.ts` | Remove `VEHICLE_STATUS_STYLES`, `vehicleConditionBadgeClasses`, `DEAL_STAGE_STYLES`, `dealStageBadgeClasses` |

**Other frontend files to clean (from the 25-file grep):**

| File | Change |
|---|---|
| `apps/web/src/components/intake-card.tsx` | Remove dealership/wellness/general label branches — keep only aesthetic ("CLINIC INTAKE") |
| `apps/web/src/components/intake-card.test.tsx` | Remove non-aesthetic test cases |
| `apps/web/src/app/(protected)/customers/[id]/page.tsx` | Remove dealership vehicle display, wellness package display |
| `apps/web/src/app/(protected)/customers/[id]/page.test.tsx` | Remove non-aesthetic test cases |
| `apps/web/src/app/(protected)/dashboard/page.tsx` | Remove dealership kanban section |
| `apps/web/src/app/(protected)/setup/page.tsx` | Remove vertical selection step (default to aesthetic) |
| `apps/web/src/app/(protected)/service-board/page.test.tsx` | Remove dealership-specific assertions (test mock uses `name: 'dealership'` and `kanbanEnabled: true` — update to aesthetic context if keeping service board, or delete page entirely per Phase 7d) |
| `apps/web/src/app/(protected)/admin/pack-builder/page.tsx` | Simplify to only manage aesthetic pack config (or remove entirely — see Phase 7) |
| `apps/web/src/app/(protected)/admin/pack-builder/page.test.tsx` | Update tests |
| `apps/web/src/app/(marketing)/landing-page.tsx` | Remove references to dealership/wellness verticals from marketing copy |
| `apps/web/src/app/(marketing)/faq/page.tsx` | Remove non-aesthetic FAQ entries |
| `apps/web/src/locales/en.json` | Remove dealership/wellness translation keys (nav.inventory, nav.pipeline, nav.packages, and any vertical-specific labels) |
| `apps/web/src/locales/es.json` | Same as above |

**Admin app files to clean (6 files in `apps/admin/src/`):**

| File | Change |
|---|---|
| `app/businesses/page.tsx` | Remove vertical-specific display/filtering logic |
| `app/businesses/[id]/page.tsx` | Remove dealership/wellness-specific business detail sections |
| `app/businesses/[id]/page.test.tsx` | Update test assertions |
| `app/packs/skills/page.tsx` | Remove non-aesthetic vertical skill configurations |
| `app/marketing/rejection-analytics/page.tsx` | Remove vertical-specific analytics references |
| `lib/auth.tsx` | Verify vertical references (may just be passing verticalPack through — likely minimal change) |

---

## Phase 5: Seed Data & Demo Accounts (Days 7–8)

**Goal:** Remove non-aesthetic seed data. Keep one demo business.

**Files to modify:**

| File | Change |
|---|---|
| `packages/db/src/seed-wellness.ts` | Delete entirely (or archive to `archive/`) |
| `packages/db/src/seed-demo.ts` | Remove Metro Auto Group (dealership) business creation (~line 2014+), remove its staff/customers/bookings/conversations/automations. Keep Glow Aesthetic Clinic. Remove Serenity Wellness references if present |
| `packages/db/src/seed.ts` | Remove call to `seedWellness()` and dealership business creation. Keep aesthetic |
| `packages/db/src/seed-console-showcase.ts` | Remove dealership/wellness showcase data |
| `packages/db/src/seed-omnichannel.ts` | Remove non-aesthetic business references |
| `packages/db/src/seed-console-fixup.ts` | Remove non-aesthetic fixup data |
| `packages/db/src/migrate-vehicle-data.ts` | Delete entirely (dealership migration utility) |

**Demo credentials table (updated):**

Only one business remains:

| Business | Email | Password | Vertical |
|---|---|---|---|
| Glow Aesthetic Clinic | sarah@glowclinic.com | Bk0s!DemoSecure#2026 | Aesthetic |

---

## Phase 6: Update Documentation (Day 8–9)

**Goal:** Every doc that references verticals gets updated per the Documentation Dependency Map in CLAUDE.md.

**Documents to update:**

| Document | Changes needed |
|---|---|
| `CLAUDE.md` | Update: Vertical Pack System section (aesthetic only), Key Enums (remove KanbanStatus, dealership/vehicle enums), Demo Credentials table (1 row), module count, model count, page count, seed data references, "Do Not Build" section, nav structure description |
| `docs/PROJECT_CONTEXT.md` | Remove dealership/wellness agent types, vertical references, roadmap items |
| `docs/REFERENCE.md` | Update page categories (remove inventory/pipeline/packages), update seed script table, update navigation reference |
| `docs/user-stories.md` | Mark dealership/wellness user stories as archived |
| `DESIGN_DOCUMENTATION.md` | Remove dealership/wellness design token references |
| `.env.example` | No change needed (verticals don't have env vars) |
| `DEPLOY.md` | No change needed unless vertical-specific deploy steps exist |

---

## Phase 7: Decide on Infrastructure Simplification (Day 9–10)

These are optional but recommended simplifications now that you have one vertical:

**7a. Pack Builder page:** Consider removing `apps/web/src/app/(protected)/admin/pack-builder/page.tsx` entirely. With one vertical, you don't need a SUPER_ADMIN UI to manage pack versions. The aesthetic pack definition file (`aesthetic.pack.ts`) becomes the single source of truth, edited in code. If you want to keep it for future extensibility, leave it but simplify.

**7b. VerticalPackVersion and PackTenantPin models:** These manage rollout of pack changes across tenants. With one vertical, they add complexity with no value. Recommend removing them from the schema.

**7c. `verticalPack` field on Business:** You could remove it entirely (every business is aesthetic) or keep it with a forced default of `"aesthetic"`. Keeping it is safer for backward compatibility and makes re-adding verticals later trivial.

**7d. Kanban / Service Board:** The service board page (`/service-board`) uses `kanbanEnabled` from packConfig and calls `GET /bookings/kanban` + `PATCH /bookings/:id/kanban-status`. This was primarily a dealership feature. The `kanbanStatus` field lives on the Booking model itself, and kanban logic is embedded in BookingController, BookingService, NotificationService, QuoteService, and the shared DTO file. If you chose to remove `kanbanStatus` from the Booking schema in Phase 2, then the service-board page, its test, and the `kanbanEnabled` nav conditional all must be removed here. If aesthetic clinics might want a treatment status board, consider repurposing it (but that's a separate feature, not a blocker for this consolidation).

**7e. Referral module:** Currently gated to `['AESTHETIC', 'WELLNESS']`. With wellness gone, remove the array check entirely — it's always allowed.

---

## Phase 8: Validation & Cleanup (Days 10–12)

**Goal:** Everything compiles, all tests pass, production deploy is safe.

**Steps in order:**

1. `npm run format` — auto-fix formatting
2. `npm run format:check` — verify clean
3. `npm run lint` — catches missing imports, unused variables, type errors from removed code
4. `npm test` — all tests must pass
5. Manual smoke test of key flows:
   - Login as sarah@glowclinic.com
   - Navigate dashboard, bookings, customers, inbox, calendar
   - Verify intake card shows "CLINIC INTAKE" with aesthetic fields
   - Verify treatment plans, clinical photos, aftercare all work
   - Verify navigation has no dealership/wellness items
   - Verify AI assistant responds correctly for aesthetic context
6. Run E2E tests: `cd apps/web && npm run test:e2e`
7. Review bundle size: `npm run build` and compare to baseline (should shrink)
8. Seed a fresh database and verify: `npx tsx packages/db/src/seed.ts && npx tsx packages/db/src/seed-demo.ts`

---

## Risk Mitigation

**Biggest risk: missing a reference.** Grep results showed ~59 files with vertical-specific logic. The phases above account for all of them, but new ones could have been added since the audit. Before merging, run:

```bash
# Final sweep — should return zero results
grep -r "dealership\|DEALERSHIP\|wellness\|WELLNESS\|SALON\|TUTORING" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  apps/ packages/ --exclude-dir=node_modules --exclude-dir=.next \
  --exclude-dir=archive
```

**Second risk: production migration.** The Prisma migration drops tables. If any production business uses dealership or wellness verticals, their data is lost. Run this query against production before migrating:

```sql
SELECT id, name, "verticalPack" FROM businesses
WHERE "verticalPack" NOT IN ('aesthetic');
```

If results exist and they're real (not demo), you need a data migration strategy before proceeding.

**Third risk: API consumers.** If any external integrations call dealership/wellness endpoints (e.g., `/vehicles`, `/deals`, `/packages`), they'll get 404s after this change. Check server logs for traffic to these endpoints before removing them.

---

## Estimated Effort

| Phase | Days | Complexity |
|---|---|---|
| 1. Pre-work | 0.5 | Low |
| 2. Database schema | 1.5 | Medium (migration risk) |
| 3. API modules | 2 | Medium-High (many files) |
| 4. Frontend code | 2 | Medium (many files) |
| 5. Seed data | 1 | Low |
| 6. Documentation | 1 | Low |
| 7. Infrastructure decisions | 1 | Low (mostly deletions) |
| 8. Validation & cleanup | 1.5 | Medium |
| **Total** | **~10.5 days** | |

---

## Files Summary — Complete Deletion List

**API modules to delete (5 directories, ~30 files):**
- `apps/api/src/modules/vehicle/`
- `apps/api/src/modules/test-drive/`
- `apps/api/src/modules/deal/`
- `apps/api/src/modules/package/`
- `apps/api/src/modules/recurring-class/`

**Frontend directories to delete (2 directories, 25 files):**
- `apps/web/src/components/dealership/` (8 files)
- `apps/web/src/components/wellness/` (17 files)

**Frontend pages to delete (3 routes, 11 files):**
- `apps/web/src/app/(protected)/inventory/` (3 files including [id] subpage)
- `apps/web/src/app/(protected)/pipeline/` (5 files including [id] subpage + deal-detail test)
- `apps/web/src/app/(protected)/packages/` (2 files)

**Pack definitions to delete (2 files):**
- `apps/api/src/modules/vertical-pack/packs/dealership.pack.ts`
- `apps/api/src/modules/vertical-pack/packs/wellness.pack.ts`

**Seed files to delete (2 files):**
- `packages/db/src/seed-wellness.ts`
- `packages/db/src/migrate-vehicle-data.ts`

**Files requiring edits (~65+ files):**
- 1 Prisma schema (remove models + kanbanStatus field from Booking)
- 1 shared enums file + 1 shared types file
- 1 app.module.ts
- ~20 API service/controller files with vertical conditionals (including booking, notification, quote kanban cleanup)
- ~18 API test files
- ~13 frontend component/page files (web app)
- 6 admin app files
- 2 locale JSON files
- 2 nav config files
- 1 design tokens file + 1 common dto file + 1 test mocks file
- ~5 documentation files
