# Stripe Configuration Guide

This document describes exactly how to configure Stripe for Booking OS billing. The billing code is fully implemented — this guide covers the Stripe dashboard setup and environment variables needed to activate it.

---

## 1. Products & Prices

Create **3 products** in [Stripe Dashboard → Products](https://dashboard.stripe.com/products), each with **2 prices** (monthly + annual). The prices must match the hardcoded values in `apps/api/src/common/plan-config.ts`.

### Starter

| Interval | Price     | Stripe Billing          |
| -------- | --------- | ----------------------- |
| Monthly  | $49/month | $49.00 recurring/month  |
| Annual   | $39/month | $468.00 recurring/year  |

### Professional

| Interval | Price      | Stripe Billing          |
| -------- | ---------- | ----------------------- |
| Monthly  | $99/month  | $99.00 recurring/month  |
| Annual   | $79/month  | $948.00 recurring/year  |

### Enterprise

| Interval | Price       | Stripe Billing            |
| -------- | ----------- | ------------------------- |
| Monthly  | $199/month  | $199.00 recurring/month   |
| Annual   | $159/month  | $1,908.00 recurring/year  |

> **Important:** Annual prices are billed as a single yearly charge (e.g., $39/month × 12 = $468/year), not as monthly charges. Create the Stripe price as a yearly recurring price with the total annual amount.

After creating each price, copy the `price_xxx` ID from Stripe for the environment variables below.

---

## 2. Webhook Endpoint

Configure a webhook endpoint in [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks):

**Endpoint URL:**
```
https://api.businesscommandcentre.com/api/v1/billing/webhook
```

**Events to subscribe:**
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`
- `customer.subscription.trial_will_end`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

After creating the webhook endpoint, copy the **Signing Secret** (`whsec_xxx`) for the environment variable below.

### Raw Body Handling

The webhook endpoint requires the raw request body for Stripe signature verification. This is already configured:
- `NestFactory.create(AppModule, { rawBody: true })` in `apps/api/src/main.ts`
- The webhook handler uses `@Req() req: RawBodyRequest<Request>` and validates `req.rawBody` exists

No additional configuration is needed.

---

## 3. Environment Variables

Set these in Railway (or your deployment platform) after completing the Stripe dashboard setup:

```bash
# Stripe API Key (use sk_test_ for testing, sk_live_ for production)
STRIPE_SECRET_KEY=sk_live_...

# Webhook Signing Secret (from the webhook endpoint created above)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from the 6 prices created above)
STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
STRIPE_PRICE_ID_STARTER_ANNUAL=price_...
STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL=price_...
STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...
```

---

## 4. Testing in Stripe Test Mode

### Step 1: Use test keys first

Set `STRIPE_SECRET_KEY=sk_test_...` and create test-mode products/prices in Stripe. All test-mode webhook events go to the same endpoint.

### Step 2: Verify the API is running

```bash
curl -s https://api.businesscommandcentre.com/api/v1/health
```

### Step 3: Verify Stripe configuration via billing health check

```bash
curl -s https://api.businesscommandcentre.com/api/v1/billing/health \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" | jq .
```

This returns which price IDs are configured and whether the Stripe key is valid.

### Step 4: Test the checkout flow

1. Log in to the web app as a business admin
2. Navigate to Settings → Billing → Upgrade
3. Select a plan and billing interval
4. Complete checkout with a [Stripe test card](https://docs.stripe.com/testing#cards):
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Requires auth: `4000 0025 0000 3155`
5. Verify the subscription is created in the database
6. Check Stripe Dashboard → Webhooks for successful event delivery

### Step 5: Test webhook events

Use the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward events locally during development:

```bash
stripe listen --forward-to localhost:3001/api/v1/billing/webhook
```

---

## 5. Checkout Flow (Code Path Reference)

For debugging, here is the end-to-end checkout flow:

1. **Frontend** `/upgrade` page calls `POST /api/v1/billing/checkout` with `{ plan, billing }`
2. **BillingController** validates the plan name against `PLAN_TIERS` and billing interval
3. **BillingService.createCheckoutSession():**
   - Looks up the business
   - Resolves the Stripe price ID from env var (e.g., `STRIPE_PRICE_ID_STARTER_MONTHLY`)
   - Finds existing Stripe Customer or creates one with `businessId` in metadata
   - Creates a Stripe Checkout Session with 14-day trial
   - Returns `{ url }` for frontend redirect
4. **After payment** → Stripe fires `checkout.session.completed` webhook
5. **BillingService.handleCheckoutComplete():**
   - Reads `businessId` and `plan` from session metadata
   - Retrieves full subscription from Stripe
   - Upserts `Subscription` record with status from Stripe
   - Clears trial/grace dates on the business
   - Cancels onboarding drip emails
   - Sends welcome-to-paid email
   - Processes referral conversion if applicable

---

## 6. Implemented Webhook Handlers

| Event | Handler | Action |
| ----- | ------- | ------ |
| `checkout.session.completed` | `handleCheckoutComplete` | Create/update Subscription, clear trial, send welcome email |
| `invoice.paid` | `handleInvoicePaid` | Set subscription status to `active`, cancel dunning |
| `invoice.payment_failed` | `handlePaymentFailed` | Set status to `past_due`, trigger 3-email dunning sequence |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Set status to `canceled` |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Sync plan/status/period from Stripe |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` | Send trial-ending reminder email (3 days before) |
| `payment_intent.succeeded` | `handlePaymentIntentSucceeded` | Mark deposit booking as CONFIRMED |
| `payment_intent.payment_failed` | `handlePaymentIntentFailed` | Log payment failure for deposit |

---

## 7. Go-Live Checklist

- [ ] Create 3 products with 6 prices in Stripe (test mode first)
- [ ] Create webhook endpoint with all 8 events
- [ ] Set all 8 environment variables in Railway
- [ ] Verify `GET /billing/health` returns all prices configured
- [ ] Complete a test checkout with `4242 4242 4242 4242`
- [ ] Verify webhook delivery in Stripe Dashboard
- [ ] Verify Subscription record created in database
- [ ] Switch to live keys (`sk_live_`, new webhook secret, new price IDs)
- [ ] Repeat verification with a real card (refund immediately)
