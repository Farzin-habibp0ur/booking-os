# Claude Code Prompt — Aesthetic-Only Vertical Consolidation

Copy everything below the line into your Claude Code terminal.

---

```
You are implementing a vertical consolidation of the BookingOS monorepo. The goal is to remove ALL non-aesthetic verticals (Dealership, Wellness, Salon, Tutoring, General) so that the platform focuses exclusively on Aesthetic clinics.

CRITICAL CONSTRAINT: Keep the Vertical Pack INFRASTRUCTURE intact. We are removing the non-aesthetic packs and their code, NOT the framework itself. Specifically, KEEP these:
- `VerticalPackProvider` + `usePack()` hook in `apps/web/src/lib/vertical-pack.tsx`
- `vertical-pack` API module (`vertical-pack.service.ts`, `vertical-pack.controller.ts`)
- `VerticalPackDefinition` type in `packages/shared/src/types.ts`
- `aesthetic.pack.ts` in `apps/api/src/modules/vertical-pack/packs/`
- `VerticalPackVersion` and `PackTenantPin` Prisma models
- `verticalPack` field on the Business model (change default to "aesthetic")
- `pack-builder` module and admin page
- `ServiceKind` enum (CONSULT, TREATMENT, OTHER — used by aesthetic)

Read the full plan at `vertical-consolidation-plan.md` in the repo root for context. Now implement it in this exact order, committing after each phase:

---

## PHASE 1: Create branch and verify green baseline

1. Create branch: `git checkout -b feat/aesthetic-only-consolidation`
2. Tag current state: `git tag pre-vertical-consolidation`
3. Run `npm run format:check && npm run lint && npm test` — confirm everything passes before touching code
4. Commit: "chore: create consolidation branch and tag baseline"

---

## PHASE 2: Database schema changes

Edit `packages/db/prisma/schema.prisma`:

**Remove these 10 models entirely (and all their @@index, @@unique, @@map directives):**
- `Vehicle` (line ~1806)
- `TestDrive` (line ~1842)
- `Deal` (line ~1867)
- `DealStageHistory` (line ~1899)
- `DealActivity` (line ~1916)
- `ServicePackage` (line ~1937)
- `PackagePurchase` (line ~1961)
- `PackageRedemption` (line ~1986)
- `StaffCertification` (line ~1999)
- `RecurringClass` (line ~2017)

**Remove relation fields pointing to deleted models from these parent models:**
- `Business` model (lines ~88-92): remove `vehicles Vehicle[]`, `deals Deal[]`, `servicePackages ServicePackage[]`, `packagePurchases PackagePurchase[]`, `recurringClasses RecurringClass[]`
- `Staff` model (lines ~146-152): remove these 7 relation fields:
    - `vehiclesAdded Vehicle[]`
    - `testDrives TestDrive[]`
    - `assignedDeals Deal[] @relation("DealAssignedTo")`
    - `dealStageChanges DealStageHistory[] @relation("DealStageChangedBy")`
    - `dealActivities DealActivity[] @relation("DealActivityCreatedBy")`
    - `certifications StaffCertification[]`
    - `recurringClasses RecurringClass[]`
- `Customer` model (lines ~196-198): remove `testDrives TestDrive[]`, `deals Deal[]`, `packagePurchases PackagePurchase[]`
- `Booking` model (line ~260): remove `kanbanStatus String?` field
- `Booking` model (line ~289): remove `testDrive TestDrive?`
- `Booking` model (line ~290): remove `packageRedemption PackageRedemption?`
- `Service` model (line ~243): remove `servicePackages ServicePackage[]`, `recurringClasses RecurringClass[]`
- `Payment` model (line ~547): remove `packagePurchase PackagePurchase?`
- `Location` model (line ~849-850): remove `vehicles Vehicle[]`, `recurringClasses RecurringClass[]`
- `Resource` model (line ~868): remove `recurringClasses RecurringClass[]`

**Remove the comment blocks above deleted models** (e.g., `// Vehicle Inventory (Dealership vertical)`, `// Deal Pipeline (Dealership vertical)`, `// Service Packages (Wellness vertical)`).

**Change Business.verticalPack default** from `@default("general")` to `@default("aesthetic")`.

**Edit `packages/shared/src/enums.ts`:**
- In the `VerticalPack` enum, remove: SALON, TUTORING, DEALERSHIP, WELLNESS. Keep only AESTHETIC and GENERAL (GENERAL as fallback).
- Remove the entire `KanbanStatus` enum.

**Edit `packages/shared/src/types.ts`:**
- Remove the `KanbanStatus` import if present
- Remove `kanbanStatus: KanbanStatus | null;` from the Booking interface

Now generate the Prisma client (do NOT run migrate yet — we'll do that after code changes compile):
```bash
npx prisma generate --schema=packages/db/prisma/schema.prisma
```

Commit: "feat: remove non-aesthetic Prisma models and enums from schema"

---

## PHASE 3: Remove dealership & wellness API modules

**Delete these 5 module directories entirely:**
```bash
rm -rf apps/api/src/modules/vehicle
rm -rf apps/api/src/modules/test-drive
rm -rf apps/api/src/modules/deal
rm -rf apps/api/src/modules/package
rm -rf apps/api/src/modules/recurring-class
```

**Delete dealership/wellness pack definition files:**
```bash
rm apps/api/src/modules/vertical-pack/packs/dealership.pack.ts
rm apps/api/src/modules/vertical-pack/packs/wellness.pack.ts
```

**Edit `apps/api/src/app.module.ts`:**
- Remove these 5 import statements (lines ~79-83):
  ```
  import { VehicleModule } from './modules/vehicle/vehicle.module';
  import { TestDriveModule } from './modules/test-drive/test-drive.module';
  import { DealModule } from './modules/deal/deal.module';
  import { PackageModule } from './modules/package/package.module';
  import { RecurringClassModule } from './modules/recurring-class/recurring-class.module';
  ```
- Remove these 5 entries from the `imports` array (lines ~185-189):
  ```
  VehicleModule,
  TestDriveModule,
  DealModule,
  PackageModule,
  RecurringClassModule,
  ```

**Clean conditional logic in shared API modules — for each file below, read it first, then make the specified changes:**

1. `apps/api/src/modules/vertical-pack/vertical-pack.service.ts` — Remove imports of dealership and wellness packs. Remove any switch/if branches that load them. Keep only the aesthetic pack.
2. `apps/api/src/modules/vertical-pack/vertical-pack.service.spec.ts` — Remove test cases for dealership and wellness packs.
3. `apps/api/src/modules/customer/customer.service.ts` — Remove the `if (business?.verticalPack !== 'dealership')` guard and all vehicle-linking logic.
4. `apps/api/src/modules/dashboard/dashboard.service.ts` — Remove the dealership kanban section (the `if (verticalPack === 'dealership' || packConfig?.kanbanEnabled)` block and related code).
5. `apps/api/src/modules/portal/portal.service.ts` — Remove the `if (biz.verticalPack !== 'wellness')` guard for package portal access.
6. `apps/api/src/modules/referral/referral.service.ts` and `apps/api/src/modules/referral/referral.controller.ts` — Remove the allowed verticals array check (`['AESTHETIC', 'WELLNESS']`). Referrals are now always allowed.
7. `apps/api/src/modules/booking/booking.service.ts` — Remove wellness package redemption/unredemption logic. Remove `updateKanbanStatus()` method. Remove `kanbanBoard()` query method.
8. `apps/api/src/modules/booking/booking.controller.ts` — Remove `GET /bookings/kanban` endpoint method. Remove `PATCH /bookings/:id/kanban-status` endpoint method. Remove `UpdateKanbanStatusDto` import.
9. `apps/api/src/modules/ai/vertical-action-handler.ts` — Remove dealership and wellness case branches. Keep only aesthetic.
10. `apps/api/src/modules/ai/intent-detector.ts` — Remove dealership/wellness vertical context from LLM prompts.
11. `apps/api/src/modules/ai/ai.service.ts` — Remove vertical-specific AI routing for dealership/wellness.
12. `apps/api/src/modules/agent-skills/agent-skills.service.ts` — Remove dealership/wellness skill sets from `getSkillsForPack()`.
13. `apps/api/src/modules/automation/automation.service.ts` — Remove any dealership/wellness-specific automation trigger logic.
14. `apps/api/src/modules/notification/notification.service.ts` — Remove `sendKanbanStatusUpdate()` method entirely.
15. `apps/api/src/modules/quote/quote.service.ts` — Remove any KanbanStatus references.
16. `apps/api/src/common/dto.ts` — Remove the `UpdateKanbanStatusDto` class entirely (it validates kanban status values like CHECKED_IN, DIAGNOSING, etc.).
17. `apps/api/src/test/mocks.ts` — Remove KanbanStatus from mock data.

**Update ALL corresponding test files.** For each service/controller you modified above, also update its `.spec.ts` file:
- Remove test cases that test dealership or wellness-specific behavior
- Remove test cases that test kanban status updates
- Remove mocks that reference Vehicle, Deal, TestDrive, ServicePackage, PackagePurchase, PackageRedemption, RecurringClass, StaffCertification, KanbanStatus
- Ensure remaining tests still pass

Key test files to update:
- `apps/api/src/modules/ai/ai.service.spec.ts`
- `apps/api/src/modules/ai/intent-detector.spec.ts`
- `apps/api/src/modules/ai/vertical-action-handler.spec.ts`
- `apps/api/src/modules/referral/referral.service.spec.ts`
- `apps/api/src/modules/referral/referral.controller.spec.ts`
- `apps/api/src/modules/customer/customer-journey.spec.ts`
- `apps/api/src/modules/agent-skills/agent-skills.service.spec.ts`
- `apps/api/src/modules/booking/booking.service.spec.ts`
- `apps/api/src/modules/booking/booking.controller.spec.ts`
- `apps/api/src/modules/notification/notification.service.spec.ts`
- `apps/api/src/modules/quote/quote.service.spec.ts`
- `apps/api/src/modules/dashboard/dashboard.service.spec.ts` (if exists)
- `apps/api/src/modules/pack-builder/pack-builder.service.spec.ts`
- `apps/api/src/modules/console/console-skills.service.spec.ts`

After all edits, run: `cd apps/api && npx tsc --noEmit` to verify TypeScript compiles.

Commit: "feat: remove dealership and wellness API modules and clean shared module conditionals"

---

## PHASE 4: Remove dealership & wellness frontend code

**Delete component directories:**
```bash
rm -rf apps/web/src/components/dealership
rm -rf apps/web/src/components/wellness
```

**Delete page directories:**
```bash
rm -rf apps/web/src/app/\(protected\)/inventory
rm -rf apps/web/src/app/\(protected\)/pipeline
rm -rf apps/web/src/app/\(protected\)/packages
```

**Also delete the service-board page** (it's a kanban board that depended on dealership):
```bash
rm -rf apps/web/src/app/\(protected\)/service-board
```

**Edit `apps/web/src/lib/nav-config.ts`:**
- Remove the dealership conditional block (lines ~86-91):
  ```typescript
  ...(packName === 'dealership'
    ? [
        { href: '/inventory', label: t('nav.inventory'), icon: Car, roles: ['ADMIN', 'AGENT'] },
        { href: '/pipeline', label: t('nav.pipeline'), icon: Compass, roles: ['ADMIN', 'AGENT'] },
      ]
    : []),
  ```
- Remove the wellness conditional block (lines ~94-96):
  ```typescript
  ...(packName === 'wellness'
    ? [{ href: '/packages', label: t('nav.packages'), icon: Package, roles: ['ADMIN'] }]
    : []),
  ```
- Remove the kanbanEnabled conditional block (lines ~97-106):
  ```typescript
  ...(kanbanEnabled
    ? [
        {
          href: '/service-board',
          label: t('nav.service_board'),
          icon: Kanban,
          roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
        },
      ]
    : []),
  ```
- Remove the general exclusion for ROI (lines ~108-110):
  ```typescript
  ...(packName !== 'general'
    ? [{ href: '/roi', label: t('nav.roi'), icon: TrendingUp, roles: ['ADMIN'] }]
    : []),
  ```
  Replace with just: `{ href: '/roi', label: t('nav.roi'), icon: TrendingUp, roles: ['ADMIN'] },`
- Remove unused icon imports: `Car`, `Package`, `Compass`, `Kanban` (verify each is truly unused first)
- Remove `kanbanEnabled` from the `NavConfigOptions` interface if it's no longer referenced

**Edit `apps/web/src/lib/mode-config.ts`:**
- Remove the `isDealership` variable and the conditional `/inventory`/`/pipeline` injection in `getAdminSections()` (lines ~48-54)
- Remove `/packages` from the tools array if it was conditionally included
- Remove `/service-board` from any nav sections

**Edit `apps/web/src/lib/design-tokens.ts`:**
- Remove `VEHICLE_STATUS_STYLES` object
- Remove `vehicleConditionBadgeClasses()` function
- Remove `DEAL_STAGE_STYLES` object
- Remove `dealStageBadgeClasses()` function

**Edit these frontend files (read each one first):**

1. `apps/web/src/components/intake-card.tsx` — Remove dealership/wellness/general label branches. Keep only the aesthetic label ("CLINIC INTAKE"). Remove any imports of dealership/wellness types.
2. `apps/web/src/components/intake-card.test.tsx` — Remove test cases for non-aesthetic verticals.
3. `apps/web/src/app/(protected)/customers/[id]/page.tsx` — Remove dealership vehicle display sections, wellness package display sections. Keep aesthetic content (medical records, clinical photos, treatment plans).
4. `apps/web/src/app/(protected)/customers/[id]/page.test.tsx` — Remove non-aesthetic test cases.
5. `apps/web/src/app/(protected)/dashboard/page.tsx` — Remove dealership kanban dashboard section.
6. `apps/web/src/app/(protected)/setup/page.tsx` — Remove vertical selection/picker step. Default to aesthetic. The setup wizard should no longer ask which vertical the business is.
7. `apps/web/src/app/(protected)/admin/pack-builder/page.tsx` — Remove references to non-aesthetic packs in the UI. Keep the page functional for managing the aesthetic pack only.
8. `apps/web/src/app/(protected)/admin/pack-builder/page.test.tsx` — Update tests.
9. `apps/web/src/app/(marketing)/landing-page.tsx` — Remove marketing copy referencing dealership, wellness, car dealerships, spas, etc. Focus messaging on aesthetic clinics.
10. `apps/web/src/app/(marketing)/faq/page.tsx` — Remove FAQ entries about non-aesthetic verticals.
11. `apps/web/src/locales/en.json` — Remove translation keys for: nav.inventory, nav.pipeline, nav.packages, nav.service_board, and any dealership/wellness-specific labels. Search for "dealership", "wellness", "vehicle", "kanban", "pipeline" in the JSON.
12. `apps/web/src/locales/es.json` — Same removals as en.json.

**Edit admin app files in `apps/admin/src/`:**
1. `app/businesses/page.tsx` — Remove vertical-specific display/filtering for dealership/wellness.
2. `app/businesses/[id]/page.tsx` — Remove dealership/wellness business detail sections.
3. `app/businesses/[id]/page.test.tsx` — Update test assertions.
4. `app/packs/skills/page.tsx` — Remove non-aesthetic vertical skill configurations.
5. `app/marketing/rejection-analytics/page.tsx` — Remove vertical-specific analytics references.
6. `lib/auth.tsx` — Check for vertical references, clean if needed.

After all edits, run: `cd apps/web && npx tsc --noEmit && cd ../admin && npx tsc --noEmit` to verify TypeScript compiles.

Commit: "feat: remove dealership and wellness frontend components, pages, and navigation"

---

## PHASE 5: Clean up seed data

**Delete these files:**
```bash
rm packages/db/src/seed-wellness.ts
rm packages/db/src/migrate-vehicle-data.ts
```

**Edit `packages/db/src/seed.ts`:**
- Remove the import and call to `seedWellness()` (or however wellness seeding is invoked)
- Remove any dealership business creation code
- Ensure the aesthetic business (Glow Aesthetic Clinic) is still seeded correctly
- Set verticalPack to 'aesthetic' (not 'general') for any default business creation

**Edit `packages/db/src/seed-demo.ts`:**
- Remove the entire Metro Auto Group (dealership) business block (~line 2014+) including its staff, customers, bookings, conversations, and automation rules
- Remove any Serenity Wellness Spa references
- Keep the Glow Aesthetic Clinic block intact

**Edit `packages/db/src/seed-console-showcase.ts`:**
- Remove dealership/wellness showcase data

**Edit `packages/db/src/seed-omnichannel.ts`:**
- Remove non-aesthetic business references

**Edit `packages/db/src/seed-console-fixup.ts`:**
- Remove non-aesthetic fixup data

Commit: "feat: remove non-aesthetic seed data, keep only Glow Aesthetic Clinic"

---

## PHASE 6: Update documentation

**Edit `CLAUDE.md`:**
- Update the Demo Credentials table to only have Glow Aesthetic Clinic
- Update the Vertical Pack System section — remove Dealership, Wellness subsections. Note that only Aesthetic and General remain. Remove the Salon/Tutoring mentions.
- Update Key Enums section: remove KanbanStatus, VehicleStatus, VehicleCondition, TestDriveStatus, DealStage, DealActivityType, DealSource, DealType enums. Update VerticalPack to show only AESTHETIC, GENERAL.
- Update model count (subtract 10 from 96 = 86, or count actual remaining models)
- Update page count (subtract inventory, pipeline, packages, service-board = 4 fewer protected pages)
- Update module count (subtract vehicle, test-drive, deal, package, recurring-class = 5 fewer)
- Update the nav structure description (remove dealership/wellness conditionals)
- Update the "Do Not Build" section — remove "Don't chase additional verticals beyond the current 4"
- Update seed data references
- Remove mentions of Metro Auto Group, Serenity Wellness Spa

**Edit `docs/PROJECT_CONTEXT.md`:**
- Remove dealership/wellness agent types and vertical references
- Remove dealership/wellness roadmap items

**Edit `docs/REFERENCE.md`:**
- Remove inventory, pipeline, packages from page categories
- Remove service-board page reference
- Update seed script table (remove seed-wellness.ts, migrate-vehicle-data.ts)
- Update navigation reference

**Edit `docs/user-stories.md`:**
- Mark all dealership-specific and wellness-specific user stories as [ARCHIVED — vertical removed]

**Edit `DESIGN_DOCUMENTATION.md`:**
- Remove references to VEHICLE_STATUS_STYLES, DEAL_STAGE_STYLES, vehicleConditionBadgeClasses, dealStageBadgeClasses

Commit: "docs: update all documentation for aesthetic-only vertical consolidation"

---

## PHASE 7: Final validation

Run these checks IN ORDER. Fix any failures before proceeding to the next:

```bash
npm run format
npm run format:check
npm run lint
npm test
```

If lint or tests fail:
- Read the error output carefully
- Fix missing imports, unused variables, stale test references
- Re-run from `npm run format` after each fix

After all 4 pass, run the final sweep to verify no stale references remain:

```bash
grep -r "dealership\|DEALERSHIP\|wellness\|WELLNESS\|SALON\|TUTORING" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  apps/ packages/ --exclude-dir=node_modules --exclude-dir=.next \
  --exclude-dir=archive -l
```

This should return ZERO files. If any files are returned, read them, clean the references, and re-run the format/lint/test cycle.

Commit: "chore: fix all lint and test failures from vertical consolidation"

---

## IMPORTANT RULES:

1. **Read before editing.** Always read a file before modifying it. Never edit blindly based on line numbers — they may have shifted.
2. **Keep aesthetic code intact.** Do NOT touch MedicalRecord, ClinicalPhoto, PhotoComparison, TreatmentPlan, TreatmentSession, AftercareProtocol, AftercareStep, AftercareEnrollment, AftercareMessage models. Do NOT touch `apps/web/src/components/aesthetic/`. Do NOT touch `apps/api/src/modules/treatment-plan/`, `apps/api/src/modules/aftercare/`, `apps/api/src/modules/clinical-photo/`, `apps/api/src/modules/medical-record/`.
3. **Keep vertical pack infrastructure.** Do NOT delete `vertical-pack.service.ts`, `vertical-pack.controller.ts`, `vertical-pack.module.ts`, `aesthetic.pack.ts`, `VerticalPackProvider`, `usePack()`, `VerticalPackDefinition`, `VerticalPackVersion`, `PackTenantPin`, or the pack-builder module.
4. **Follow existing code conventions.** This repo uses NestJS patterns, Tailwind CSS, no external component libraries.
5. **Tests must pass.** Every commit should have passing tests. Update test mocks and assertions as needed when removing vertical-specific code.
6. **One commit per phase.** Do not squash phases together. This makes it easy to bisect if something breaks.
7. **Do NOT create the Prisma migration.** Just generate the client. The actual `prisma migrate dev` will be run manually against the database by the developer.
```
