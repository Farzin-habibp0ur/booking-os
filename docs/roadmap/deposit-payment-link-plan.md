# Deposit Payment Link — Implementation Plan

## Overview

When staff click "Send Deposit Request" on a PENDING_DEPOSIT booking, the notification currently tells the customer to pay but includes **no payment link**. This plan adds a self-serve deposit payment page so customers receive a clickable link to pay their deposit online via Stripe.

## Existing Infrastructure (What We Reuse)

| Component | Location | Reuse |
|-----------|----------|-------|
| `TokenService` | `apps/api/src/common/token.service.ts` | Token creation, validation, revocation — add new type string `DEPOSIT_PAYMENT` |
| `SelfServeService` | `apps/api/src/modules/self-serve/self-serve.service.ts` | Add `getDepositSummary()`, `createDepositPaymentIntent()`, and `confirmDepositPayment()` methods |
| `SelfServeController` | `apps/api/src/modules/self-serve/self-serve.controller.ts` | Add 3 new endpoints (validate, create PI, confirm) |
| `NotificationService` | `apps/api/src/modules/notification/notification.service.ts` | Update `sendDepositRequest()` to accept a `depositLink` param and pass it to template context |
| `BookingService` | `apps/api/src/modules/booking/booking.service.ts` | Update `sendDepositRequest()` to generate token + link before calling notification |
| `publicApi` client | `apps/web/src/lib/public-api.ts` | Used by all `/manage/*` pages — no changes needed |
| `SelfServeError` | `apps/web/src/components/self-serve-error.tsx` | Reusable error component — no changes |
| Manage layout | `apps/web/src/app/manage/layout.tsx` | Shared layout for self-serve pages — no changes |
| Stripe `@stripe/stripe-js` + `@stripe/react-stripe-js` | Already in `apps/web/` dependencies | Used in `/book/[slug]` — reuse same pattern |
| `Payment` Prisma model | `packages/db/prisma/schema.prisma` | Record completed deposit payments — no schema changes |

## What We Build (7 Changes)

### Change 1: Update `BookingService.sendDepositRequest()` — Generate Token + Link

**File:** `apps/api/src/modules/booking/booking.service.ts`

**Current behavior (lines 933–956):** Calls `notificationService.sendDepositRequest(booking)` with no link.

**New behavior:**

```typescript
async sendDepositRequest(businessId: string, id: string) {
  const booking = await this.prisma.booking.findFirst({
    where: { id, businessId },
    include: { customer: true, service: true, staff: true },
  });
  if (!booking) throw new NotFoundException('Booking not found');
  if (booking.status !== 'PENDING_DEPOSIT') {
    throw new BadRequestException('Booking is not in PENDING_DEPOSIT status');
  }

  // Revoke any existing deposit payment tokens for this booking
  await this.tokenService.revokeBookingTokens(booking.id, 'DEPOSIT_PAYMENT');

  // Create new token (48h expiry, matching reschedule/cancel pattern)
  const token = await this.tokenService.createToken(
    'DEPOSIT_PAYMENT',
    booking.customer.email || booking.customer.phone,
    businessId,
    undefined,  // no staffId
    48,          // 48-hour expiry
    booking.id,
  );

  const webUrl = this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  const depositLink = `${webUrl}/manage/deposit/${token}`;

  // Send notification WITH the deposit link (fire-and-forget)
  this.notificationService.sendDepositRequest(booking, depositLink).catch((err) =>
    this.logger.warn(`Failed to send deposit request for booking ${id}`, {
      bookingId: id,
      error: err.message,
    }),
  );

  // Append to depositRequestLog
  const existingFields = (booking.customFields as any) || {};
  const log = Array.isArray(existingFields.depositRequestLog)
    ? existingFields.depositRequestLog
    : [];
  log.push({ sentAt: new Date().toISOString(), linkGenerated: true });

  return this.prisma.booking.update({
    where: { id, businessId },
    data: { customFields: { ...existingFields, depositRequestLog: log } },
    include: { customer: true, service: true, staff: true },
  });
}
```

**Pattern followed:** Identical to `sendRescheduleLink()` (lines 958–1013) — revoke old tokens, create new one, build URL, fire-and-forget notification, log to customFields.

**Note on `webUrl`:** Uses `this.config.get<string>('WEB_URL')` — the exact same pattern used by `sendRescheduleLink` (line 985) and `sendCancelLink` (line 1042). The property is `this.config` (not `this.configService`), matching how `ConfigService` is injected in `BookingService` constructor (line 34).

---

### Change 2: Update `NotificationService.sendDepositRequest()` — Accept and Use Link

**File:** `apps/api/src/modules/notification/notification.service.ts`

**Current signature (line 308):** `async sendDepositRequest(booking: BookingWithRelations): Promise<void>`

**New signature:** `async sendDepositRequest(booking: BookingWithRelations, depositLink?: string): Promise<void>`

**Changes inside the method (lines 308–351):**

1. Add `depositLink` to the context object (line ~329):
```typescript
const context = {
  customerName: booking.customer.name,
  serviceName: booking.service.name,
  date: booking.startTime.toLocaleDateString('en-US', { ... }),
  time: booking.startTime.toLocaleTimeString('en-US', { ... }),
  staffName: booking.staff?.name || '',
  businessName,
  depositAmount: `${depositAmount}`,
  depositLink: depositLink || '',  // NEW
};
```

2. Update the fallback DEPOSIT_REQUIRED template (line 748):
```typescript
// Before:
DEPOSIT_REQUIRED: `Hi ${context.customerName}, your ${context.serviceName} at ${context.businessName} on ${context.date} at ${context.time} requires a deposit of $${context.depositAmount || '0'} to confirm. Please complete your payment to secure your appointment.`,

// After:
DEPOSIT_REQUIRED: `Hi ${context.customerName}, your ${context.serviceName} at ${context.businessName} on ${context.date} at ${context.time} requires a deposit of $${context.depositAmount || '0'} to confirm.${context.depositLink ? ` Pay here: ${context.depositLink}` : ' Please complete your payment to secure your appointment.'}`,
```

**Backward compatibility:** The `depositLink` param is optional. There are two call sites for `sendDepositRequest`:

1. **Automatic (booking creation, line 346):** Called during `BookingService.create()` when `isDepositRequired` is true. Passes only `booking` — no link. The fallback template text ("Please complete your payment to secure your appointment") is used.
2. **Manual (staff-triggered, line 943):** Called via `BookingService.sendDepositRequest()` when staff clicks "Send Deposit Request". After our change, this generates a token + link and passes it.

This means customers initially get a notification without a payment link (when the booking is first created), and receive the link when staff explicitly sends the deposit request. This is intentional — staff may want to review the booking first. A future enhancement could add link generation to the creation flow too.

Existing DB-stored `MessageTemplate` records can use `{{depositLink}}` as a template variable — the `resolveVariables()` method already handles this generically.

---

### Change 3: Add Self-Serve Endpoints for Deposit

**File:** `apps/api/src/modules/self-serve/self-serve.controller.ts`

Add 3 new endpoints following the exact pattern of existing endpoints:

```typescript
@Get('validate/deposit/:token')
@Throttle({ default: { ttl: 60000, limit: 30 } })
validateDepositToken(@Param('token') token: string) {
  return this.selfServeService.getDepositSummary(token);
}

@Post('create-deposit-payment-intent/:token')
@Throttle({ default: { ttl: 60000, limit: 10 } })
createDepositPaymentIntent(@Param('token') token: string) {
  return this.selfServeService.createDepositPaymentIntent(token);
}

@Post('confirm-deposit/:token')
@Throttle({ default: { ttl: 60000, limit: 10 } })
confirmDeposit(
  @Param('token') token: string,
  @Body() body: { paymentIntentId: string },
) {
  return this.selfServeService.confirmDepositPayment(token, body.paymentIntentId);
}
```

**Why 3 endpoints (not 2):** The Stripe flow requires: (1) validate token + show summary, (2) create PaymentIntent server-side to get `clientSecret`, (3) confirm deposit after client-side payment succeeds. This matches the portal booking flow in `public-booking.controller.ts`.

---

### Change 4: Add Self-Serve Service Methods for Deposit

**File:** `apps/api/src/modules/self-serve/self-serve.service.ts`

Add 3 new methods + inject Stripe + ConfigService:

```typescript
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

// In constructor — ConfigService is global (registered in app.module.ts with isGlobal: true)
// so it's a required param, placed BEFORE optional params:
private stripe: Stripe | null = null;

constructor(
  private prisma: PrismaService,
  private tokenService: TokenService,
  private availabilityService: AvailabilityService,
  private bookingService: BookingService,
  private businessService: BusinessService,
  private waitlistService: WaitlistService,
  private config: ConfigService,       // NEW — required, globally available
  @Optional() private quoteService?: QuoteService,
) {
  const secretKey = config.get<string>('STRIPE_SECRET_KEY');
  if (secretKey) {
    this.stripe = new Stripe(secretKey);
  }
}
```

**Note:** `ConfigModule.forRoot({ isGlobal: true })` is set in `app.module.ts` (line 92), so `ConfigService` is available everywhere without module imports. The property name `config` matches the convention used in `BookingService` (line 34).

#### Method 1: `getDepositSummary(token)`

```typescript
async getDepositSummary(token: string) {
  const record = await this.tokenService.validateToken(token, 'DEPOSIT_PAYMENT');

  if (!record.bookingId) {
    throw new BadRequestException('Invalid token');
  }

  const booking = await this.prisma.booking.findFirst({
    where: { id: record.bookingId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      service: { select: { id: true, name: true, durationMins: true, price: true, depositAmount: true, depositRequired: true } },
      staff: { select: { id: true, name: true } },
      business: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!booking) throw new NotFoundException('Booking not found');

  // If booking is no longer PENDING_DEPOSIT, the deposit may have been paid or overridden
  if (booking.status !== 'PENDING_DEPOSIT') {
    throw new BadRequestException(
      booking.status === 'CONFIRMED'
        ? 'This deposit has already been paid'
        : 'This booking is no longer awaiting deposit',
    );
  }

  const depositAmount = booking.service.depositAmount || booking.service.price || 0;

  return {
    booking: {
      id: booking.id,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      service: booking.service,
      staff: booking.staff,
      customer: { name: booking.customer.name },
    },
    business: booking.business,
    depositAmount,
    stripeEnabled: !!this.stripe,
  };
}
```

#### Method 2: `createDepositPaymentIntent(token)`

```typescript
async createDepositPaymentIntent(token: string) {
  if (!this.stripe) {
    throw new BadRequestException('Payment processing is not configured');
  }

  const record = await this.tokenService.validateToken(token, 'DEPOSIT_PAYMENT');
  if (!record.bookingId) throw new BadRequestException('Invalid token');

  const booking = await this.prisma.booking.findFirst({
    where: { id: record.bookingId },
    include: {
      service: true,
      business: { select: { id: true, name: true } },
    },
  });

  if (!booking) throw new NotFoundException('Booking not found');
  if (booking.status !== 'PENDING_DEPOSIT') {
    throw new BadRequestException('This booking is no longer awaiting deposit');
  }

  const amount = booking.service.depositAmount || booking.service.price || 0;
  if (amount <= 0) throw new BadRequestException('No payable amount');

  const paymentIntent = await this.stripe.paymentIntents.create(
    {
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      metadata: {
        businessId: booking.businessId,
        bookingId: booking.id,
        serviceId: booking.serviceId,
        type: 'deposit',
      },
    },
    { idempotencyKey: `deposit-${booking.id}-${Date.now()}` },
  );

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount,
  };
}
```

#### Method 3: `confirmDepositPayment(token, paymentIntentId)`

```typescript
async confirmDepositPayment(token: string, paymentIntentId: string) {
  // Use validateAndConsume for atomic token consumption (C1/C2/C3 fix)
  const record = await this.tokenService.validateAndConsume(token, 'DEPOSIT_PAYMENT');
  if (!record || !record.bookingId) throw new BadRequestException('Invalid token');

  const booking = await this.prisma.booking.findFirst({
    where: { id: record.bookingId },
    include: { customer: true, service: true, staff: true },
  });

  if (!booking) throw new NotFoundException('Booking not found');
  if (booking.status !== 'PENDING_DEPOSIT') {
    throw new BadRequestException(
      booking.status === 'CONFIRMED'
        ? 'This deposit has already been paid'
        : 'This booking is no longer awaiting deposit',
    );
  }

  const depositAmount = booking.service.depositAmount || booking.service.price || 0;

  // Create Payment record
  await this.prisma.payment.create({
    data: {
      businessId: booking.businessId,
      bookingId: booking.id,
      customerId: booking.customerId,
      stripePaymentIntentId: paymentIntentId,
      amount: depositAmount,
      currency: 'usd',
      method: 'STRIPE',
      status: 'COMPLETED',
    },
  });

  // Transition booking to CONFIRMED
  await this.prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CONFIRMED' },
  });

  // Log to selfServeLog
  const existingFields = (booking.customFields as any) || {};
  const selfServeLog = Array.isArray(existingFields.selfServeLog)
    ? existingFields.selfServeLog
    : [];
  selfServeLog.push({
    type: 'DEPOSIT_PAID_BY_CUSTOMER',
    at: new Date().toISOString(),
    amount: depositAmount,
    paymentIntentId,
  });

  await this.prisma.booking.update({
    where: { id: booking.id },
    data: { customFields: { ...existingFields, selfServeLog } },
  });

  return {
    success: true,
    bookingId: booking.id,
    status: 'CONFIRMED',
    amount: depositAmount,
  };
}
```

**Race condition prevention:** Uses `validateAndConsume()` (atomic) so two concurrent payment confirmations can't both succeed.

**Note:** `ConfigModule` is globally registered (`isGlobal: true` in `app.module.ts`), so `SelfServeModule` does NOT need any import changes for `ConfigService` injection.

---

### Change 5: Frontend — New Deposit Payment Page

**File:** `apps/web/src/app/manage/deposit/[token]/page.tsx` (NEW)

State machine: `loading → summary → paying → success → error`

```
┌─────────┐    validate     ┌─────────┐   create PI    ┌────────┐
│ loading │ ──────────────► │ summary │ ─────────────► │ paying │
└─────────┘                 └─────────┘                └────────┘
     │                           │                          │
     │ (error)                   │ (already paid)           │ stripe.confirmPayment()
     ▼                           ▼                          │
  ┌───────┐                  ┌───────┐                      │
  │ error │                  │ error │                      │
  └───────┘                  └───────┘                      │
                                                            ▼
                                                     POST confirm-deposit
                                                            │
                                              ┌─────────────┴──────────────┐
                                              ▼                            ▼
                                         ┌─────────┐                 ┌───────┐
                                         │ success │                 │ error │
                                         └─────────┘                 └───────┘
```

**Key sections of the page:**

1. **Loading state** — Spinner, calls `GET /self-serve/validate/deposit/{token}`
2. **Summary state** — Shows booking details (service, date, time, staff) + deposit amount + "Pay Deposit" button
3. **Paying state** — Calls `POST /self-serve/create-deposit-payment-intent/{token}` to get `clientSecret`, renders Stripe `<Elements>` + `<PaymentElement>` (identical pattern to `/book/[slug]`)
4. **Success state** — Calls `POST /self-serve/confirm-deposit/{token}` with `paymentIntentId`, then shows green checkmark + "Deposit Paid — Booking Confirmed!"
5. **Error state** — Uses `<SelfServeError>` component (existing)

**Stripe integration pattern (copied from `/book/[slug]/page.tsx`):**
- Uses `@stripe/stripe-js` `loadStripe()` with `NEXT_PUBLIC_STRIPE_KEY`
- Uses `@stripe/react-stripe-js` `<Elements>` provider with `clientSecret`
- `<PaymentElement />` for card input
- `stripe.confirmPayment({ elements, redirect: 'if_required' })` on submit
- On success → call confirm-deposit endpoint → show success

**Design system compliance:**
- `rounded-2xl` cards, `shadow-soft` elevation
- `bg-sage-600` primary button
- `font-serif` for headings
- Lavender accent for deposit amount badge
- `btn-press` interaction feedback

---

### Change 6: Frontend Test

**File:** `apps/web/src/app/manage/deposit/[token]/page.test.tsx` (NEW)

Test cases following the exact pattern in `cancel/[token]/page.test.tsx`:

1. Shows loading state initially
2. Shows booking summary after token validation
3. Shows deposit amount prominently
4. Shows error when token is invalid/expired
5. Shows error when deposit already paid (status !== PENDING_DEPOSIT)
6. Shows Stripe payment form after clicking "Pay Deposit"
7. Shows success state after payment confirmation
8. Shows error on payment failure
9. Handles network errors gracefully

**Mocks needed:**
- `next/navigation` → `useParams`
- `@/lib/public-api` → `publicApi`
- `@/lib/cn` → `cn`
- `@/components/self-serve-error` → `SelfServeError`
- `@stripe/stripe-js` → `loadStripe`
- `@stripe/react-stripe-js` → `Elements`, `PaymentElement`, `useStripe`, `useElements`

---

### Change 7: Translation Keys

**Files:** `apps/web/src/locales/en.json` and `apps/web/src/locales/es.json`

Add keys under a new `depositPayment` section:

```json
{
  "depositPayment": {
    "title": "Pay Deposit",
    "subtitle": "Complete your deposit to confirm your booking",
    "appointmentDetails": "Appointment Details",
    "depositAmount": "Deposit Amount",
    "payDeposit": "Pay Deposit",
    "processing": "Processing...",
    "successTitle": "Deposit Paid!",
    "successMessage": "Your booking has been confirmed.",
    "whatHappensNext": "What happens next",
    "bookingConfirmed": "Your appointment is now confirmed",
    "receiptSent": "A confirmation will be sent to you shortly",
    "errorTitle": "Unable to Process Payment",
    "alreadyPaid": "This deposit has already been paid",
    "closeTab": "You can close this page."
  }
}
```

Spanish translations in `es.json`.

---

## Files Modified (Summary)

| # | File | Action | Lines Changed |
|---|------|--------|---------------|
| 1 | `apps/api/src/modules/booking/booking.service.ts` | Modify `sendDepositRequest()` to generate token + link | ~25 lines |
| 2 | `apps/api/src/modules/notification/notification.service.ts` | Add `depositLink` param + update fallback template | ~5 lines |
| 3 | `apps/api/src/modules/self-serve/self-serve.controller.ts` | Add 3 endpoints | ~20 lines |
| 4 | `apps/api/src/modules/self-serve/self-serve.service.ts` | Add 3 methods + Stripe/ConfigService init | ~120 lines |
| 5 | `apps/web/src/app/manage/deposit/[token]/page.tsx` | **NEW** — deposit payment page | ~250 lines |
| 6 | `apps/web/src/app/manage/deposit/[token]/page.test.tsx` | **NEW** — frontend tests | ~200 lines |
| 7 | `apps/web/src/locales/en.json` | Add depositPayment keys | ~15 lines |
| 8 | `apps/web/src/locales/es.json` | Add depositPayment keys | ~15 lines |
| 9 | `apps/api/src/modules/self-serve/self-serve.service.spec.ts` | Add deposit method tests | ~150 lines |
| 10 | `apps/api/src/modules/booking/booking.service.spec.ts` | Update `sendDepositRequest` assertions (new `depositLink` param + `tokenService` calls) | ~30 lines |
| 11 | `apps/api/src/modules/notification/notification.service.spec.ts` | Update `sendDepositRequest` test for optional `depositLink` param | ~15 lines |

**Total: 11 files (2 new, 9 modified), ~850 lines**

**Note:** `self-serve.controller.spec.ts` does not exist in the codebase. Controller tests are covered through the existing `self-serve.service.spec.ts`. If we want controller-level tests, that would be a new file (`self-serve.controller.spec.ts`), but given the controller is a thin pass-through layer, service-level tests provide adequate coverage.

---

## No Schema Migration Needed

- The `Token` model uses a `String` type field — no enum, no migration required for new type `DEPOSIT_PAYMENT`
- The `Payment` model already supports `bookingId`, `stripePaymentIntentId`, and deposit amounts
- The `Booking.customFields` JSON field already stores `selfServeLog` and `depositRequestLog`

---

## Implementation Order

Execute in this order to maintain a working system at each step:

1. **Backend: `SelfServeService`** — Add 3 deposit methods + Stripe/ConfigService injection
2. **Backend: `SelfServeController`** — Add 3 endpoints
3. **Backend: `NotificationService`** — Add `depositLink` param + update fallback template
4. **Backend: `BookingService`** — Update `sendDepositRequest()` to generate token + link
5. **Frontend: Deposit page** — Create `/manage/deposit/[token]/page.tsx`
6. **Frontend: Translation keys** — Add to en.json and es.json
7. **Tests** — All backend + frontend tests (update existing specs + new frontend test)
8. **Pre-commit checks** — `npm run format` → `format:check` → `lint` → `test`

---

## Security Considerations

- **Token expiry:** 48 hours (matches reschedule/cancel)
- **Token revocation:** Old tokens revoked when new deposit request sent
- **Atomic consumption:** `validateAndConsume()` prevents double-payment race condition
- **Status check:** Every endpoint verifies `booking.status === 'PENDING_DEPOSIT'`
- **No auth required:** Self-serve endpoints are public (no JWT) — security is via the 64-char cryptographic token
- **Rate limiting:** 30/min for validation, 10/min for payment actions
- **Stripe idempotency:** `idempotencyKey` on PaymentIntent creation prevents duplicate charges
- **Tenant isolation:** Payment record includes `businessId`; booking lookup doesn't leak cross-tenant data

---

## What This Does NOT Change

- No Prisma schema changes / no migration
- No changes to the booking portal (`/book/[slug]`)
- No changes to the admin deposit override flow
- No changes to the booking status machine
- No new BullMQ queues
- No new environment variables (uses existing `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_KEY`)
- Settings/templates page navigation gap (separate task)
