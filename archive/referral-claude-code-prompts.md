# Referral Feature — Claude Code Implementation Prompts

Execute these prompts in order. Prompts 1 and 2 can run in parallel on separate branches.

---

## Prompt 1: Fix Referral Credit Pipeline (P0 — CRITICAL)

```
Fix the broken referral credit pipeline. There are THREE bugs preventing referral credits from ever being issued:

**Bug A — Field name mismatch:**
The frontend (apps/web/src/app/book/[slug]/page.tsx line 360) sends `{ referralCode: "ABC123" }` but the backend (apps/api/src/modules/public-booking/public-booking.controller.ts line 190) reads `body.ref`. Since `body.ref` is always undefined, `customFields.referralSource` is never set and booking source is always `PORTAL` instead of `REFERRAL`.

**Bug B — Missing pipeline call:**
Even if the field name matched, `PublicBookingController.createBooking()` never calls `referralService.createPendingReferral()`, so `completeReferral()` (called in BookingService on COMPLETED status) always finds zero PENDING records and silently exits. Credits are never issued.

**Bug C — `enabled` flag never checked:**
`createPendingReferral()` in referral.service.ts (line 110) and `trackReferralClick()` (line 80) both parse `settings.enabled` but never check it. If a business disables the referral program via the toggle, old links still work, banners still show, and referrals are still created.

### Changes Required

**1. apps/api/src/modules/public-booking/public-booking.module.ts:**
- Add `ReferralModule` to imports:
```typescript
import { ReferralModule } from '../referral/referral.module';
// Add to imports array:
imports: [ConfigModule, AvailabilityModule, CustomerModule, BookingModule, WaitlistModule, ReferralModule],
```

**2. apps/api/src/modules/public-booking/public-booking.controller.ts:**
- Import and inject `ReferralService`:
```typescript
import { ReferralService } from '../referral/referral.service';
```
- Add to constructor (make it optional to avoid breaking when module isn't loaded):
```typescript
@Optional()
private referralService?: ReferralService,
```
- Import `Optional` from `@nestjs/common`

- Fix the body type — change `ref?: string;` to `referralCode?: string;` (line 190)

- Update ALL references from `body.ref` to `body.referralCode`:
  - Line 219: `if (body.referralCode) customFields.referralSource = body.referralCode;`
  - Line 227: `source: body.referralCode ? 'REFERRAL' : 'PORTAL',`

- After the booking is created (after the `const booking = await this.bookingService.create(...)` call, around line 228), add:
```typescript
// Create pending referral for credit tracking (non-blocking)
if (body.referralCode && this.referralService) {
  this.referralService
    .createPendingReferral(body.referralCode, customer.id, business.id)
    .catch((err) =>
      this.logger.warn(
        `Referral creation failed for booking ${booking.id}: ${err.message}`,
      ),
    );
}
```
- Do NOT change the frontend — it already correctly sends `{ referralCode }`.

**3. apps/api/src/modules/referral/referral.service.ts:**
- In `trackReferralClick()` (line 80), after getting the business and BEFORE looking up the customer, add:
```typescript
const settings = this.parseSettings(business.packConfig);
if (!settings.enabled) return { valid: false };
```
Note: `settings` is already parsed later on line 101 for `creditAmount` — you can move the parse earlier and reuse it, or parse once at the top.

- In `createPendingReferral()` (line 110), after `assertReferralVertical` and BEFORE the referrer lookup, add the enabled check. The settings are already fetched on line 125-130 — restructure to check enabled first:
```typescript
async createPendingReferral(referralCode: string, referredCustomerId: string, businessId: string) {
  await this.assertReferralVertical(businessId);

  const business = await this.prisma.business.findUnique({
    where: { id: businessId },
    select: { packConfig: true },
  });
  const settings = this.parseSettings(business?.packConfig);
  if (!settings.enabled) {
    throw new BadRequestException('Referral program is not active');
  }

  const referrer = await this.prisma.customer.findFirst({
    where: { referralCode, businessId },
  });
  if (!referrer) throw new BadRequestException('Invalid referral code');
  if (referrer.id === referredCustomerId) {
    throw new BadRequestException('Cannot refer yourself');
  }

  // Check max referrals cap
  if (settings.maxReferralsPerCustomer > 0) {
    const count = await this.prisma.customerReferral.count({
      where: { referrerCustomerId: referrer.id, businessId },
    });
    if (count >= settings.maxReferralsPerCustomer) {
      throw new BadRequestException('Maximum referral limit reached');
    }
  }

  // Check duplicate
  const existing = await this.prisma.customerReferral.findFirst({
    where: { businessId, referrerCustomerId: referrer.id, referredCustomerId },
  });
  if (existing) throw new BadRequestException('Referral already exists');

  return this.prisma.customerReferral.create({
    data: {
      businessId,
      referrerCustomerId: referrer.id,
      referredCustomerId,
      referralCode,
      status: 'PENDING',
      referrerCreditAmount: settings.referrerCredit,
      refereeCreditAmount: settings.refereeCredit,
    },
  });
}
```
This replaces the existing `createPendingReferral` method entirely. It removes the redundant second business query that was on lines 125-130.

**4. apps/api/src/modules/public-booking/public-booking.controller.spec.ts:**
The test file needs updating for the new constructor argument and new test cases.

- Add `referralService` mock to `beforeEach`:
```typescript
let referralService: any;
// In beforeEach:
referralService = { createPendingReferral: jest.fn().mockResolvedValue({ id: 'ref1' }) };
```

- Update the controller constructor call to include the 7th argument:
```typescript
controller = new PublicBookingController(
  prisma as any,
  availabilityService,
  customerService,
  bookingService,
  waitlistService,
  configService,
  referralService,
);
```

- Add these new test cases inside `describe('createBooking')`:
```typescript
it('calls createPendingReferral when referralCode provided', async () => {
  prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
  customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
  bookingService.create.mockResolvedValue(mockBooking);

  await controller.createBooking('glow-clinic', {
    serviceId: 'svc1',
    startTime: '2026-03-01T10:00:00Z',
    customerName: 'Jane',
    customerPhone: '+1234567890',
    referralCode: 'VALIDCODE',
  });

  expect(referralService.createPendingReferral).toHaveBeenCalledWith(
    'VALIDCODE',
    'cust1',
    'biz1',
  );
});

it('sets source to REFERRAL when referralCode provided', async () => {
  prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
  customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
  bookingService.create.mockResolvedValue(mockBooking);

  await controller.createBooking('glow-clinic', {
    serviceId: 'svc1',
    startTime: '2026-03-01T10:00:00Z',
    customerName: 'Jane',
    customerPhone: '+1234567890',
    referralCode: 'VALIDCODE',
  });

  expect(bookingService.create).toHaveBeenCalledWith(
    'biz1',
    expect.objectContaining({ source: 'REFERRAL' }),
  );
});

it('booking succeeds even when createPendingReferral throws', async () => {
  prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
  customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
  bookingService.create.mockResolvedValue(mockBooking);
  referralService.createPendingReferral.mockRejectedValue(
    new Error('Referral program is not active'),
  );

  const result = await controller.createBooking('glow-clinic', {
    serviceId: 'svc1',
    startTime: '2026-03-01T10:00:00Z',
    customerName: 'Jane',
    customerPhone: '+1234567890',
    referralCode: 'VALIDCODE',
  });

  // Booking should still succeed
  expect(result.id).toBe('book1');
});

it('does not call createPendingReferral without referralCode', async () => {
  prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
  customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
  bookingService.create.mockResolvedValue(mockBooking);

  await controller.createBooking('glow-clinic', {
    serviceId: 'svc1',
    startTime: '2026-03-01T10:00:00Z',
    customerName: 'Jane',
    customerPhone: '+1234567890',
  });

  expect(referralService.createPendingReferral).not.toHaveBeenCalled();
});
```

- Update the existing `createBooking` tests: the constructor now takes 7 args, so all existing tests using the controller need the new mock.

**5. apps/api/src/modules/referral/referral.service.spec.ts (if it exists):**
Add test cases:
- `trackReferralClick returns { valid: false } when program is disabled`
- `createPendingReferral throws when program is disabled`
- `createPendingReferral works when program is enabled`

### Verification
After implementing, run:
```bash
npm run format && npm run format:check && npm run lint && npm test
```

### Commit message:
```
fix(referral): fix field name mismatch, connect createPendingReferral, add enabled check

Three bugs: (1) Frontend sent {referralCode} but backend read {ref}, so
referral source was never stored. (2) createPendingReferral() was never
called, so credits were never issued. (3) enabled flag was never checked,
so disabling the program had no effect. All fixed with non-blocking error
handling so bookings always succeed regardless of referral errors.
```
```

---

## Prompt 2: Move Referral Page to /marketing/referrals

```
Move the referral settings page from /settings/referral to /marketing/referrals. The referral feature logically belongs under the Marketing hub, not Settings.

### Changes Required

**1. Move the page file:**
- Move `apps/web/src/app/(protected)/settings/referral/page.tsx` to `apps/web/src/app/(protected)/marketing/referrals/page.tsx`
- Create the `marketing/referrals/` directory if it doesn't exist

**2. Update breadcrumbs in the moved file:**
- The file already has a breadcrumb linking to `/marketing` (line 157-161). Verify this is correct after the move.
- Update the page title/heading if it says "Settings" anywhere to say "Marketing" instead.

**3. Create a redirect at the old path:**
Create `apps/web/src/app/(protected)/settings/referral/page.tsx` with:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReferralSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/marketing/referrals');
  }, [router]);
  return null;
}
```

**4. Update Marketing hub page:**
In `apps/web/src/app/(protected)/marketing/page.tsx`, the CARDS array (line 36-41) has the Referrals card pointing to `/settings/referral`. Change it to `/marketing/referrals`.

**5. Search for all other references to `/settings/referral` and update them:**
- Check `apps/web/src/lib/nav-config.ts` — if there's a nav item for /settings/referral, update or remove it
- Check `locales/en.json` and `locales/es.json` — add `nav.referrals` key if missing
- Check any test files that reference the old path
- Check if there are any Links or router.push calls elsewhere pointing to /settings/referral

**IMPORTANT — NO mode-config.ts changes needed:**
The shell route guard (apps/web/src/components/shell.tsx line 155) uses `startsWith(p + '/')` matching. Since `/marketing` is already in admin tools sections (mode-config.ts line 56), `/marketing/referrals` is automatically allowed. Do NOT add `/marketing/referrals` as a separate entry — it would be redundant.

**6. Update any test files:**
If there are tests for the referral settings page or the marketing hub page, update the paths.

### Verification
After implementing, run:
```bash
npm run format && npm run format:check && npm run lint && npm test
```

Manually verify:
- Navigate to /marketing → click Referrals card → opens /marketing/referrals
- Navigate to /settings/referral directly → redirects to /marketing/referrals
- No route guard redirect to /dashboard (the page should load, not bounce)
- Breadcrumb shows Marketing > Referrals

### Commit message:
```
refactor(referral): move referral settings to /marketing/referrals

Relocates the referral configuration page from /settings/referral to
/marketing/referrals to group all growth tools under the Marketing hub.
Adds a redirect from the old path for backward compatibility. No
mode-config changes needed — route guard startsWith matching covers it.
```
```

---

## Prompt 3: Add Credit Redemption to Booking Checkout

```
Add credit redemption so customers with referral credits can apply them when booking. The backend `redeemCredit()` method exists in `apps/api/src/modules/referral/credit.service.ts` (line 59) but is never called from any endpoint.

### Key UX Constraint
The public booking page (/book/[slug]) is UNAUTHENTICATED — the customer is only identified server-side during booking submission via `findOrCreateByPhone`. Credits are issued after the FIRST booking is COMPLETED, so referred customers have zero credits at their first visit. Credit redemption is for RETURNING customers only.

### Changes Required

**Backend:**

**1. Add credit lookup endpoint to public-booking.controller.ts:**
Add a new GET endpoint for phone-based credit lookup:
```typescript
@Get(':slug/credits')
@Throttle({ default: { limit: 20, ttl: 60000 } })
async checkCredits(
  @Param('slug') slug: string,
  @Query('phone') phone: string,
) {
  if (!phone) return { total: 0, credits: [] };
  const business = await this.resolveBusiness(slug);
  const customer = await this.prisma.customer.findFirst({
    where: { businessId: business.id, phone },
  });
  if (!customer) return { total: 0, credits: [] };
  return this.creditService.getAvailableCredits(customer.id, business.id);
}
```
- Import and inject `CreditService` (it's exported from `ReferralModule`, which is now imported via Prompt 1)
- Make it `@Optional()` like ReferralService

**2. Add credit redemption endpoint to referral-public.controller.ts:**
```typescript
@Post('portal/referral/redeem')
async redeemCredit(
  @Body() body: { customerId: string; businessId: string; bookingId: string; amount: number },
) {
  if (!body.customerId || !body.businessId || !body.bookingId || !body.amount) {
    throw new BadRequestException('customerId, businessId, bookingId, and amount are required');
  }
  if (body.amount <= 0) {
    throw new BadRequestException('Amount must be positive');
  }
  return this.creditService.redeemCredit(body);
}
```
Import `Post`, `Body`, `BadRequestException` from `@nestjs/common`.

**3. Wire credit redemption into booking creation:**
In `public-booking.controller.ts`, add `creditAmount?: number` to the body type alongside `referralCode`.

After the booking is created and the referral is processed, add:
```typescript
// Redeem credits if requested (non-blocking — booking is already created)
if (body.creditAmount && body.creditAmount > 0 && this.creditService) {
  this.creditService
    .redeemCredit({
      customerId: customer.id,
      businessId: business.id,
      bookingId: booking.id,
      amount: body.creditAmount,
    })
    .catch((err) =>
      this.logger.warn(
        `Credit redemption failed for booking ${booking.id}: ${err.message}`,
      ),
    );
}
```

**Frontend — Public booking page (apps/web/src/app/book/[slug]/page.tsx):**

**4. Add credit lookup state:**
```typescript
const [availableCredits, setAvailableCredits] = useState<number>(0);
const [applyCredit, setApplyCredit] = useState(false);
const [creditLoading, setCreditLoading] = useState(false);
```

**5. Add credit lookup after phone validation:**
In the `details` step, after the customer enters and validates their phone number, add a debounced credit check. When the user leaves the phone field (onBlur) or moves to the next step:
```typescript
const checkCredits = async (phone: string) => {
  if (!phone || phone.length < 10) return;
  setCreditLoading(true);
  try {
    const data = await publicApi.get<{ total: number }>(
      `/public/${slug}/credits?phone=${encodeURIComponent(phone)}`,
    );
    setAvailableCredits(data.total);
  } catch {
    setAvailableCredits(0);
  } finally {
    setCreditLoading(false);
  }
};
```
Call this `onBlur` on the phone input field.

**6. Show credit UI in the `confirm` step (step 5):**
Only show when `availableCredits > 0`. Place it in the Booking Summary card, after the price row:
```tsx
{availableCredits > 0 && (
  <div className="border-t border-slate-100 pt-3 mt-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Gift size={14} className="text-lavender-600" />
        <span className="text-sm text-slate-600">Referral credit</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-lavender-700">
          −${Math.min(availableCredits, selectedService?.price || 0).toFixed(2)}
        </span>
        <button
          type="button"
          onClick={() => setApplyCredit(!applyCredit)}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            applyCredit ? 'bg-lavender-500' : 'bg-slate-200',
          )}
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
              applyCredit ? 'translate-x-4.5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
    {applyCredit && (
      <p className="text-xs text-lavender-600 mt-1">
        ${Math.min(availableCredits, selectedService?.price || 0).toFixed(2)} will be applied to this booking
      </p>
    )}
  </div>
)}
```

**7. Include credit amount in booking submission:**
In `handleSubmit()`, add to the POST body:
```typescript
...(applyCredit && availableCredits > 0 && {
  creditAmount: Math.min(availableCredits, selectedService!.price),
}),
```

**8. Add tests:**
- Backend: test the GET credits endpoint (known phone returns credits, unknown phone returns 0, missing phone returns 0)
- Backend: test POST portal/referral/redeem (success, insufficient balance, missing fields)
- Backend: test booking creation with creditAmount (credit redeemed, error caught gracefully)
- Frontend: mock credit lookup, verify toggle shows when credits > 0, verify toggle hidden when credits = 0

### Verification
```bash
npm run format && npm run format:check && npm run lint && npm test
```

### Commit message:
```
feat(referral): add credit redemption to booking checkout

Returning customers can now apply referral credits when booking. Phone-based
credit lookup on the public booking page (debounced, after phone validation).
Toggle in confirmation step applies credit. Works via redeemCredit() which
was already implemented but never wired up. Non-blocking — booking always
succeeds even if redemption fails.
```
```

---

## Prompt 4: Enhance Marketing Hub with Referral Dashboard

```
Enhance the Marketing hub page and the /marketing/referrals page with richer referral stats. Currently the Marketing hub (apps/web/src/app/(protected)/marketing/page.tsx) shows basic stats, and the referral page is just a settings form.

### Key Consideration
The Marketing hub calls `GET /referral/stats` which throws ForbiddenException for GENERAL and DEALERSHIP verticals (via assertReferralVertical). The frontend catches this but it generates unnecessary 403 errors. Fix this by conditionally rendering the Referrals card and stats based on the business vertical.

### Changes Required

**Backend:**

**1. Add GET /referral/stats/summary to referral.controller.ts:**
A lightweight endpoint for the hub card:
```typescript
@Get('stats/summary')
@UseGuards(TenantGuard)
@Roles('ADMIN')
async getStatsSummary(@BusinessId() businessId: string) {
  // Return summary without assertReferralVertical — let frontend handle verticals
  const business = await this.prisma.business.findUnique({
    where: { id: businessId },
    select: { verticalPack: true, packConfig: true },
  });
  const allowed = ['AESTHETIC', 'WELLNESS'];
  if (!business || !allowed.includes(business.verticalPack.toUpperCase())) {
    return { supported: false };
  }

  const settings = this.referralService.parseSettings(business.packConfig);
  if (!settings.enabled) {
    return { supported: true, enabled: false };
  }

  const [total, completed, pending] = await Promise.all([
    this.prisma.customerReferral.count({ where: { businessId } }),
    this.prisma.customerReferral.count({ where: { businessId, status: 'COMPLETED' } }),
    this.prisma.customerReferral.count({ where: { businessId, status: 'PENDING' } }),
  ]);

  const credits = await this.prisma.customerCredit.aggregate({
    where: { businessId, source: { in: ['REFERRAL_GIVEN', 'REFERRAL_RECEIVED'] } },
    _sum: { amount: true },
  });

  return {
    supported: true,
    enabled: true,
    totalReferrals: total,
    completedReferrals: completed,
    pendingReferrals: pending,
    conversionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalCreditsIssued: credits._sum.amount || 0,
  };
}
```
NOTE: You'll need to either make `parseSettings` public in ReferralService, or add a helper method. Currently it's private.

**2. Add top referrers query to referral.service.ts:**
```typescript
async getTopReferrers(businessId: string, limit = 5) {
  await this.assertReferralVertical(businessId);

  const referrals = await this.prisma.customerReferral.groupBy({
    by: ['referrerCustomerId'],
    where: { businessId, status: 'COMPLETED' },
    _count: { id: true },
    _sum: { referrerCreditAmount: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  const customerIds = referrals.map((r) => r.referrerCustomerId);
  const customers = await this.prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(customers.map((c) => [c.id, c.name]));

  return referrals.map((r) => ({
    customerId: r.referrerCustomerId,
    name: nameMap.get(r.referrerCustomerId) || 'Unknown',
    referralCount: r._count.id,
    totalCreditEarned: r._sum.referrerCreditAmount || 0,
  }));
}
```

Add a GET endpoint: `GET /referral/top-referrers` in referral.controller.ts.

**Frontend — Marketing hub (apps/web/src/app/(protected)/marketing/page.tsx):**

**3. Conditionally show Referrals card based on vertical:**
Instead of always showing the Referrals card, fetch the business vertical and hide the card for GENERAL/DEALERSHIP. Use the stats/summary endpoint instead of the full stats endpoint:
- Replace the `GET /referral/stats` call with `GET /referral/stats/summary`
- If response has `supported: false`, hide the Referrals card entirely
- If `supported: true` but `enabled: false`, show the card with "Set up your referral program" CTA
- If `supported: true` and `enabled: true`, show stats as currently displayed plus conversion rate

**4. Also hide the "Offers" card if the /settings/offers page doesn't exist** (it currently points to /settings/offers which may be a dead link — verify and fix).

**Frontend — Referral page (apps/web/src/app/(protected)/marketing/referrals/page.tsx):**

**5. Add a stats dashboard above the settings form:**
After the breadcrumb and before the settings form, add a dashboard section:
- Stats row: Total Referrals, Completed, Pending, Credits Issued, Credits Redeemed, Conversion Rate
- Top Referrers table: Name, Referrals, Credits Earned (fetch from `GET /referral/top-referrers`)
- Recent Referrals table (already available from `GET /referral/stats` which returns `recentReferrals`)
- Use the BookingOS design system: `rounded-2xl`, `shadow-soft`, sage for success metrics, lavender for pending, `font-serif` for large numbers

**6. Add design tokens to apps/web/src/lib/design-tokens.ts if needed:**
Add `REFERRAL_STATUS_STYLES` for PENDING/COMPLETED/EXPIRED/CANCELLED if not present.

### Tests
- Test the stats/summary endpoint (supported/unsupported verticals, enabled/disabled)
- Test the top-referrers endpoint
- Update marketing hub page tests if they exist

### Verification
```bash
npm run format && npm run format:check && npm run lint && npm test
```

### Commit message:
```
feat(marketing): add referral dashboard to marketing hub

Enhances the Marketing hub with vertical-aware referral card (hidden for
GENERAL/DEALERSHIP), conversion rate, and live stats. Adds a full
referral dashboard to /marketing/referrals with top referrers and recent
referrals above the settings form. Eliminates spurious 403 errors for
non-referral verticals.
```
```

---

## Prompt 5: Add Referral Seed Data and E2E Smoke Test

```
Add demo referral data and E2E tests for the referral feature. Currently there's no seed data, so the referral dashboard always shows empty state.

### Seed Data (packages/db/src/seed-demo.ts)

**IMPORTANT: All seed data MUST be idempotent.** Use findFirst + create (NOT createMany without dedup checks). The existing seed-demo.ts has a known issue with SavedView duplicates from createMany — do NOT repeat that pattern.

**1. Enable referral program for Glow Aesthetic Clinic:**
Update the business packConfig to include referral settings:
```typescript
// Find Glow Aesthetic Clinic
const glowClinic = await prisma.business.findFirst({
  where: { slug: 'glow-aesthetic-clinic' },
});

// Read-merge-write packConfig (never overwrite entire object)
const currentConfig = typeof glowClinic.packConfig === 'object' && glowClinic.packConfig
  ? glowClinic.packConfig as Record<string, unknown>
  : {};

if (!currentConfig.referral) {
  await prisma.business.update({
    where: { id: glowClinic.id },
    data: {
      packConfig: {
        ...currentConfig,
        referral: {
          enabled: true,
          referrerCredit: 25,
          refereeCredit: 25,
          maxReferralsPerCustomer: 0,
          creditExpiryMonths: 6,
          messageTemplate: 'Hi! I love {businessName}. Book with my link and we both get ${creditAmount} off: {referralLink}',
        },
      },
    },
  });
}
```

**2. Add referral codes to existing customers:**
Find 3 existing customers from the Glow Clinic seed data and assign referral codes (use findFirst + update, check if code already exists):
```typescript
const customers = await prisma.customer.findMany({
  where: { businessId: glowClinic.id },
  take: 3,
});

for (const customer of customers) {
  if (!customer.referralCode) {
    const code = `DEMO${customer.name.slice(0, 4).toUpperCase().replace(/\s/g, '')}`;
    await prisma.customer.update({
      where: { id: customer.id },
      data: { referralCode: code },
    });
  }
}
```

**3. Create CustomerReferral records with mixed statuses:**
Create 5 referral records (idempotent — check for existing before creating):
- 2 COMPLETED (with completedAt and bookingId linked to existing demo bookings)
- 2 PENDING
- 1 EXPIRED (with status EXPIRED)

For each, check if a referral already exists for the referrer+referred pair before creating.

**4. Create matching CustomerCredit records:**
For the 2 COMPLETED referrals, create credit records:
- 2 REFERRAL_GIVEN credits (for referrers)
- 2 REFERRAL_RECEIVED credits (for referred customers)
- Set expiresAt to 6 months from now
- Check if credit already exists for the referralId before creating

**5. Enable referral program for Serenity Wellness Spa too** (same pattern as Glow Clinic).

### E2E Test (apps/web/e2e/referral.spec.ts)

Use the existing test patterns from other E2E files in apps/web/e2e/. Reference apps/web/e2e/fixtures.ts for auth helpers.

```typescript
import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('Referral Feature', () => {
  test('marketing hub shows referrals card with stats', async ({ adminPage }) => {
    await adminPage.goto('/marketing');
    await expect(adminPage.getByTestId('marketing-hub-page')).toBeVisible();
    await expect(adminPage.getByTestId('hub-card-referrals')).toBeVisible();
  });

  test('referral settings page loads at /marketing/referrals', async ({ adminPage }) => {
    await adminPage.goto('/marketing/referrals');
    // Verify the settings form loads (check for a known element)
    await expect(adminPage.getByText('Referral Program')).toBeVisible();
  });

  test('/settings/referral redirects to /marketing/referrals', async ({ adminPage }) => {
    await adminPage.goto('/settings/referral');
    await adminPage.waitForURL('**/marketing/referrals');
    expect(adminPage.url()).toContain('/marketing/referrals');
  });

  test('booking page shows referral banner with valid code', async ({ page }) => {
    // Use a known demo referral code
    await page.goto('/book/glow-aesthetic-clinic?ref=DEMOJANE');
    // Wait for the referral banner to appear
    const banner = page.locator('text=Referred by');
    await expect(banner).toBeVisible({ timeout: 5000 });
  });

  test('booking page works without referral code', async ({ page }) => {
    await page.goto('/book/glow-aesthetic-clinic');
    // Should load normally without any referral banner
    await expect(page.locator('text=Referred by')).not.toBeVisible();
    // Service list should be visible
    await expect(page.locator('[data-testid="service-list"]')).toBeVisible();
  });

  test('referral settings page passes accessibility checks', async ({ adminPage }) => {
    await adminPage.goto('/marketing/referrals');
    await adminPage.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page: adminPage }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

Adjust selectors and test data based on what actually exists in the seeded database.

### Verification
```bash
npm run format && npm run format:check && npm run lint && npm test
cd apps/web && npm run test:e2e
```

### Commit message:
```
test(referral): add seed data and E2E smoke tests

Adds demo referral data (program settings, codes, referrals with mixed
statuses, credits) to seed-demo.ts for both Glow Clinic and Serenity
Wellness. All seed data is idempotent. E2E tests cover marketing hub,
settings page, redirect, booking page with/without referral code, and
accessibility.
```
```

---

## Execution Order

| # | Prompt | Branch | Depends On | Notes |
|---|--------|--------|------------|-------|
| 1 | Fix Credit Pipeline | `fix/referral-pipeline` | None | **Do first** — P0 critical |
| 2 | Move to /marketing/referrals | `refactor/referral-marketing` | None | Can parallel with #1 |
| 3 | Credit Redemption | `feat/credit-redemption` | Merge #1 first | Needs working credits |
| 4 | Marketing Hub Dashboard | `feat/referral-dashboard` | Merge #2 first | Needs new route |
| 5 | Seed Data + E2E | `test/referral-e2e` | Merge all above | Covers everything |
