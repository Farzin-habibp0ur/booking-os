# Patient Referral System — Claude Code Prompts

Execute these 6 prompts in order. Each prompt is self-contained and depends on the previous one completing successfully. Run all pre-commit checks after each prompt before moving to the next.

---

## Prompt 1 of 6: Database Schema Migration

```
We are replacing the B2B referral system with a B2C patient referral system. This prompt handles only the Prisma schema changes and migration.

### Step 1: Remove B2B referral fields from Business model

In `packages/db/prisma/schema.prisma`, find the Business model (starts around line 10). Remove these three fields:
- `referralCode String? @unique` (around line 68)
- `referralsGiven Referral[] @relation("ReferrerBusiness")` (around line 71)
- `referralsReceived Referral[] @relation("ReferredBusiness")` (around line 72)

### Step 2: Delete the B2B Referral model

Delete the entire `model Referral { ... }` block (around lines 1304-1323, mapped to `@@map("referrals")`).

### Step 3: Add referralCode to Customer model

In the Customer model (starts around line 162), add this field alongside the other String? fields:
```prisma
referralCode        String?   @unique
```

### Step 4: Create new models

Add these three new models to schema.prisma (place them after the existing models, before the end of the file):

```prisma
model CustomerReferral {
  id                  String    @id @default(cuid())
  businessId          String
  referrerCustomerId  String
  referredCustomerId  String?
  referralCode        String
  status              String    @default("PENDING") // PENDING, COMPLETED, EXPIRED, CANCELLED
  referrerCreditAmount Float
  refereeCreditAmount  Float
  completedAt         DateTime?
  expiresAt           DateTime?
  bookingId           String?   @unique
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  business            Business  @relation(fields: [businessId], references: [id])
  referrerCustomer    Customer  @relation("ReferrerCustomer", fields: [referrerCustomerId], references: [id])
  referredCustomer    Customer? @relation("ReferredCustomer", fields: [referredCustomerId], references: [id])
  booking             Booking?  @relation(fields: [bookingId], references: [id])

  @@unique([businessId, referrerCustomerId, referredCustomerId])
  @@index([businessId])
  @@index([referrerCustomerId])
  @@index([referredCustomerId])
  @@index([referralCode])
  @@index([businessId, status])
  @@map("customer_referrals")
}

model CustomerCredit {
  id              String    @id @default(cuid())
  businessId      String
  customerId      String
  amount          Float
  remainingAmount Float
  source          String    // REFERRAL_GIVEN, REFERRAL_RECEIVED, MANUAL
  referralId      String?
  expiresAt       DateTime?
  redeemedAt      DateTime?
  createdAt       DateTime  @default(now())

  business        Business  @relation(fields: [businessId], references: [id])
  customer        Customer  @relation(fields: [customerId], references: [id])
  referral        CustomerReferral? @relation(fields: [referralId], references: [id])
  redemptions     CreditRedemption[]

  @@index([businessId, customerId])
  @@index([customerId, source])
  @@index([expiresAt])
  @@map("customer_credits")
}

model CreditRedemption {
  id              String    @id @default(cuid())
  creditId        String
  bookingId       String
  amount          Float
  createdAt       DateTime  @default(now())

  credit          CustomerCredit @relation(fields: [creditId], references: [id])
  booking         Booking        @relation(fields: [bookingId], references: [id])

  @@index([creditId])
  @@index([bookingId])
  @@map("credit_redemptions")
}
```

### Step 5: Add relations to existing models

**Customer model** — add these relation fields:
```prisma
referralsGiven      CustomerReferral[] @relation("ReferrerCustomer")
referralsReceived   CustomerReferral[] @relation("ReferredCustomer")
credits             CustomerCredit[]
```

**Business model** — add these relation fields (replacing the deleted ones):
```prisma
customerReferrals   CustomerReferral[]
customerCredits     CustomerCredit[]
```

**Booking model** (starts around line 247) — add these relation fields:
```prisma
referral            CustomerReferral?
creditRedemptions   CreditRedemption[]
```

### Step 6: Generate and run migration

```bash
npx prisma generate --schema=packages/db/prisma/schema.prisma
npx prisma migrate dev --name patient_referral_system --schema=packages/db/prisma/schema.prisma
```

### Step 7: Verify

Run `npx prisma generate --schema=packages/db/prisma/schema.prisma` to confirm the client generates cleanly. Then run `npm run lint` from the repo root to catch any type errors caused by removing the old Referral model references. DO NOT fix the lint errors from the referral module files yet — those will be rewritten in Prompt 2. Just make sure the schema itself is valid.

### Pre-commit checks
Run: `npm run format && npm run format:check && npm run lint && npm test`
Fix any failures before proceeding to Prompt 2. Note: the existing `referral.service.ts` and `referral.service.spec.ts` tests WILL fail because they reference the old B2B Referral model. That's expected — comment out or skip the failing tests for now (they get fully replaced in Prompt 2).
```

---

## Prompt 2 of 6: Backend — Referral & Credit Services + Controllers

```
We are rewriting the referral module from B2B to B2C patient referrals. The Prisma schema migration from Prompt 1 is complete. Now rewrite the entire backend referral module.

### Step 1: Delete all existing referral module files

Delete everything in `apps/api/src/modules/referral/` and recreate from scratch. The old service referenced `Business.referralCode` and `prisma.referral` (the B2B model) — all of that is gone now.

### Step 2: Create `apps/api/src/modules/referral/referral.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralPublicController } from './referral-public.controller';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';

@Module({
  controllers: [ReferralController, ReferralPublicController],
  providers: [ReferralService, CreditService],
  exports: [ReferralService, CreditService],
})
export class ReferralModule {}
```

### Step 3: Create `apps/api/src/modules/referral/credit.service.ts`

Implement CreditService with these methods:

- `issueCredit({ businessId, customerId, amount, source, referralId?, expiryMonths })` — Creates a CustomerCredit record with `remainingAmount = amount` and `expiresAt` calculated from `expiryMonths`. Source is one of: `REFERRAL_GIVEN`, `REFERRAL_RECEIVED`, `MANUAL`.

- `getAvailableCredits(customerId, businessId)` — Returns non-expired credits where `remainingAmount > 0`, ordered by `expiresAt ASC` (oldest first for FIFO). Returns `{ total: number, credits: CustomerCredit[] }`.

- `redeemCredit({ customerId, businessId, bookingId, amount })` — FIFO redemption: iterate through available credits oldest-first, create CreditRedemption records, decrement `remainingAmount` on each credit. If the requested amount exceeds available credits, throw `BadRequestException`. Returns the array of CreditRedemption records created. Use a Prisma transaction for atomicity.

- `expireCredits()` — Decorated with `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`. Finds all CustomerCredit records where `expiresAt < now()` AND `remainingAmount > 0`, sets `remainingAmount = 0`. Returns count of expired credits. Log the count.

### Step 4: Create `apps/api/src/modules/referral/referral.service.ts`

Implement ReferralService with these methods:

- `getOrCreateReferralCode(customerId, businessId)` — Looks up Customer.referralCode. If null, generates an 8-char alphanumeric code (use `randomBytes(6).toString('base64url').slice(0, 8).toUpperCase()`), saves it to the customer, returns the code. Validate that the customer belongs to this business.

- `getReferralLink(customerId, businessId)` — Gets the code, then returns `${webUrl}/book/${businessSlug}?ref=${code}`. Look up the business slug from `Business.slug`. Use `ConfigService` to get `WEB_URL` or derive from `CORS_ORIGINS` (same pattern as the old service's `getWebUrl()`).

- `trackReferralClick(referralCode, businessSlug)` — Validates the referral code exists and belongs to a customer of this business. Returns `{ valid: true, referrerName, businessName, creditAmount }` where creditAmount comes from the business's packConfig.referral.refereeCredit (default 25). If invalid, returns `{ valid: false }`.

- `createPendingReferral(referralCode, referredCustomerId, businessId)` — Creates a CustomerReferral record with status PENDING. Sets `referrerCreditAmount` and `refereeCreditAmount` from packConfig. Validates: referral code exists, not self-referral, cap not exceeded (check `maxReferralsPerCustomer` in packConfig — 0 means unlimited). Returns the created referral.

- `completeReferral(bookingId)` — Called when a booking transitions to COMPLETED. Looks up if this booking has an associated CustomerReferral with status PENDING. If yes: update status to COMPLETED, set completedAt, issue credits to BOTH customers via CreditService.issueCredit() (referrer gets referrerCreditAmount with source REFERRAL_GIVEN, referee gets refereeCreditAmount with source REFERRAL_RECEIVED). Set expiryMonths from packConfig.referral.creditExpiryMonths (default 6). Log the completion.

- `getReferralSettings(businessId)` — Read from Business.packConfig.referral with these defaults: `{ enabled: true, referrerCredit: 25, refereeCredit: 25, maxReferralsPerCustomer: 0, creditExpiryMonths: 6, messageTemplate: "Hi! I love {businessName}. Book your first appointment with my link and we both get ${creditAmount} off: {referralLink}", emailSubject: "You've been referred to {businessName}!" }`

- `updateReferralSettings(businessId, dto)` — Deep-merge into Business.packConfig.referral (same pattern as old service — read current packConfig, merge referral key, write back).

- `getReferralStats(businessId)` — Returns: totalReferrals, completedReferrals, pendingReferrals, totalCreditsIssued (sum of all CustomerCredit amounts for this business where source starts with REFERRAL_), totalCreditsRedeemed (sum of CreditRedemption amounts), and a list of recent referrals with referrer/referred customer names and statuses.

- `getCustomerReferralInfo(customerId, businessId)` — Returns: referralCode, referralLink, totalReferrals (given), creditsEarned, creditsRemaining (from CreditService.getAvailableCredits), list of referrals given.

**Vertical guard:** Add a private method `assertReferralVertical(businessId)` that checks `business.verticalPack` is `AESTHETIC` or `WELLNESS`. Throw `ForbiddenException('Referral program is only available for Aesthetic and Wellness verticals')` otherwise. Call this at the start of all public-facing methods.

### Step 5: Create DTOs

**`dto/update-referral-settings.dto.ts`:**
```typescript
import { IsOptional, IsBoolean, IsNumber, IsString, Min, Max } from 'class-validator';

export class UpdateReferralSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsNumber() @Min(5) @Max(500) referrerCredit?: number;
  @IsOptional() @IsNumber() @Min(5) @Max(500) refereeCredit?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) maxReferralsPerCustomer?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(12) creditExpiryMonths?: number;
  @IsOptional() @IsString() messageTemplate?: string;
  @IsOptional() @IsString() emailSubject?: string;
}
```

**`dto/redeem-credit.dto.ts`:**
```typescript
import { IsString, IsNumber, Min } from 'class-validator';

export class RedeemCreditDto {
  @IsString() bookingId: string;
  @IsNumber() @Min(0.01) amount: number;
}
```

### Step 6: Create `apps/api/src/modules/referral/referral.controller.ts`

Staff/admin endpoints — all guarded with `AuthGuard('jwt')`, `TenantGuard`, `RolesGuard` with `@Roles('ADMIN')`:

```
GET    /referral/stats                    → getReferralStats(businessId)
GET    /referral/settings                 → getReferralSettings(businessId)
PATCH  /referral/settings                 → updateReferralSettings(businessId, dto)
GET    /referral/customers/:customerId    → getCustomerReferralInfo(customerId, businessId)
```

### Step 7: Create `apps/api/src/modules/referral/referral-public.controller.ts`

Public/unauthenticated endpoints (no auth guards):

```
GET    /public/referral/validate/:code    → validateReferralCode(code, query.slug)
// Returns { valid, referrerName?, businessName?, creditAmount? }
```

Portal-authenticated endpoints (these will use portal auth — for now, just add the endpoints with basic validation, no auth guard since portal auth is handled differently):

```
GET    /portal/referral                   → getCustomerReferralInfo(query.customerId, query.businessId)
GET    /portal/referral/credits           → getAvailableCredits(query.customerId, query.businessId)
```

### Step 8: Hook into booking completion

In `apps/api/src/modules/booking/booking.service.ts`, find the `updateStatus` method. After the existing COMPLETED side effects (around line 822 — after the follow-up reminder is created), add:

```typescript
// Complete referral if this booking was referred
try {
  await this.referralService.completeReferral(id);
} catch (err) {
  this.logger.warn(`Failed to process referral completion for booking ${id}`, {
    error: (err as Error).message,
  });
}
```

This requires:
1. Import ReferralService in booking.service.ts
2. Add ReferralService to the constructor injection
3. Import ReferralModule in booking.module.ts

Use the same try-catch-log pattern as the other side effects in that method (calendarSync, waitlist, package unredeem, etc.). The referral completion should never block or fail the booking status update.

### Step 9: Remove ReferralModule from auth.module.ts

In `apps/api/src/modules/auth/auth.module.ts`:
- Remove line 12: `import { ReferralModule } from '../referral/referral.module';`
- Remove `ReferralModule` from the imports array (line 17)

Then check `apps/api/src/modules/auth/auth.service.ts` — search for any usage of `ReferralService` (like tracking referral codes during signup). Remove that B2B referral tracking logic. The signup flow should no longer handle `?ref=` codes — that's now handled by the booking portal.

### Step 10: Clean up billing module

In `apps/api/src/modules/billing/billing.module.ts`:
- Remove line 6: `import { ReferralModule } from '../referral/referral.module';`
- Remove `ReferralModule` from the imports array (line 9)

Then check `apps/api/src/modules/billing/billing.service.ts` — search for any usage of `ReferralService` (like `convertReferral`). Remove the B2B referral credit logic tied to Stripe customer balance transactions. The new credit system is internal (CustomerCredit model), not Stripe balance credits.

### Pre-commit checks
Run: `npm run format && npm run format:check && npm run lint && npm test`
Fix all failures. Write basic unit tests for the new services: `referral.service.spec.ts`, `credit.service.spec.ts`, `referral.controller.spec.ts`, `referral-public.controller.spec.ts`. Mock PrismaService and ConfigService. Test success paths and error paths (invalid codes, self-referral, cap exceeded, insufficient credits, vertical guard).
```

---

## Prompt 3 of 6: Automation Triggers

```
Add two new automation triggers for the patient referral system: REFERRAL_EARNED and REFERRAL_REDEEMED.

### Step 1: Add trigger entries to workflow sidebar

In `apps/web/src/components/workflow/workflow-sidebar.tsx`:

1. Add `Gift` to the lucide-react import (line 2 area — find the existing import from 'lucide-react' and add Gift to it).

2. Add two new entries to the `TRIGGER_BLOCKS` array (around line 36-44, after the existing entries but before the closing `]`):

```typescript
{ type: 'TRIGGER', subtype: 'REFERRAL_EARNED', label: 'Referral Credit Earned', icon: Gift },
{ type: 'TRIGGER', subtype: 'REFERRAL_REDEEMED', label: 'Referral Credit Redeemed', icon: Gift },
```

### Step 2: Add trigger handlers to automation executor

In `apps/api/src/modules/automation/automation-executor.service.ts`:

Find the switch statement that handles triggers (starts around line 87). Before the `default:` case (around line 215), add two new cases:

```typescript
case 'REFERRAL_EARNED': {
  // Find recent CustomerCredit records created in the last 2 minutes with referral source
  const credits = await this.prisma.customerCredit.findMany({
    where: {
      businessId: rule.businessId,
      createdAt: { gte: twoMinutesAgo },
      source: { in: ['REFERRAL_GIVEN', 'REFERRAL_RECEIVED'] },
    },
    include: { customer: true },
  });
  for (const credit of credits) {
    if (hasSteps) {
      await this.startStepExecution(
        rule,
        steps,
        credit.businessId,
        undefined,
        credit.customerId,
        credit,
      );
    } else {
      await this.executeActions(
        rule,
        actions,
        credit.businessId,
        undefined,
        credit.customerId,
      );
    }
  }
  break;
}
case 'REFERRAL_REDEEMED': {
  // Find recent CreditRedemption records created in the last 2 minutes
  const redemptions = await this.prisma.creditRedemption.findMany({
    where: {
      createdAt: { gte: twoMinutesAgo },
      credit: { businessId: rule.businessId },
    },
    include: { credit: { include: { customer: true } }, booking: true },
  });
  for (const redemption of redemptions) {
    if (hasSteps) {
      await this.startStepExecution(
        rule,
        steps,
        redemption.credit.businessId,
        redemption.bookingId,
        redemption.credit.customerId,
        redemption,
      );
    } else {
      await this.executeActions(
        rule,
        actions,
        redemption.credit.businessId,
        redemption.bookingId,
        redemption.credit.customerId,
      );
    }
  }
  break;
}
```

### Step 3: Update automation executor tests

In `apps/api/src/modules/automation/automation-executor.service.spec.ts`, add test cases for both new triggers. Mock `prisma.customerCredit.findMany` and `prisma.creditRedemption.findMany`. Test that:
- REFERRAL_EARNED triggers executeActions for each matching credit
- REFERRAL_REDEEMED triggers executeActions for each matching redemption
- Both triggers work with step-based execution

### Step 4: Update workflow sidebar test

If there's a test file for `workflow-sidebar.tsx`, update it to include `Gift` in the lucide-react mock and verify the two new trigger entries render.

### Pre-commit checks
Run: `npm run format && npm run format:check && npm run lint && npm test`
Fix all failures before proceeding.
```

---

## Prompt 4 of 6: Frontend — Admin Settings Redesign + Marketing Hub + Customer Detail

```
Redesign the admin-facing referral UI. The backend from Prompts 2-3 is complete.

### Step 1: Redesign `/settings/referral` page

Completely rewrite `apps/web/src/app/(protected)/settings/referral/page.tsx`. The current page is B2B-focused (shows business referral link, single credit amount, business name in referral table). Replace it with a patient referral settings page.

**Keep:** The back link to `/marketing`, the toast import, the overall design system (rounded-2xl cards, shadow-soft, sage/lavender palette, font-serif for headers).

**New interface for settings state:**
```typescript
interface ReferralSettings {
  enabled: boolean;
  referrerCredit: number;
  refereeCredit: number;
  maxReferralsPerCustomer: number;
  creditExpiryMonths: number;
  messageTemplate: string;
  emailSubject: string;
}
```

**New sections (replace existing):**

**Section 1: Enable/Disable Toggle**
- Toggle switch to enable/disable the referral program
- If the business is not AESTHETIC or WELLNESS vertical (check `user.business?.verticalPack`), show a disabled state with message: "Referral program is available for Aesthetic and Wellness verticals"

**Section 2: Reward Configuration**
- Two separate credit amount inputs: "Referrer earns" and "Friend earns" (both $5-$500, step $5, default $25)
- Credit expiry dropdown: 1-12 months (default 6)
- Max referrals per customer: number input (0 = unlimited, default 0)

**Section 3: Referral Message (keep existing pattern)**
- Keep the message template editor with merge vars
- Update merge vars to: `{businessName}`, `{creditAmount}`, `{referralLink}`, `{customerName}`
- Update default template: "Hi! I love {businessName}. Book your first appointment with my link and we both get ${creditAmount} off: {referralLink}"
- Keep the live preview with channel tabs (WhatsApp, SMS, Email)
- Remove the "Sharing Method" radio group section (manual/whatsapp/sms/email) — it's not relevant for patient referrals

**Section 4: Referral Activity**
- Stats row: Total Referrals, Completed, Credits Issued ($), Credits Redeemed ($)
- Table: Referrer name, Referred name (or "Pending"), Status badge (Pending=lavender, Completed=sage, Expired=red), Credit amount, Date
- Fetch from `GET /referral/stats`

**Data fetching:**
- `GET /referral/settings` for settings
- `GET /referral/stats` for activity stats and table
- `PATCH /referral/settings` for save (with try-catch + toast)
- `GET /business` for business info (vertical check, business name for preview)

**Remove:** The "Your Referral Link" section with copy button (that was the B2B link). The referral link is now per-customer, shown in the customer portal — not on the admin settings page.

### Step 2: Update Marketing Hub referral card

In `apps/web/src/app/(protected)/marketing/page.tsx`, update the Referrals card to show a mini-stat pulled from the API. The card currently links to `/settings/referral`. Keep that link. Update the subtitle to show something like "12 referrals this month" if data is available.

Fetch `GET /referral/stats` on the marketing hub page (if not already fetching). Show `totalReferrals` or `completedReferrals` on the referral card.

### Step 3: Add referral credits to customer detail

In `apps/web/src/app/(protected)/customers/[id]/page.tsx`, add a "Referral Credits" section. This should be a small card that shows:
- Available credit balance (fetch from `GET /referral/customers/:customerId`)
- Number of successful referrals
- Referral link (with copy button)

Only show this section for AESTHETIC and WELLNESS verticals. Place it in the sidebar or detail area where other customer info lives.

### Step 4: Update translation keys

Add any new translation keys to both `apps/web/src/locales/en.json` and `apps/web/src/locales/es.json`. Keys to add:
- `settings.referral.enabled_label`: "Enable referral program" / "Habilitar programa de referidos"
- `settings.referral.referrer_credit_label`: "Referrer earns" / "El referidor gana"
- `settings.referral.referee_credit_label`: "Friend earns" / "El amigo gana"
- `settings.referral.expiry_label`: "Credit expires after" / "El crédito expira después de"
- `settings.referral.max_referrals_label`: "Max referrals per customer" / "Máximo de referidos por cliente"
- `settings.referral.unlimited`: "Unlimited" / "Ilimitado"
- `settings.referral.months`: "months" / "meses"
- `settings.referral.vertical_note`: "Referral program is available for Aesthetic and Wellness verticals" / "El programa de referidos está disponible para verticales Estética y Bienestar"
- `settings.referral.activity_title`: "Referral Activity" / "Actividad de referidos"
- `settings.referral.total_referrals`: "Total Referrals" / "Total de referidos"
- `settings.referral.credits_issued`: "Credits Issued" / "Créditos emitidos"
- `settings.referral.credits_redeemed`: "Credits Redeemed" / "Créditos canjeados"

### Pre-commit checks
Run: `npm run format && npm run format:check && npm run lint && npm test`
Fix all failures. Update or create test file `settings/referral/page.test.tsx` — test settings form rendering, vertical guard, save with toast, activity table. Mock the API client.
```

---

## Prompt 5 of 6: Frontend — Customer Portal + Booking Portal + Seed Data

```
Add the patient-facing referral UI: customer portal page and booking portal referral link handling.

### Step 1: Create customer portal referral page

Create `apps/web/src/app/portal/[slug]/referrals/page.tsx`:

This is a new page in the customer portal where patients see their referral link and stats.

**Content:**
- Heading: "Refer a Friend" with Gift icon
- Explanation text: "Share your referral link with friends. When they complete their first appointment, you both get ${referrerCredit} credit."
- Referral link display with copy button (use `navigator.clipboard.writeText`)
- Share button: use `navigator.share` API if available (mobile), fall back to copy on desktop
- Stats cards: Total Referrals, Credits Earned, Credits Available (use sage palette for values)
- List of past referrals with status badges (Pending=lavender, Completed=sage, Expired=red-50/red-700)

**Data fetching:**
- `GET /portal/referral?customerId=X&businessId=Y` for referral info
- `GET /portal/referral/credits?customerId=X&businessId=Y` for available credits

**Design:** Follow the existing portal page patterns. Look at `apps/web/src/app/portal/[slug]/dashboard/page.tsx` for style reference. Use the same card styles (bg-white rounded-2xl shadow-soft p-6), sage palette for positive states, lavender for pending.

### Step 2: Add referrals to portal navigation

In `apps/web/src/app/portal/[slug]/layout.tsx`:

1. Add `Gift` to the lucide-react import (line 7)
2. Add a new entry to the `NAV_ITEMS` array (around line 9-15), after 'book' and before 'invoices':
```typescript
{ key: 'referrals', label: 'Referrals', icon: Gift },
```

Note: For v1, we show the nav item to all portal users. The backend will return empty data for non-applicable verticals. In a future iteration, we can conditionally show it based on the business's vertical.

### Step 3: Handle `?ref=CODE` on public booking page

In `apps/web/src/app/book/[slug]/page.tsx`:

1. On page load, check for `?ref=CODE` in the URL search params.
2. If present, call `GET /public/referral/validate/${code}?slug=${slug}` to validate the code.
3. If the response says `valid: true`, show a banner at the top of the booking page:
   - Banner style: `bg-sage-50 border border-sage-200 rounded-xl p-3 mb-4 flex items-center gap-2`
   - Content: `<Gift size={16} className="text-sage-600" /> Referred by {referrerName} — You'll get ${creditAmount} off your first visit!`
4. Store the referral code in component state.
5. When the booking is submitted (find the booking creation POST call), include `referralCode` in the request body.
6. If the referral code is invalid: silently ignore it — don't show any error, don't show the banner. The patient can still book normally.

### Step 4: Update seed data

Update `packages/db/src/seed-demo.ts` to include referral demo data. Only seed for the Aesthetic (Glow Aesthetic Clinic) and Wellness (Serenity Wellness Spa) demo businesses.

For each of these businesses, create:

**3-5 CustomerReferral records:**
- Pick existing seeded customers as referrers and referred
- Mix of statuses: 2 COMPLETED, 1-2 PENDING, 1 EXPIRED
- Set referrerCreditAmount and refereeCreditAmount to 25

**Corresponding CustomerCredit records:**
- For COMPLETED referrals: create credits for both parties (source: REFERRAL_GIVEN for referrer, REFERRAL_RECEIVED for referred)
- 1 credit partially redeemed (remainingAmount < amount)
- 1 credit expired (expiresAt in the past, remainingAmount = 0)

**1-2 CreditRedemption records:**
- Linked to existing seeded bookings

**Also set referralCode on the customer records** that are referrers (generate 8-char codes).

Follow the existing seed patterns — use `upsert` or `findFirst` checks for idempotency. Guard with `// -- Patient Referral Seed Data --` comment block.

### Step 5: Clean up project root files

Delete the planning files that are no longer needed:
- `REFERRAL-REDESIGN-PLAN.md`
- `BUGFIX-PROMPT.md`

### Pre-commit checks
Run: `npm run format && npm run format:check && npm run lint && npm test`
Fix all failures before proceeding.
```

---

## Prompt 6 of 6: Full Test Suite + Final Verification

```
Write comprehensive tests for the entire patient referral system and run final verification.

### Step 1: Backend tests

**`apps/api/src/modules/referral/referral.service.spec.ts`** — ensure these test cases exist (some may have been created in Prompt 2):
- getOrCreateReferralCode: creates code for new customer, returns existing code
- getReferralLink: returns correct format (book/{slug}?ref={code})
- trackReferralClick: returns valid=true for valid code, valid=false for invalid
- createPendingReferral: creates record, rejects self-referral, enforces cap
- completeReferral: updates status, issues credits to both parties, skips if no referral
- getReferralSettings: returns defaults when no packConfig
- updateReferralSettings: merges into packConfig
- getReferralStats: returns correct counts
- getCustomerReferralInfo: returns customer-specific data
- assertReferralVertical: throws for DEALERSHIP/GENERAL, passes for AESTHETIC/WELLNESS

**`apps/api/src/modules/referral/credit.service.spec.ts`** — ensure these test cases:
- issueCredit: creates record with correct expiresAt
- getAvailableCredits: filters expired, orders by expiresAt ASC
- redeemCredit: FIFO order, creates CreditRedemption, decrements remainingAmount
- redeemCredit: throws when insufficient credits
- redeemCredit: handles partial credit consumption (spans multiple credit records)
- expireCredits: sets remainingAmount=0 on expired credits

**`apps/api/src/modules/referral/referral.controller.spec.ts`** — test:
- Auth guards applied (mock unauthorized → 403)
- Tenant isolation (businessId passed through)
- All 4 endpoints return correct data

**`apps/api/src/modules/referral/referral-public.controller.spec.ts`** — test:
- validate endpoint returns valid/invalid correctly
- No auth required on public endpoints

### Step 2: Frontend tests

**`apps/web/src/app/(protected)/settings/referral/page.test.tsx`** — test:
- Renders settings form with all fields
- Save triggers PATCH with toast feedback
- Vertical guard shows disabled message for non-applicable verticals
- Activity table renders referral data
- Loading state shows FormSkeleton

**`apps/web/src/app/portal/[slug]/referrals/page.test.tsx`** — test:
- Renders referral link with copy button
- Shows stats cards
- Shows referral list with status badges
- Copy button copies link to clipboard

**`apps/web/src/app/(protected)/marketing/page.test.tsx`** — update existing test:
- Verify referral card shows stats from API

### Step 3: Run full test suite

```bash
npm run format && npm run format:check && npm run lint && npm test
```

Fix ANY failures. Common issues to watch for:
- Missing lucide-react icon mocks (add `Gift` to any test file that renders components using it)
- Missing API client mocks for new endpoints
- Type errors from the schema change (old Referral type references)

### Step 4: Final verification checklist

After all tests pass, verify:
1. `npx prisma generate --schema=packages/db/prisma/schema.prisma` succeeds
2. No references to the old B2B `Referral` model remain (search for `referrerBusinessId`, `referredBusinessId`, `Referral[]`, `"referrals"` in the API source — only the new `customer_referrals` table name should exist)
3. No references to `Business.referralCode` remain (it was moved to Customer.referralCode)
4. `npm run format:check` passes
5. `npm run lint` passes
6. `npm test` passes with 0 failures
7. Auth module no longer imports ReferralModule
8. Billing module no longer imports ReferralModule
9. Booking module DOES import ReferralModule (for the completion hook)

### Post-implementation

After all prompts complete and tests pass:
1. Deploy all services (API first, then web)
2. Run `npx tsx packages/db/src/seed-demo.ts` on the production database to seed referral demo data
3. Test the full flow: create a referral link in customer portal → open booking page with ?ref=CODE → verify banner shows → complete a booking → verify credits appear
```
