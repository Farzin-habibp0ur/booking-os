# Business Command Centre — AI Front Desk Pivot: Master Implementation Plan

**Version 3** — adjusted after a re-audit showed deployment `ca6b8bc` shipped roughly a third of what v1/v2 anticipated. Three tasks are already DONE, two have partial groundwork that conflicts with v2's design, and the FrontDeskAttribution schema landed but with different fields than v2's target. v3 reconciles all of this. Execute v3, not v1 or v2.

This is the single source of truth for the pivot. It supersedes `HANDOFF-BCC-WEDGE.md` and `HANDOFF-DOCS-PIVOT.md`.

## How to use this document

Each phase is self-contained. Paste the "Claude Code prompt" at the end of each phase into your terminal in sequence. Do not skip — earlier phases set up later ones. After each phase, verify the listed "done when" criteria before moving on.

Branch: continue on `codex-business-command-centre-wedge`. Confirm with `git checkout codex-business-command-centre-wedge` before starting.

---

## What deployment `ca6b8bc` already shipped (skip these — they're done)

- ✅ `model PilotApplication` and `model FrontDeskAttribution` in `schema.prisma` (lines 1120-1183)
- ✅ Public `POST /pilot-applications` endpoint with rate limit + honeypot + min-time + consent
- ✅ Admin `/admin/pilot-applications` triage page (list view; no provisioning yet)
- ✅ `/front-desk/summary` endpoint (current shape: `leadsCaptured/approvedReplies/bookingsAttributed/estimatedRecoveredRevenue` — needs Phase 4 reshape)
- ✅ AI drafts write FrontDeskAttribution rows on creation and on SENT (current behavior in `outbound.service.ts:82, 212` — this is **wrong attribution point** per locked decisions; see Phase 4)
- ✅ Marketing rewrites: `landing-page.tsx`, `pricing/page.tsx`, `faq/page.tsx` — content rewritten in deployment (review for v3 wedge copy alignment in Phase 5; minor adjustments expected)
- ✅ New marketing pages: `(marketing)/privacy/page.tsx`, `(marketing)/terms/page.tsx`, `(marketing)/security/page.tsx`
- ✅ `ai-value-kpis.tsx` rewritten — but to old funnel shape (`leadsCaptured/approvedReplies/bookingsAttributed/estimatedRecoveredRevenue`), not v3's two-metric shape (Phase 4 rewrites again)
- ✅ Stale `'AI Hub'` describe block at `apps/web/src/app/(protected)/ai/settings/page.test.tsx:63` already fixed
- ✅ Admin healthcheck route at `apps/admin/src/app/api/v1/health/route.ts` exists
- ✅ Brand sweep across web/admin/locales/blog/email copy (partial — 25–38 "AI Hub"/"Booking OS" hits remain in docs/scripts; Phase 9 closes these)
- ✅ AI setup wizard rewritten (95 lines changed; Phase 6 verifies it matches the 5-step concierge spec)
- ✅ `AGENTS.md` (749 lines) added at root

## What's still NOT done (the work in this plan)

- Pilot acceptance flow (no `acceptApplicationAndProvision`; admin can list but not provision a Business)
- Baseline capture admin UI
- Pilot health admin dashboard
- `Business.businessHours`, `Business.baseline*` schema fields
- `FrontDeskAttribution.wouldHaveBeenMissed`, `attributionReason`, `voidedAt`, `revenueAtBooking` fields
- `PilotApplication.practiceType` field + `WAITLIST_YEAR_2` status
- Two-metric dashboard reshape
- Attribution moved from AI-draft hook → booking-creation hook
- Clinical removal (8+ components, 7 Prisma models, the `customers/[id]/page.tsx` clinical sections)
- GENERAL pack removal from `packages/shared/src/enums.ts` + seeds
- `agent-config.service.ts:20-33` legacy filter still has old names (`'BlogWriter'` etc.)
- Pilot form `practiceType` field
- DEMO_SCRIPT.md still says "WhatsApp-first operating system for service businesses" (line 129)
- 7 blog posts not deleted
- 8 new docs not created
- 14 of 15 `agents/*.md` prompts still say "BookingOS"
- `docs/PROJECT_CONTEXT.md`, `DESIGN_DOCUMENTATION.md`, `agents/outbound-prospecting.md` not rewritten
- Stripe AI Front Desk products/prices not created
- `EMAIL_FROM` and `PILOT_APPLICATION_NOTIFY_EMAIL` set to placeholders, not wedge values
- `docs/roadmap/` directory doesn't exist
- 7 archive candidates still at root

---

## Locked decisions reference

### Brand and positioning
- **Company:** Business Command Centre (multi-product)
- **Product #1:** AI Front Desk
- **Product #2 (future):** AI Marketing Manager
- **Wedge promise:** *"AI Front Desk for aesthetic clinics. Capture Instagram, WhatsApp, and website leads, draft replies for staff approval, fill cancellations, follow up consults, and prove revenue captured + bookings that would have been missed."*
- **Primary headline:** Turn missed clinic messages into booked appointments.
- **Primary CTA:** Apply for Pilot
- **Internal names preserved:** `@booking-os/*` packages, repo, DB names, Stripe legacy IDs

### Target market
- **Year 1 only:** US + Canada **medical spas** (injectables, laser, body contouring, facials, microneedling, RF/HIFU)
- **Buyer:** Owner-operator, 1–10 locations, $800K–$2.5M revenue, public Instagram presence
- **Year 2 expansion (in order):** hair restoration → IV/wellness → cash-pay aesthetic sub-units of derm/plastics (after HIPAA BAA + PHI minimization)
- **Excluded at launch:** clinical dermatology, plastic surgery, cosmetic dentistry, hospital systems, insurance-billed practices, 25+ location chains, PE-backed chains for pilot stage

### Pilot
- **Length:** 30 days
- **Cost:** Free
- **Mode:** Concierge (founder personally onboards)
- **Slots:** 5 before continue/kill decision
- **Success scorecard (all three required):** ≥10 customer messages handled in BCC inbox + ≥5 platform bookings (or ≥ baseline÷12 if baseline is small) + clinic verbally agrees to continue
- **Graduation:** Month-to-month at $397/mo single-location, $197/mo per added location, 15% annual discount, flat-rate messaging up to 5K/mo

### Two-metric dashboard
1. **Bookings captured** — every booking that flowed through BCC during the period
2. **Bookings that would have been missed without BCC** — the subset matching the rule below

**Attribution reasons (literal contract — use these exact strings):**
- `WAITLIST_MATCH` — booking has a `WaitlistEntry.bookingId` pointer
- `AI_BOOKING` — `Booking.source = 'AI'`
- `QUOTE_FOLLOWUP` — booking traces back to a QuoteFollowupAgent action card
- `CONSULT_FOLLOWUP` — booking is a treatment within 14 days of a consult that had no scheduled treatment
- `AFTER_HOURS_AI` — inbound channel message arrived outside `Business.businessHours` and AI drafted a reply
- `UNANSWERED_THRESHOLD` — inbound channel message went unanswered for >15 minutes (using `Conversation` first-message vs first-staff-reply timestamps) before AI drafted
- `ORGANIC` — none of the above (counts as captured but not "would have been missed")

`wouldHaveBeenMissed` is derived: `attributionReason !== 'ORGANIC' AND voidedAt IS NULL`.

**Decision on `BookingSource`:** Do NOT add `WAITLIST` to the union. Derive waitlist matches from `WaitlistEntry.bookingId IS NOT NULL`.

**Decision on existing `FrontDeskAttribution` columns:** Keep the existing `source` (e.g. `'AI_DRAFT'`), `status` (`OPEN/BOOKED/WON/LOST`), `reason`, `estimatedValue` columns for backward-compat — they will become legacy/funnel-view fields. Add the v3 fields (`attributionReason`, `wouldHaveBeenMissed`, `voidedAt`, `revenueAtBooking`) alongside. The dashboard reads only the v3 fields. Existing AI-draft-attribution rows (no real customers yet, just dev/seed data) will simply not have the new fields populated — they're effectively orphaned but harmless.

**Other rules:**
- Revenue dollar = total paid (service + add-ons + tip)
- Cancellation/no-show **voids** the attribution (set `voidedAt = now`)
- Fresh attribution if same customer's previous attribution was voided OR booking date is 60+ days later
- No manual staff override
- Pre-pilot baseline captured during concierge call, recorded in `Business.baselineMonthlyBookings/Revenue`
- Dashboard visible to clinic AND BCC

### Compliance posture
- **Non-HIPAA, non-PHI** at launch
- Clinical features removed from schema (not just hidden): `MedicalRecord`, `ClinicalPhoto`, `PhotoComparison`, all `Aftercare*` models, medical intake fields, all clinical UI components
- `TreatmentPlan` model **kept** (just service packages, no medical detail)
- `TreatmentSession` model **kept** but `beforePhoto/afterPhoto` FK fields removed
- Public copy: "BCC is non-clinical infrastructure. Your PMS remains the system of record for any patient health information."

### AI architecture (Path A — file-based primary)
- **5 clinic agents** (Waitlist, Retention, Data Hygiene, Scheduling Optimizer, Quote Followup) — bundled into AI Front Desk SKU, customer-facing
- **15 file-based marketing prompts** in `agents/` — canonical for BCC's own marketing operations
- **12 in-app marketing agents** in `apps/api/src/modules/marketing-agent/` — kept in code but **dormant** (`AgentConfig.isEnabled = false`). Deferred until past 5 paying clinics + a marketing hire.
- **Future "AI Marketing Manager" product** is distinct — not yet built

### Operational
- Solo founder, bootstrapped, no fundraise
- Pilot application notifications → `farz@businesscommandcentre.com`
- Outbound email sender → `EMAIL_FROM=hello@businesscommandcentre.com` (must verify DKIM/SPF before first send)
- Sales motion: cold email/DM (no LinkedIn) + SEO + paid ads
- Demo format: live 1:1 video + async loom; combined discovery+demo call

---

## Phase 0 — Preflight: handle untracked working tree

There are 7+ untracked files at the repo root from prior planning sessions. Triage them before any `git mv` operations later.

**Untracked at root (verified):** `BCC-PIVOT-MASTER-PLAN.md`, `Campaigns-Co-Testing-Plan.md`, `Campaigns-Implementation-Plan.md`, `HANDOFF-BCC-WEDGE.md`, `HANDOFF-DOCS-PIVOT.md`, `deposit-payment-link-plan.md`, `self-review-loop-skill.md`, plus several `*.docx` analyses.

**Recommended disposition:**
- `BCC-PIVOT-MASTER-PLAN.md` → commit at root (this doc; the source of truth for the pivot)
- `HANDOFF-BCC-WEDGE.md`, `HANDOFF-DOCS-PIVOT.md` → commit at root (historical context)
- `Campaigns-Implementation-Plan.md`, `Campaigns-Co-Testing-Plan.md` → will move to `docs/roadmap/` in Phase 11; commit-and-move OR leave untracked until Phase 11 (pick one to avoid `git mv` conflicts)
- `deposit-payment-link-plan.md` → ask the user; if still active roadmap, commit; if shipped, archive
- `self-review-loop-skill.md` → check if duplicate of `.claude/skills/self-review-loop/SKILL.md`; delete if duplicate
- `*.docx` files → ask the user; default is `.gitignore` (binary planning docs don't belong in repo)

**Claude Code prompt for Phase 0:**

```text
Phase 0 of BCC-PIVOT-MASTER-PLAN.md (v3): preflight.

1. cd /Users/farzinhabibpour/Projects/booking-os && git status --short
2. Show me the untracked files. For each, ask the user one of: COMMIT, GITIGNORE, DELETE, MOVE-TO-ARCHIVE-LATER.
3. Apply the user's choices. For files marked COMMIT, git add them. For GITIGNORE, append to .gitignore.
4. Compare self-review-loop-skill.md (root) with .claude/skills/self-review-loop/SKILL.md. If diff is empty or trivial, delete the root copy.
5. git commit -m "Phase 0: Preflight — handle untracked working tree"
```

**Phase 0 done when:** `git status` shows clean working tree (or only the in-progress phase's intentional changes), and we've decided what's tracked.

---

## Phase 1 — Schema: add baseline + attribution fields + practice type

The Prisma models already exist (deployment shipped them). This phase adds the new columns the v3 attribution rule and pilot flow need.

**Tasks:**

1. **In `packages/db/prisma/schema.prisma`, add to `Business`:**
   - `businessHours Json?` (clinic-level open hours; null = always-open / no after-hours rule applies)
   - `baselineMonthlyBookings Int?`
   - `baselineMonthlyRevenue Decimal?`
   - `baselineCapturedAt DateTime?`
   - `baselineSource String? @default("concierge_call")`

2. **Add to `FrontDeskAttribution`:**
   - `attributionReason String?` (one of the 7 contract strings; nullable for back-compat with existing rows)
   - `wouldHaveBeenMissed Boolean @default(false)`
   - `voidedAt DateTime?`
   - `revenueAtBooking Decimal?`
   - **Keep** existing `source`, `status`, `reason`, `estimatedValue` columns. They become legacy/funnel-view fields. v3 dashboard reads only the new fields.
   - Add `bookingId String? @unique` if not already present (Phase 4 wires booking-creation attribution)

3. **Add to `PilotApplication`:**
   - `practiceType String?` (one of `MED_SPA | DERMATOLOGY | PLASTIC_SURGERY | HAIR_RESTORATION | IV_WELLNESS | COSMETIC_DENTISTRY | OTHER`); update the comment listing valid status values to include `WAITLIST_YEAR_2`

4. **Generate migration:** `npx prisma migrate dev --name phase1_add_baseline_attribution_practice_type --schema=packages/db/prisma/schema.prisma`

5. **Regenerate client:** `npx prisma generate --schema=packages/db/prisma/schema.prisma`

6. **Run validation:** `npm run format && npm run format:check && npm run lint && npm test && npm run build`

**Claude Code prompt for Phase 1:**

```text
Phase 1 of BCC-PIVOT-MASTER-PLAN.md (v3): add baseline + v3 attribution + practiceType fields.

Note: Prisma models PilotApplication (schema.prisma:1120) and FrontDeskAttribution (schema.prisma:1150) already exist from deployment ca6b8bc. Do NOT recreate them. Only add fields.

1. In packages/db/prisma/schema.prisma:
   - On model Business: add businessHours Json?, baselineMonthlyBookings Int?, baselineMonthlyRevenue Decimal?, baselineCapturedAt DateTime?, baselineSource String? @default("concierge_call")
   - On model FrontDeskAttribution: add attributionReason String?, wouldHaveBeenMissed Boolean @default(false), voidedAt DateTime?, revenueAtBooking Decimal?. Keep existing source/status/reason/estimatedValue/bookingId columns untouched.
   - On model PilotApplication: add practiceType String?. In the status comment, document that WAITLIST_YEAR_2 is now a valid value.

2. npx prisma migrate dev --name phase1_add_baseline_attribution_practice_type --schema=packages/db/prisma/schema.prisma
3. npx prisma generate --schema=packages/db/prisma/schema.prisma

4. npm run format && format:check && lint && test && build. Fix all failures.

5. git add -A && git commit -m "Phase 1: Add baseline + v3 attribution fields + practiceType"
```

**Phase 1 done when:** Prisma client exposes the new fields, migration applied, build green.

---

## Phase 2 — Cleanup: clinical removal, GENERAL pack, agent-config bug

Remove what we're not building. Component deletion and page-level import removal happen in the same phase to prevent build breaks.

**Tasks:**

1. **Remove `GENERAL` from `packages/shared/src/enums.ts:75`** (`VerticalPack` enum).

2. **Update demo seed scripts** to use `'aesthetic'`:
   - `packages/db/src/seed-console.ts:19`
   - `packages/db/src/seed-console-showcase.ts:24, 59, 72, 85, 98`
   - Search all `packages/db/src/` for any other `verticalPack.*general` and update

3. **Remove clinical Prisma models** from `schema.prisma`:
   - `MedicalRecord` (line 1674)
   - `ClinicalPhoto` (line 1708)
   - `PhotoComparison` (line 1737)
   - `AftercareProtocol` (line 1805)
   - `AftercareStep` (line 1825)
   - `AftercareEnrollment` (line 1842)
   - `AftercareMessage` (line 1860)
   
   On `TreatmentSession`: drop `beforePhoto` and `afterPhoto` FK fields, keep the model.
   
   Generate migration: `npx prisma migrate dev --name phase2_remove_clinical_models`. Use `ON DELETE CASCADE` or pre-clean.

4. **Delete clinical UI components** (and their `.test.tsx` siblings):
   - `apps/web/src/components/aesthetic/medical-alert-banner.tsx`
   - `apps/web/src/components/aesthetic/medical-history-diff.tsx`
   - `apps/web/src/components/aesthetic/medical-history-form.tsx`
   - `apps/web/src/components/aesthetic/photo-comparison-viewer.tsx`
   - `apps/web/src/components/aesthetic/photo-gallery.tsx`
   - `apps/web/src/components/aesthetic/photo-timeline.tsx`
   - `apps/web/src/components/aesthetic/photo-upload-card.tsx`
   - Plus aftercare components in same directory: `aftercare-enrollment-card.tsx`, `aftercare-portal-view.tsx`, `aftercare-protocol-editor.tsx` (verify presence and delete + their tests)

5. **Update `apps/web/src/app/(protected)/customers/[id]/page.tsx`** — remove imports of `MedicalAlertBanner`, `PhotoUploadCard`, `PhotoGallery`, `PhotoComparisonViewer`, `PhotoTimeline` (lines 38, 42-45) and any sections that render them. Keep the page; just remove the clinical sections.

6. **Search for other consumers:** `grep -rn "from.*aesthetic/photo\|from.*aesthetic/medical\|from.*aesthetic/aftercare" apps/web/src/app/`. Remove imports and dead pages. Likely candidates: `apps/web/src/app/(protected)/aftercare/*` (delete the directory), `apps/web/src/app/portal/aftercare/*` if present.

7. **Remove API modules:** `apps/api/src/modules/aftercare/*` directory. Unregister from `apps/api/src/app.module.ts`. Remove any controller/route references to medical records or clinical photos.

8. **Fix `apps/api/src/modules/agent-config/agent-config.service.ts:20-33`** — replace the legacy filter list (`'BlogWriter'`, `'SocialCreator'`, etc.) with current `MKT_*` IDs from `apps/api/src/modules/marketing-agent/agents/`:
   - `MKT_BLOG_WRITER`, `MKT_SOCIAL_CREATOR`, `MKT_EMAIL_COMPOSER`, `MKT_CASE_STUDY`, `MKT_VIDEO_SCRIPT`, `MKT_NEWSLETTER`, `MKT_SCHEDULER`, `MKT_PUBLISHER`, `MKT_PERF_TRACKER`, `MKT_TREND_ANALYZER`, `MKT_CALENDAR_PLANNER`, `MKT_ROI_REPORTER`

9. **Update or delete tests** that reference deleted entities. Build MUST pass before committing this phase.

**Claude Code prompt for Phase 2:**

```text
Phase 2 of BCC-PIVOT-MASTER-PLAN.md (v3): cleanup.

Critical: handle component deletion AND page-level import removal in this phase. Build must be green before commit.

1. packages/shared/src/enums.ts:75 — remove GENERAL from VerticalPack enum (keep AESTHETIC).

2. Update demo seeds:
   - packages/db/src/seed-console.ts:19 (verticalPack: 'general' → 'aesthetic')
   - packages/db/src/seed-console-showcase.ts (lines 24, 59, 72, 85, 98)
   - grep -rn "verticalPack.*general" packages/db/src/ — fix any remaining

3. In packages/db/prisma/schema.prisma, remove these models:
   MedicalRecord (~line 1674), ClinicalPhoto (~1708), PhotoComparison (~1737), AftercareProtocol (~1805), AftercareStep (~1825), AftercareEnrollment (~1842), AftercareMessage (~1860).
   On TreatmentSession: drop beforePhoto and afterPhoto fields.
   
   Generate migration: npx prisma migrate dev --name phase2_remove_clinical_models. Then prisma generate.

4. Delete files (each + its .test.tsx):
   apps/web/src/components/aesthetic/medical-alert-banner.tsx
   apps/web/src/components/aesthetic/medical-history-diff.tsx
   apps/web/src/components/aesthetic/medical-history-form.tsx
   apps/web/src/components/aesthetic/photo-comparison-viewer.tsx
   apps/web/src/components/aesthetic/photo-gallery.tsx
   apps/web/src/components/aesthetic/photo-timeline.tsx
   apps/web/src/components/aesthetic/photo-upload-card.tsx
   apps/web/src/components/aesthetic/aftercare-enrollment-card.tsx (if present)
   apps/web/src/components/aesthetic/aftercare-portal-view.tsx (if present)
   apps/web/src/components/aesthetic/aftercare-protocol-editor.tsx (if present)

5. Edit apps/web/src/app/(protected)/customers/[id]/page.tsx — remove imports at lines 38, 42-45 and the JSX sections that render the deleted clinical components. Keep the page; clinical sections only.

6. grep -rn "from.*aesthetic/photo\|from.*aesthetic/medical\|from.*aesthetic/aftercare" apps/web/src/app/ — for each hit, remove import and any dependent JSX. Delete pages that become empty (likely apps/web/src/app/(protected)/aftercare/*).

7. Remove apps/api/src/modules/aftercare/ entirely. Unregister from apps/api/src/app.module.ts.

8. apps/api/src/modules/agent-config/agent-config.service.ts:20-33 — replace legacy names ('BlogWriter', etc.) with current MKT_* IDs (12 listed in BCC-PIVOT-MASTER-PLAN.md v3 Phase 2 task 8).

9. npm run format && format:check && lint && test && build. Fix every failure. Build MUST be green before commit.

10. git add -A && git commit -m "Phase 2: Remove clinical features, GENERAL pack, fix agent-config filter"
```

**Phase 2 done when:** Build green, no orphaned imports, demo seeds clean, agent-config filter uses MKT_* IDs.

---

## Phase 3 — Pilot acceptance flow

**Tasks:**

1. **In `apps/api/src/modules/pilot-application/pilot-application.service.ts`**, add `acceptApplicationAndProvision(id)` that within `prisma.$transaction`:
   - Fetches the application
   - Creates a `Business` record (name from application, verticalPack='aesthetic', businessHours=null)
   - Creates an Owner-role `Staff` with the applicant's email
   - Generates a password-setup token via `TokenService.create({ kind: 'reset-password' })`
   - Sends "Welcome to your AI Front Desk pilot" email via `EmailService` with the setup link
   - Sets `application.status='ACCEPTED'`, `acceptedBusinessId=newBusiness.id`, `acceptedAt=now`
   - Returns `{ businessId, ownerStaffId, setupTokenSent: true }`
   - Idempotent: re-accepting an ACCEPTED application is a no-op

2. **Add `addToYear2Waitlist(id)`** that sets `application.status='WAITLIST_YEAR_2'` and sends a polite "thanks, we're not yet supporting your practice type" email.

3. **Update `apps/api/src/modules/pilot-application/pilot-application.controller.ts`** with two new endpoints (both `@Roles('SUPER_ADMIN')`):
   - `@Patch(':id/accept')` → calls `acceptApplicationAndProvision`
   - `@Patch(':id/waitlist-year-2')` → calls `addToYear2Waitlist`

4. **Update `apps/admin/src/app/pilot-applications/page.tsx`:**
   - Add "Accept and Provision" button per row (visible when status NEW or CONTACTED, AND `practiceType === 'MED_SPA'`)
   - Add "Add to Year 2 Waitlist" button (visible when status NEW or CONTACTED, AND `practiceType !== 'MED_SPA'`)
   - Show inline success state with link to provisioned business

5. **Create admin baseline page:** `apps/admin/src/app/businesses/[id]/baseline/page.tsx` with a form: monthlyBookings, monthlyRevenue, capturedAt (default now), notes. PATCH endpoint at `/admin/businesses/:id/baseline`.

6. **Create admin pilot health page:** `apps/admin/src/app/businesses/[id]/pilot-health/page.tsx`. Reads from new endpoint `GET /admin/businesses/:id/pilot-health` (which reuses front-desk summary logic but bypasses tenant guard). Shows: messages handled, drafts approved, response time median, captured count + revenue, would-have-been-missed count + revenue, baseline comparison, days into pilot, 3-part scorecard checks.

7. **Tests:**
   - `pilot-application.service.spec.ts`: cover `acceptApplicationAndProvision` happy path, transactional rollback, idempotency, year-2-waitlist
   - Admin pilot-applications page test: provision and waitlist buttons trigger correct API
   - Baseline + pilot-health page tests

**Claude Code prompt for Phase 3:**

```text
Phase 3 of BCC-PIVOT-MASTER-PLAN.md (v3): pilot acceptance flow + baseline + pilot health admin.

1. In apps/api/src/modules/pilot-application/pilot-application.service.ts, add:
   - async acceptApplicationAndProvision(id): wraps Business creation, Owner Staff creation, TokenService password-setup token, EmailService welcome email, and application status update in prisma.$transaction. Idempotent. Returns { businessId, ownerStaffId, setupTokenSent }.
   - async addToYear2Waitlist(id): sets status='WAITLIST_YEAR_2', sends polite email.

2. In apps/api/src/modules/pilot-application/pilot-application.controller.ts, add:
   - @Patch(':id/accept') @Roles('SUPER_ADMIN') accept(id) → service.acceptApplicationAndProvision
   - @Patch(':id/waitlist-year-2') @Roles('SUPER_ADMIN') waitlist(id) → service.addToYear2Waitlist

3. Update apps/admin/src/app/pilot-applications/page.tsx:
   - Add "Accept and Provision" button (visible when status in NEW/CONTACTED AND practiceType==='MED_SPA')
   - Add "Add to Year 2 Waitlist" button (visible when status in NEW/CONTACTED AND practiceType !== 'MED_SPA')
   - Show inline success with link to /businesses/:id

4. Create apps/admin/src/app/businesses/[id]/baseline/page.tsx — form: monthlyBookings (int), monthlyRevenue (decimal), capturedAt (datetime, default now), notes (text). On submit PATCH /admin/businesses/:id/baseline.

5. Create endpoint GET /admin/businesses/:id/pilot-health on the API side (in apps/api/src/modules/business/ or new admin module). Reuses front-desk summary logic with SUPER_ADMIN guard instead of TenantGuard.

6. Create apps/admin/src/app/businesses/[id]/pilot-health/page.tsx — fetches the pilot health endpoint. Renders: messages handled, drafts approved, response time median, captured count+revenue, would-have-been-missed count+revenue, baseline comparison, days into pilot, 3-part scorecard (≥10 messages, ≥5 bookings, "continuation conversation logged" toggle).

7. Tests:
   - apps/api/src/modules/pilot-application/pilot-application.service.spec.ts: acceptAndProvision + waitlistYear2 + idempotency + transaction rollback
   - apps/admin/src/app/pilot-applications/page.test.tsx: both buttons work
   - apps/admin/src/app/businesses/[id]/baseline/page.test.tsx
   - apps/admin/src/app/businesses/[id]/pilot-health/page.test.tsx

8. format && lint && test && build. Fix failures.

9. git commit -m "Phase 3: Pilot acceptance flow, baseline, pilot health admin"
```

**Phase 3 done when:** Admin can accept a MED_SPA application and a real Business + Owner Staff exists with credentials emailed; non-MED_SPA goes to year-2 waitlist; baseline and pilot-health admin pages work.

---

## Phase 4 — Two-metric attribution: move from outbound to booking, reshape dashboard

The deployment writes attribution rows from `outbound.service.ts` on AI draft creation. That's the wrong attribution point — per locked decisions, attribution is per-BOOKING (every platform booking is "captured"; a subset is "would have been missed"). Phase 4 moves attribution and reshapes the dashboard.

**Tasks:**

1. **Create `apps/api/src/modules/front-desk/front-desk-attribution.service.ts`** with:
   - `createForBooking(booking, conversation?)` — writes a `FrontDeskAttribution` row tied to the booking, populating `attributionReason`, `wouldHaveBeenMissed`, `revenueAtBooking`. Determines reason via the priority-ordered logic below.
   - `voidForBooking(bookingId)` — sets `voidedAt = now` and `wouldHaveBeenMissed = false` for the existing row.
   - `getSummary(businessId, days)` — returns the v3 dashboard shape (see task 4).

2. **Determination logic, priority-ordered (first match wins):**
   - If `WaitlistEntry.bookingId === booking.id` → `WAITLIST_MATCH`, missed=true
   - If `Booking.source === 'AI'` → `AI_BOOKING`, missed=true
   - If booking traces to a QuoteFollowupAgent action card (via `Booking.actionCardId` or related) → `QUOTE_FOLLOWUP`, missed=true
   - If booking is a TREATMENT within 14 days of a CONSULT for same customer with no scheduled treatment → `CONSULT_FOLLOWUP`, missed=true
   - If conversation exists AND first inbound message arrived outside `Business.businessHours` AND an AI draft exists → `AFTER_HOURS_AI`, missed=true
   - If conversation exists AND first inbound → first staff reply > 15 min AND AI drafted before staff replied → `UNANSWERED_THRESHOLD`, missed=true
   - Otherwise → `ORGANIC`, missed=false

3. **Hook into `apps/api/src/modules/booking/booking.service.ts`:**
   - In `createBooking()` after the Booking insert, within the same transaction, call `frontDeskAttributionService.createForBooking(booking, conversation)`. Pass conversation context if booking originated from one.
   - In booking status update logic, when status transitions to `CANCELLED` or `NO_SHOW`, call `voidForBooking`.

4. **Retire (don't delete) the AI-draft attribution writers** in `apps/api/src/modules/outbound/outbound.service.ts` (lines 82, 212):
   - Comment them out with `// LEGACY: Phase 4 moved attribution to booking-creation hook. Kept commented for one release for safety; remove in next cleanup.`
   - Update the corresponding tests in `outbound.service.spec.ts` to remove the attribution-write expectations.

5. **Reshape `apps/api/src/modules/front-desk/front-desk.service.ts.getSummary()` to return:**
   ```ts
   {
     captured: { count: number, revenue: number },
     wouldHaveBeenMissed: { 
       count: number, 
       revenue: number, 
       byReason: Record<AttributionReason, { count: number, revenue: number }>
     },
     responseTimeMedianMinutes: number | null,
     baseline: { 
       monthlyBookings: number | null, 
       monthlyRevenue: number | null, 
       source: string, 
       capturedAt: Date | null 
     }
   }
   ```
   Update `front-desk.service.spec.ts` accordingly.

6. **Rebuild `apps/web/src/app/(protected)/ai/components/ai-value-kpis.tsx`** for the v3 two-metric shape:
   - Card 1 (large, top): "Bookings captured" — count + revenue in BCC-brand styling
   - Card 2 (sub-callout, beneath): "Of which, would have been missed without BCC" — count + revenue + methodology tooltip
   - Below: 30-day trend sparkline (optional, nice-to-have); baseline comparison if `baselineCapturedAt` is set
   - The current 4-card layout (`leadsCaptured/approvedReplies/bookingsAttributed/estimatedRecoveredRevenue`) is replaced.

7. **Tests:**
   - `front-desk-attribution.service.spec.ts`: all 7 attribution reasons + ORGANIC + void + fresh-after-60-days
   - `front-desk.service.spec.ts`: updated return shape with byReason breakdown
   - `ai-value-kpis.test.tsx`: rewritten for the two-metric layout
   - `outbound.service.spec.ts`: remove legacy attribution-write expectations

**Claude Code prompt for Phase 4:**

```text
Phase 4 of BCC-PIVOT-MASTER-PLAN.md (v3): two-metric attribution; move from outbound→booking; reshape dashboard.

1. Create apps/api/src/modules/front-desk/front-desk-attribution.service.ts with:
   - createForBooking(booking, conversation?) — priority-ordered reason determination per BCC-PIVOT-MASTER-PLAN.md (v3) Phase 4 task 2. Use exact 7 contract strings: WAITLIST_MATCH, AI_BOOKING, QUOTE_FOLLOWUP, CONSULT_FOLLOWUP, AFTER_HOURS_AI, UNANSWERED_THRESHOLD, ORGANIC. Set wouldHaveBeenMissed = (reason !== 'ORGANIC'). Set revenueAtBooking from booking total paid. Persist via prisma.frontDeskAttribution.create.
   - voidForBooking(bookingId) — sets voidedAt=now and wouldHaveBeenMissed=false on the row matching bookingId.
   - getSummary(businessId, days) — returns the v3 shape: { captured: {count, revenue}, wouldHaveBeenMissed: {count, revenue, byReason}, responseTimeMedianMinutes, baseline: {...} }

2. Hook into apps/api/src/modules/booking/booking.service.ts:
   - createBooking(): after the Booking insert, within the same prisma.$transaction, call frontDeskAttributionService.createForBooking. Pass the source conversation.
   - In status update (or wherever Booking.status transitions): when transitioning to CANCELLED or NO_SHOW, call voidForBooking(bookingId).

3. In apps/api/src/modules/outbound/outbound.service.ts:
   - Find the FrontDeskAttribution.create call around line 82 (on AI draft creation) and the FrontDeskAttribution.update call around line 212 (on transition to SENT).
   - Comment them out with: "// LEGACY: Phase 4 moved attribution to booking-creation hook. Remove in next cleanup."
   - Do NOT delete; safe rollback path.

4. Update apps/api/src/modules/outbound/outbound.service.spec.ts: remove expectations for frontDeskAttribution.create/update from the AI draft tests.

5. Update apps/api/src/modules/front-desk/front-desk.service.ts:
   - getSummary() now reads from FrontDeskAttribution rows where bookingId IS NOT NULL (exclude legacy AI-draft rows).
   - Returns the v3 shape (Phase 4 task 5).
   Update front-desk.service.spec.ts accordingly.

6. Rebuild apps/web/src/app/(protected)/ai/components/ai-value-kpis.tsx FROM SCRATCH for two-metric shape:
   - Card 1 (large): "Bookings captured" with count + revenue
   - Card 2 (sub-callout): "Of which, would have been missed without BCC" + methodology tooltip
   - Optional below: 30-day sparkline (use Recharts) and baseline comparison when business.baselineCapturedAt exists
   Use design tokens from apps/web/src/lib/design-tokens.ts (sage-600 for primary number, lavender-600 for the sub-callout).

7. Tests:
   - apps/api/src/modules/front-desk/front-desk-attribution.service.spec.ts: 7 reasons + ORGANIC + void + fresh-after-60-days
   - apps/api/src/modules/front-desk/front-desk.service.spec.ts: updated return shape
   - apps/web/src/app/(protected)/ai/components/ai-value-kpis.test.tsx: rewritten

8. format && lint && test && build. Fix failures.

9. git commit -m "Phase 4: Two-metric attribution — booking hook, dashboard reshape"
```

**Phase 4 done when:** Booking creation writes the attribution row, status changes void it, dashboard renders captured + would-have-been-missed in v3 layout, legacy outbound writers are commented out for safe rollback.

---

## Phase 5 — Public marketing: review, practiceType, DEMO_SCRIPT, blog deletes

Marketing pages were rewritten in `ca6b8bc` but to a draft, not v3-locked text. This phase verifies the pages match the locked positioning, adds the missing `practiceType` form field, rewrites DEMO_SCRIPT.md, and deletes blog posts.

**Tasks:**

1. **Pre-flight check** — review `landing-page.tsx`, `pricing/page.tsx`, `faq/page.tsx`, `(marketing)/privacy/page.tsx`, `(marketing)/terms/page.tsx`, `(marketing)/security/page.tsx` against the Locked decisions reference > Brand and positioning section. Make adjustments only where copy diverges from v3 wedge text. Most should be fine.

2. **Add `practiceType` to pilot form** at `apps/web/src/app/(marketing)/pilot/pilot-application-form.tsx`:
   - Required radio field: `MED_SPA | DERMATOLOGY | PLASTIC_SURGERY | HAIR_RESTORATION | IV_WELLNESS | COSMETIC_DENTISTRY | OTHER`
   - Above the form: banner copy "We're currently piloting with medical spas only. Other practice types are welcome to apply for Year 2 access — we'll add you to the waitlist."
   - Pass `practiceType` in POST body
   - Update DTO at `apps/api/src/modules/pilot-application/dto/create-pilot-application.dto.ts` to require it

3. **Rewrite `DEMO_SCRIPT.md`** as a 12-minute wedge demo. Currently still says "WhatsApp-first operating system for service businesses" (line 129). New demo flow: missed Instagram DM → AI drafts → staff approves → customer books → captured + would-have-been-missed dashboard reflects it.

4. **Delete blog posts** (verify presence first):
   - `apps/web/content/posts/client-retention-strategies-service-businesses.md`
   - `apps/web/content/posts/data-driven-decision-making-small-business.md`
   - `apps/web/content/posts/multi-location-management-challenges.md`
   - `apps/web/content/posts/future-of-ai-service-businesses.md`
   - `apps/web/content/posts/service-industry-trends-2026.md`
   - `apps/web/content/posts/building-multi-tenant-saas-nextjs.md`
   - `apps/web/content/posts/real-time-features-websockets-nestjs.md`

5. **Sweep remaining aesthetic-relevant blog posts**: brand strings + CTAs to `/pilot`. Check each remaining post in `apps/web/content/posts/`.

**Claude Code prompt for Phase 5:**

```text
Phase 5 of BCC-PIVOT-MASTER-PLAN.md (v3): public marketing — practiceType + DEMO_SCRIPT + blog deletes.

1. Pre-flight: read apps/web/src/app/(marketing)/{landing-page,pricing/page,faq/page,privacy/page,terms/page,security/page}.tsx and confirm copy matches BCC-PIVOT-MASTER-PLAN.md (v3) Locked decisions reference > Brand and positioning. Adjust ONLY copy that diverges from v3 wedge text. Don't rewrite from scratch.

2. Update apps/web/src/app/(marketing)/pilot/pilot-application-form.tsx:
   - Add required radio field "practiceType" with values: MED_SPA, DERMATOLOGY, PLASTIC_SURGERY, HAIR_RESTORATION, IV_WELLNESS, COSMETIC_DENTISTRY, OTHER
   - Above form, banner: "We're currently piloting with medical spas only. Other practice types are welcome to apply for Year 2 access — we'll add you to the waitlist."
   - Pass practiceType in POST body

3. Update apps/api/src/modules/pilot-application/dto/create-pilot-application.dto.ts to require practiceType (@IsEnum or @IsIn).

4. Rewrite DEMO_SCRIPT.md as 12-minute wedge demo: missed Instagram DM → AI drafts → staff approves → customer books → captured + would-have-been-missed dashboard reflects it. Replace ALL "WhatsApp-first operating system for service businesses" framing.

5. Delete blog posts (verify each exists first; rm if so):
   apps/web/content/posts/client-retention-strategies-service-businesses.md
   apps/web/content/posts/data-driven-decision-making-small-business.md
   apps/web/content/posts/multi-location-management-challenges.md
   apps/web/content/posts/future-of-ai-service-businesses.md
   apps/web/content/posts/service-industry-trends-2026.md
   apps/web/content/posts/building-multi-tenant-saas-nextjs.md
   apps/web/content/posts/real-time-features-websockets-nestjs.md

6. For remaining apps/web/content/posts/*.md: brand sweep + CTAs to /pilot.

7. Update tests for pilot form + marketing pages where copy changed.

8. format && lint && test && build. Commit: "Phase 5: practiceType + DEMO_SCRIPT rewrite + blog cleanup"
```

**Phase 5 done when:** Pilot form requires practiceType, DEMO_SCRIPT.md is wedge-aligned, 7 blog posts deleted.

---

## Phase 6 — In-app rebrand: nav, AI setup wizard, install prompt, locales

(`ai/settings/page.test.tsx:63` describe-block fix is DONE. Skip.)

**Tasks:**

1. **Reorder navigation:** in `apps/web/src/lib/nav-config.ts` and `mode-config.ts`:
   - Primary: Inbox, AI Front Desk, Calendar, Waitlist, Customers, Bookings
   - Secondary/overflow: Campaigns, Marketing, Invoices, Reports, Performance, Automations
   - Hide Campaigns when `business.campaignsEnabled !== true` (add feature flag if absent)

2. **Verify AI setup wizard** at `apps/web/src/app/(protected)/ai/components/ai-setup-wizard.tsx` matches the 5-step concierge spec (it was rewritten in `ca6b8bc`; confirm or adjust):
   - Connect channels (Instagram, WhatsApp, web chat, SMS, email)
   - Set clinic voice
   - Confirm approval mode ON (`autoReply.enabled=false`)
   - Enable waitlist + cancellation fill
   - Confirm baseline (read from `business.baselineMonthlyBookings`; show, don't edit — set by founder)

3. **Sweep remaining "AI Hub" mentions** (25 hits remain across docs and tests). Use `grep -rn "AI Hub" apps/web/src apps/admin/src` and replace customer-visible. Doc references in `AI-HUB-FIX-PLAN.md` and `AI-Hub-Validation-Report.md` get handled in Phase 11 (renamed/archived).

4. **Suppress mobile install prompt** at `apps/web/src/components/install-prompt.tsx` — gate to `false` with comment `// Capacitor mobile deferred per BCC-PIVOT-MASTER-PLAN.md (v3)`.

5. **Sweep `en.json` and `es.json`** for any remaining "Booking OS" / "AI Hub". (Partial sweep in deployment; verify completeness.)

**Claude Code prompt for Phase 6:**

```text
Phase 6 of BCC-PIVOT-MASTER-PLAN.md (v3): in-app rebrand + nav.

(Skip: the 'AiSettingsPage (AI Hub)' describe block at ai/settings/page.test.tsx:63 is already fixed.)

1. Update apps/web/src/lib/nav-config.ts and mode-config.ts:
   - Primary order: Inbox, AI Front Desk, Calendar, Waitlist, Customers, Bookings
   - Secondary: Campaigns, Marketing, Invoices, Reports, Performance, Automations
   - Hide Campaigns when business.campaignsEnabled !== true (add a featureFlags check; default false during pilot)

2. Verify apps/web/src/app/(protected)/ai/components/ai-setup-wizard.tsx matches the 5-step concierge spec (Phase 6 task 2 in the master plan). Adjust if drifted.

3. grep -rn "AI Hub" apps/web/src apps/admin/src — replace each customer-visible occurrence with "AI Front Desk".

4. Suppress install prompt: apps/web/src/components/install-prompt.tsx → gate to false. Comment: "// Capacitor mobile deferred per BCC-PIVOT-MASTER-PLAN.md (v3)"

5. grep -i "booking os\|AI Hub" apps/web/src/locales/en.json apps/web/src/locales/es.json — replace any remaining occurrences with BCC / AI Front Desk.

6. Update affected tests.

7. format && lint && test && build. Commit: "Phase 6: Nav restructure, AI setup wizard verify, install prompt suppression"
```

---

## Phase 7 — Tier 1 doc rewrites

**Tasks:**
1. `docs/PROJECT_CONTEXT.md` — full rewrite of intro/positioning. Target = US/Canada med spas. Narrative = AI Front Desk wedge.
2. `DESIGN_DOCUMENTATION.md` — rewrite product overview. Remove Salon/Tutoring/GENERAL references.
3. `docs/SALES-DEMO-PLAN.md` — rewrite around the wedge demo (paired with DEMO_SCRIPT.md from Phase 5).
4. `agents/outbound-prospecting.md` — reauthor for med-spa ICP, US/Canada owner-operator, 1-10 locations, $800K-$2.5M revenue, public Instagram presence. CTA = Apply for Pilot.

**Claude Code prompt for Phase 7:**

```text
Phase 7 of BCC-PIVOT-MASTER-PLAN.md (v3): rewrite Tier 1 docs.

1. Rewrite docs/PROJECT_CONTEXT.md: replace intro, target users, product narrative. Use locked content from BCC-PIVOT-MASTER-PLAN.md (v3) Locked decisions reference. Sweep "Booking OS" → "Business Command Centre", "service businesses" → "medical spas", remove all-in-one framing throughout.

2. Rewrite DESIGN_DOCUMENTATION.md product overview section. Remove Salon, Tutoring, GENERAL vertical references. Keep design system unchanged.

3. Rewrite docs/SALES-DEMO-PLAN.md around the wedge: missed-message → AI draft → approval → booking → captured + would-have-been-missed dashboard. 12-minute target. Reference DEMO_SCRIPT.md (rewritten in Phase 5).

4. Rewrite agents/outbound-prospecting.md: ICP = US/Canada owner-operated med spas, 1-10 locations, $800K-$2.5M revenue, public Instagram presence. CTA = Apply for Pilot. No LinkedIn outreach. Use captured + would-have-been-missed proof points.

5. format. Commit: "Phase 7: Rewrite Tier 1 docs for AI Front Desk wedge"
```

---

## Phase 8 — Create eight new docs

Same as v2 — none exist yet.

**Files to create (in order):**
1. `docs/BOOKING-ATTRIBUTION-DEFINITION.md` — 7-reason contract, void scenarios, baseline capture, dashboard methodology
2. `docs/PILOT-OPS.md` — concierge playbook
3. `docs/PILOT-SALES-SCRIPT.md` — pitch + 5 objection responses
4. `docs/COMPLIANCE-POSTURE.md` — non-PHI stance, claim list, BAA decline script
5. `docs/AI-FRONT-DESK-OPERATOR-GUIDE.md` — for clinic staff
6. `docs/PLATFORM-DECOMMISSION-PLAN.md` — feature dispositions table
7. `docs/AI-AGENT-ARCHITECTURE.md` — 5/15/12 boundaries, Path B trigger
8. `docs/BCC-MARKETING-OPERATOR-WORKFLOW.md` — daily/weekly playbook for the file-based growth engine

**Claude Code prompt for Phase 8:**

```text
Phase 8 of BCC-PIVOT-MASTER-PLAN.md (v3): create eight new docs.

Create in order:
1. docs/BOOKING-ATTRIBUTION-DEFINITION.md (use the 7-reason contract verbatim from v3 Locked decisions reference)
2. docs/PILOT-OPS.md
3. docs/PILOT-SALES-SCRIPT.md
4. docs/COMPLIANCE-POSTURE.md
5. docs/AI-FRONT-DESK-OPERATOR-GUIDE.md
6. docs/PLATFORM-DECOMMISSION-PLAN.md
7. docs/AI-AGENT-ARCHITECTURE.md
8. docs/BCC-MARKETING-OPERATOR-WORKFLOW.md

Cross-link the docs. Where content needs founder input, draft conservatively and flag with "TBD — confirm with founder."

git commit -m "Phase 8: Eight new docs for the wedge"
```

---

## Phase 9 — Tier 2 doc sweep

**Files (broaden the sweep target list — `ca6b8bc` introduced new ones):**
- Foundation: `CLAUDE.md`, `AGENTS.md` (749-line file added in deployment), `README.md`
- Reference: `docs/REFERENCE.md`, `docs/CHANNEL-SETUP.md`, `docs/STRIPE-SETUP.md`, `docs/cicd.md`, `DEPLOY.md`, `docs/AI_MARKETING_AGENTS_DAILY_WORKFLOW.md`, `docs/user-stories.md`, `docs/URLS.md`
- New marketing pages from deployment: `apps/web/src/app/(marketing)/privacy/page.tsx`, `terms/page.tsx`, `security/page.tsx` — verify alignment with v3 conservative copy
- Data: `data/evergreen-trends.md` (also narrow to med-spa context)
- Brand: `git mv docs/bookingos-brand-SKILL.md docs/bcc-brand-SKILL.md`, update name + description triggers
- Templates: `design-specs/template-library.md`
- **All 14 remaining `agents/*.md` prompts** (master-orchestrator, content-strategist, blog-writer, social-content-creator, trend-scout, visual-designer, video-producer, publisher, performance-analyst, learning-engine, weekly-maintenance, spanish-localization, community-manager, keyword-strategist) — each gets brand sweep + ICP narrowing + Apply for Pilot CTA
- All 10 `system/*.md` configs
- `packages/web-chat-widget/README.md` — keep `BookingOSChat` JS global (back-compat), add deprecation note
- `docs/STRIPE-SETUP.md` — prepend "Internal-only — public CTA is /pilot" note

**Claude Code prompt for Phase 9:**

```text
Phase 9 of BCC-PIVOT-MASTER-PLAN.md (v3): Tier 2 doc + agent prompts sweep.

For all files in the Phase 9 list (BCC-PIVOT-MASTER-PLAN.md v3):
- Replace customer-facing "Booking OS" → "Business Command Centre"
- Keep internal package/repo refs (@booking-os/*, booking-os repo) as-is
- Replace "service businesses" / "all-in-one" / "operating system for" with med-spa-specific language
- Update CTAs to "Apply for Pilot"
- For agents/*.md (all 14): also narrow ICP to US/Canada med spas, owner-operated, 1–10 locations, $800K–$2.5M revenue
- For system/*.md: brand sweep
- Verify apps/web/src/app/(marketing)/{privacy,terms,security}/page.tsx use conservative copy (no HIPAA/BAA/encrypted-at-rest claims)
- For docs/STRIPE-SETUP.md: prepend "Internal-only configuration. Public CTA is /pilot. Subscription tiers exist for billing only."
- For docs/bookingos-brand-SKILL.md: git mv to docs/bcc-brand-SKILL.md; update name + description triggers
- packages/web-chat-widget/README.md: keep BookingOSChat global, add deprecation note

Verification:
git grep -i "booking os" -- ':!node_modules' ':!archive/' ':!*.lock' ':!packages/*/package*.json' ':!HANDOFF-*.md' ':!BCC-PIVOT-*.md' ':!packages/web-chat-widget/'
Should be near zero hits. Document any intentional remaining (e.g. legacy referent in changelog).

git commit -m "Phase 9: Tier 2 doc sweep + 14 agent prompts + system configs"
```

---

## Phase 10 — Email + Stripe + ops env

(Admin healthcheck route is DONE. Skip that subtask.)

**Tasks:**

1. **Email copy sweep** of `apps/api/src/modules/{onboarding-drip,dunning,email}/`. Brand strings + signoffs only. Add `// TODO: Full rewrite for AI Front Desk wedge — deferred per BCC-PIVOT-MASTER-PLAN.md (v3)` comment block at top of each `.service.ts`.

2. **Update `.env.example`:**
   - Set `EMAIL_FROM="Business Command Centre <hello@businesscommandcentre.com>"` (replacing the current placeholder at line ~61)
   - Set `PILOT_APPLICATION_NOTIFY_EMAIL=farz@businesscommandcentre.com` (currently empty/commented at line ~62)
   - Add: `STRIPE_PRICE_ID_AIFD_MONTHLY=price_xxx`
   - Add: `STRIPE_PRICE_ID_AIFD_ANNUAL=price_xxx`
   - Add: `STRIPE_PRICE_ID_AIFD_ADDL_LOC_MONTHLY=price_xxx`
   - Add: `STRIPE_PRICE_ID_AIFD_ADDL_LOC_ANNUAL=price_xxx`

3. **Update `DEPLOY.md` launch checklist:**
   - DKIM + SPF verified for `businesscommandcentre.com`
   - Stripe products created (4 prices) and env vars updated
   - First pilot graduation tested manually via Stripe Checkout

4. **Update `docs/STRIPE-SETUP.md`** with creation steps for the 4 new prices.

5. **Update `apps/api/src/common/plan-config.ts`**: add `AIFD_MONTHLY` plan entry mapping `STRIPE_PRICE_ID_AIFD_MONTHLY`. Keep existing tier structure for back-compat.

**Claude Code prompt for Phase 10:**

```text
Phase 10 of BCC-PIVOT-MASTER-PLAN.md (v3): email + Stripe + ops env.

(Skip: admin healthcheck route at apps/admin/src/app/api/v1/health/route.ts already exists.)

1. Sweep email templates in apps/api/src/modules/{onboarding-drip,dunning,email}/. Brand only. Add TODO comment at top of each .service.ts: "// TODO: Full rewrite for AI Front Desk wedge — deferred per BCC-PIVOT-MASTER-PLAN.md (v3) Phase 10."

2. Update .env.example:
   - Replace EMAIL_FROM placeholder with: EMAIL_FROM="Business Command Centre <hello@businesscommandcentre.com>"  # Verify DKIM/SPF before first send
   - Set PILOT_APPLICATION_NOTIFY_EMAIL=farz@businesscommandcentre.com (currently empty)
   - Add 4 new Stripe price ID env vars: STRIPE_PRICE_ID_AIFD_MONTHLY, STRIPE_PRICE_ID_AIFD_ANNUAL, STRIPE_PRICE_ID_AIFD_ADDL_LOC_MONTHLY, STRIPE_PRICE_ID_AIFD_ADDL_LOC_ANNUAL

3. Update DEPLOY.md launch checklist with: [ ] DKIM/SPF verified for businesscommandcentre.com; [ ] Stripe products created and env vars updated; [ ] First pilot graduation tested via Stripe Checkout.

4. Update docs/STRIPE-SETUP.md with creation steps for the 4 new prices ($397/mo, $4,050/yr, $197/mo per added loc, ~$2,008/yr per added loc).

5. Update apps/api/src/common/plan-config.ts: add AIFD_MONTHLY entry mapping STRIPE_PRICE_ID_AIFD_MONTHLY. Keep existing tier mappings for back-compat.

6. format && lint && test && build. Commit: "Phase 10: Email + Stripe + ops env for AI Front Desk launch"
```

---

## Phase 11 — Archive cleanup

**Tasks:**
1. `mkdir -p docs/roadmap`
2. `git mv` archive candidates:
   - `AI-HUB-FIX-PLAN.md` → `archive/`
   - `BookingOS_Implementation_Prompts.md` → `archive/`
   - `dashboard-bugs-fix-prompts.md` → `archive/`
   - `referral-claude-code-prompts.md` → `archive/`
   - `reports/customer-validation-2026-03-14.md` → `archive/`
   - `Campaigns-Implementation-Plan.md` → `docs/roadmap/`
   - `Campaigns-Co-Testing-Plan.md` → `docs/roadmap/`
3. Compare `CLAUDE-CODE-PROMPTS.md` (root) vs `archive/CLAUDE-CODE-PROMPTS.md` — if duplicate, `rm` root copy
4. Compare `self-review-loop-skill.md` vs `.claude/skills/self-review-loop/SKILL.md` — if duplicate, `rm` root copy
5. `git mv AI-Hub-Validation-Report.md AI-Front-Desk-Validation-Report.md` and sweep "AI Hub" → "AI Front Desk" inside

**Claude Code prompt for Phase 11:**

```text
Phase 11 of BCC-PIVOT-MASTER-PLAN.md (v3): archive cleanup.

1. mkdir -p docs/roadmap
2. git mv (preserves history):
   AI-HUB-FIX-PLAN.md → archive/
   BookingOS_Implementation_Prompts.md → archive/
   dashboard-bugs-fix-prompts.md → archive/
   referral-claude-code-prompts.md → archive/
   reports/customer-validation-2026-03-14.md → archive/
   Campaigns-Implementation-Plan.md → docs/roadmap/
   Campaigns-Co-Testing-Plan.md → docs/roadmap/

3. Compare CLAUDE-CODE-PROMPTS.md (root) vs archive/CLAUDE-CODE-PROMPTS.md. If duplicate, rm root.
4. Compare self-review-loop-skill.md vs .claude/skills/self-review-loop/SKILL.md. If duplicate, rm root.
5. git mv AI-Hub-Validation-Report.md AI-Front-Desk-Validation-Report.md && sweep "AI Hub" → "AI Front Desk" inside.

git commit -m "Phase 11: Archive cleanup + roadmap directory"
```

---

## Phase 12 — Final validation

**Tasks:**
1. Standard: `npm run format && format:check && lint && test && build`
2. E2E: `cd apps/web && npm run test:e2e`
3. Self-review loop per `.claude/skills/self-review-loop/SKILL.md` — two passes minimum, zero issues final
4. Security review per `.claude/skills/security-review/SKILL.md` — particular attention to:
   - Public `POST /pilot-applications` (rate limit, honeypot, min-time, generic success)
   - `GET /front-desk/summary`, admin endpoints (TenantGuard / SUPER_ADMIN)
   - `acceptApplicationAndProvision` (transactional, token TTL, no token leak in logs)
   - Removed clinical models (no orphaned references)
5. **Brand grep:** `git grep -i "booking os" -- ':!node_modules' ':!archive/' ':!*.lock' ':!packages/*/package*.json' ':!HANDOFF-*.md' ':!BCC-PIVOT-*.md' ':!packages/web-chat-widget/'`
6. **Stale-positioning grep:** `git grep -i "all-in-one\|operating system for service\|hundreds of clinics"` — zero outside `archive/`
7. **End-to-end pilot smoke test (DEV):**
   - Visit landing → click Apply for Pilot → submit form (practiceType=MED_SPA, valid email, consent) → notification email arrives at `farz@businesscommandcentre.com`
   - Admin login → Pilot Applications → "Accept and Provision" → verify Business + Owner Staff created → owner receives credentials email
   - Admin → Business detail → Set Baseline (10 monthly bookings, $4000 monthly revenue)
   - Owner clicks credentials link → sets password → logs into clinic app
   - Owner sees AI Front Desk page → completes 5-step setup wizard → connects test channel → confirms baseline
   - Send test inbound message via mock channel → AI drafts → staff approves → outbound sent → booking created via AI booking flow → FrontDeskAttribution row created with `attributionReason='AI_BOOKING'`, `wouldHaveBeenMissed=true`
   - Dashboard shows captured (1, $X) + would-have-been-missed (1, $X)
   - Cancel the booking → attribution voided → dashboard reflects (captured 1, would-missed 0)
   - Admin → Business → Pilot Health view shows scorecard
8. **Channel round-trip (DEV):** WhatsApp, Instagram, Facebook, SMS, Email, Web Chat — each round-trips a test message
9. **Healthchecks:** API, Web, Admin all return 200

**Claude Code prompt for Phase 12:**

```text
Phase 12 of BCC-PIVOT-MASTER-PLAN.md (v3): final validation.

Execute checks 1-9 from Phase 12 in order. Stop on any failure.

Report each:
- format/lint/test/build status
- E2E pass/fail counts
- Self-review pass count + issues per pass
- Security review findings count
- Brand grep results (count + any unexpected hits)
- Stale-positioning grep results
- End-to-end smoke test (specific steps from Phase 12 task 7)
- Channel round-trip results
- Healthcheck status

When all green:
git push -u origin codex-business-command-centre-wedge

Open PR with description summarizing all phases. Explicitly list known-deferred items:
- Capacitor mobile app deferred (install prompt suppressed)
- Onboarding/dunning email rewrite deferred (sweep only)
- 12 in-app marketing agents dormant (Path A canonical)
- HIPAA path Year 2
- Stripe products require manual creation in Stripe Dashboard before first paid graduation
- Legacy attribution writers in outbound.service.ts commented out (remove next cleanup)

git commit -m "Phase 12: Validation complete — pivot ready for review"
```

**Phase 12 done when:** All checks green, PR opened.

---

## What this plan does NOT cover

- HIPAA upgrade — Year 2; trigger conditions in `docs/COMPLIANCE-POSTURE.md`
- Capacitor mobile rewrite — install prompt suppressed
- In-app marketing agents enablement (Path B) — dormant
- Onboarding/dunning email full rewrite — Phase 10 sweep only
- Trademark filing — recommended once revenue starts
- US domain redirect (`businesscommandcenter.com` US spelling)
- AI Marketing Manager (product #2)
- Full Campaigns roadmap — moved to `docs/roadmap/Campaigns-Implementation-Plan.md`
- Automated pilot graduation in Stripe — manual step until shipped
- Legacy `outbound.service.ts` attribution writers (commented out, not deleted) — remove in next cleanup release

---

## Final reminders for Claude Code

- **Branch:** `codex-business-command-centre-wedge`
- **Internal names preserved:** `@booking-os/*`, repo, DB names, Stripe legacy IDs
- **Conservative compliance copy:** no HIPAA / BAA / PHIPA / "encrypted at rest" claims
- **AI defaults:** drafts on, auto-send off, staff approval required
- **Commit per phase.** Don't bundle.
- **If confused, ask the user.** Don't guess.
- **Self-review every phase** per `.claude/skills/self-review-loop/SKILL.md`.

End of master plan v3.
