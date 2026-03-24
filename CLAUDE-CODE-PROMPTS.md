# Booking OS — Claude Code Implementation Prompts (Revised)

> **Revised March 23, 2026** after deep codebase audit. Many items from the original plan are already fully implemented. This document contains ONLY the work that actually needs doing.
>
> **How to use:** Copy each prompt into Claude Code in your terminal. Run in order within each phase. Independent sessions can run in parallel.
>
> **What's already done (no prompts needed):**
> - Stripe billing: 8 webhook events, 4-state lifecycle, dunning, deposits, plan switching — just configure Stripe dashboard
> - All 6 messaging channels: fully implemented with signature verification, circuit breakers, delivery tracking
> - Security: Helmet CSP, TenantGuard, RolesGuard, rate limiting (9 controllers), token blacklisting
> - CI/CD: full pipeline with PostgreSQL service container, Railway deploy, smoke tests, E2E
> - Docker: multi-stage builds, health checks, graceful restart
> - Monitoring: Sentry + PostHog (conditional), health endpoint with DB/Redis latency
> - Onboarding: 13-email drip sequence, signup flow complete

---

## PHASE 1: Production Hardening (Days 1–3)

### Session 1 — Database Indexes + Redis Brute Force + Refresh Token Rotation

```
Three production hardening tasks for the Booking OS API.

TASK 1: Add missing database performance indexes

Read packages/db/prisma/schema.prisma and check which indexes already exist on these models: Conversation, Message, Booking, ActionCard, OutboundDraft, Customer, AgentRun.

Based on my audit, these models already have good index coverage (Booking has 7, ActionCard has 5, OutboundDraft has 4). Add ONLY indexes that are genuinely missing:

- Message: (conversationId, createdAt) for thread pagination — check if this composite exists or only a single (conversationId) index
- Customer: (businessId, phone) and (businessId, email) for lookup performance — check if these composites exist
- AgentRun: (businessId, agentType, status) if not present
- Conversation: (businessId, lastMessageAt DESC) for inbox sorting — check if lastMessageAt field exists first

DO NOT duplicate existing indexes. Read the schema thoroughly first.

If any are needed: npx prisma migrate dev --name add_missing_indexes --schema=packages/db/prisma/schema.prisma
Then: npx prisma generate --schema=packages/db/prisma/schema.prisma

TASK 2: Move brute force protection from in-memory to Redis

In apps/api/src/modules/auth/auth.service.ts, lines ~19-67, the brute force protection uses:
- private failedAttempts = new Map<string, { count: number; lockedUntil?: Date }>()
- checkBruteForce() and recordFailedAttempt() methods using the Map
- A setInterval cleanup every 5 minutes

This resets on server restart and won't work with multiple instances. Refactor to use Redis:
- Check how Redis is accessed elsewhere in the codebase (look at CircuitBreakerService in apps/api/src/common/circuit-breaker/ or how BullMQ connects — there should be a Redis client or IoRedis instance available)
- Replace the Map with Redis keys: `auth:brute:{email}` → failed count, TTL = 15 minutes
- On failed login: INCR key, EXPIRE if new. If count >= 5, throw UnauthorizedException
- On successful login: DEL the key
- Remove the setInterval cleanup (Redis TTL handles it)
- Keep constants: MAX_FAILED_ATTEMPTS = 5, LOCKOUT_MINUTES = 15

TASK 3: Implement refresh token rotation

Read the full auth module to understand current token flow:
- apps/api/src/modules/auth/auth.service.ts — login(), refresh(), token creation
- Look for TokenService or TokenBlacklistService (the codebase has token blacklisting on logout)

Current refresh tokens are static for 7 days. Change POST /auth/refresh so:
1. On each refresh, issue a NEW refresh token and blacklist the old one using the existing blacklist mechanism
2. Add a familyId claim to refresh tokens — a UUID generated at login, carried through all rotations
3. If a blacklisted refresh token is presented (reuse = theft), blacklist ALL tokens with that familyId
4. The familyId tracking can use Redis: key `auth:family:{familyId}` → set of token jti values

Update auth tests (auth.service.spec.ts) to cover:
- Redis-based brute force (mock Redis)
- Refresh token rotation (old token blacklisted)
- Token family revocation on reuse

Run: cd apps/api && npx jest auth --maxWorkers=50%
Commit: "security: Redis brute force, refresh token rotation with family tracking"
```

### Session 2 — Rate Limiting Expansion + CI Security

```
Two tasks to harden the platform before accepting real customers.

TASK 1: Expand rate limiting to unprotected endpoints

The codebase already has @Throttle() on 9 controllers (auth signup: 3/min, login: 10/min, refresh: 10/min, password reset: 5/min, public booking: 30/min, testimonials: 20/min).

Read the ThrottlerModule config in apps/api/src/app.module.ts to understand the setup. Then add @Throttle() to these UNPROTECTED endpoints:

- BookingController: POST /bookings, PATCH /bookings/:id → { default: { limit: 30, ttl: 60000 } }
- CustomerController: POST /customers, PATCH /customers/:id → { default: { limit: 30, ttl: 60000 } }
- The controller handling outbound message sends → { default: { limit: 60, ttl: 60000 } }
- ReportController or KpiReportController (find the actual names): all GET endpoints → { default: { limit: 10, ttl: 3600000 } }
- All /admin/* controllers → { default: { limit: 30, ttl: 60000 } }

Import @Throttle from @nestjs/throttler in each controller if not already imported.

TASK 2: CI security hardening

Read .github/workflows/ci.yml first. Then make these surgical edits:

a) Move Railway project ID to secret: Replace all 3 occurrences of 37eeca20-7dfe-45d9-8d29-e902a545f475 (around lines 165, 167, 169) with ${{ secrets.RAILWAY_PROJECT_ID }}

b) Add npm audit after the "npm ci" step in lint-and-test job:
- name: Security audit
  run: npm audit --audit-level=high --omit=dev
  continue-on-error: true

(Use continue-on-error: true initially to avoid blocking on existing advisories — can switch to false once clean)

c) Add post-deploy health check polling after the railway up commands in the deploy job. Add a step that polls https://api.businesscommandcentre.com/api/v1/health every 5 seconds for up to 5 minutes, failing if it never returns 200.

Run: cd apps/api && npx jest --maxWorkers=50% 2>&1 | tail -20
Commit: "security: expand rate limiting, harden CI pipeline"
```

### Session 3 — Backup System + Operational Runbooks

```
Create the backup infrastructure and operational documentation.

TASK 1: Create database backup script

Create scripts/backup-database.sh:
- Uses pg_dump with --format=custom for compressed backups
- Filename: bookingos-backup-$(date +%Y%m%d-%H%M%S).dump
- Takes DATABASE_URL from environment
- Outputs to configurable directory (default: ./backups/)
- Prints file size and path on success, exits 1 on failure
- Make executable: chmod +x

TASK 2: Create restore script

Create scripts/restore-database.sh:
- Takes backup file path as argument
- Uses pg_restore from custom-format dump
- Has --dry-run flag that validates without restoring
- Takes DATABASE_URL from environment
- Prints warnings before restoring
- Make executable: chmod +x

TASK 3: Create GitHub Actions backup workflow

Create .github/workflows/backup.yml:
- Schedule: daily at 3:00 AM UTC
- Also manually triggerable (workflow_dispatch)
- Steps: install pg client tools, run backup script using secrets.DATABASE_URL, upload as artifact (30-day retention)
- On failure: create GitHub issue with "backup-failure" label

TASK 4: Add migration timeout to docker-entrypoint.sh

The current scripts/docker-entrypoint.sh runs migrations without timeout:
```
#!/bin/sh
set -e
echo "Running database migrations..."
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
echo "Starting API server..."
exec node dist/apps/api/src/main
```

Wrap the migrate command with a 120-second timeout using the `timeout` command.

TASK 5: Create operational runbooks

Create docs/runbooks/ with these 5 files:

DATABASE-DOWN.md — Symptoms, Railway recovery, backup restore procedure
REDIS-DOWN.md — Impact on BullMQ/WebSocket/brute-force/circuit-breaker, recovery steps
DEPLOYMENT-ROLLBACK.md — When to rollback, Railway dashboard steps, migration considerations
MESSAGING-FAILURE.md — Per-channel diagnosis, circuit breaker states, DLQ management via /admin/dlq/*
AUTH-INCIDENT.md — Token blacklisting, forced password reset, secret rotation procedure

Each runbook: 1-2 pages, numbered steps, real command examples referencing actual endpoints.

TASK 6: Create production verification script

Create scripts/verify-production.sh that checks:
- DATABASE_URL is set and connectable
- REDIS_URL is set and connectable
- JWT_SECRET and JWT_REFRESH_SECRET are at least 32 characters
- STRIPE_SECRET_KEY is set (warn if starts with sk_test_)
- CORS_ORIGINS contains production domain
- MESSAGING_PROVIDER is NOT 'mock'
- SENTRY_DSN is set
- No demo credentials in database (check for sarah@glowclinic.com)

Output GREEN/RED per check with instructions for failures.

Add "## Backup & Recovery" and "## Pre-Launch Checklist" sections to DEPLOY.md.

Commit: "ops: backup system, migration timeout, runbooks, production verification"
```

---

## PHASE 2: Go-Live Configuration (Days 4–7)

### Session 4 — Stripe Dashboard Configuration + End-to-End Verification

```
The Stripe billing code is FULLY IMPLEMENTED (8 webhook events, dunning, deposits, plan switching). This session is about configuring the Stripe dashboard and verifying end-to-end.

DO NOT modify the billing code unless you find actual bugs during testing.

TASK 1: Create a Stripe configuration guide

Create docs/STRIPE-SETUP.md documenting exactly what needs to be configured in Stripe dashboard:

Products & Prices (create 3 products × 2 intervals = 6 prices):
- Starter: $49/month (monthly), $39/month billed annually ($468/year)
- Professional: $99/month (monthly), $79/month billed annually ($948/year)
- Enterprise: $199/month (monthly), $159/month billed annually ($1,908/year)

Note: The code in billing.service.ts has hardcoded pricing of $49/$99/$199 monthly and $39/$79/$159 annually. The Stripe prices must match these exactly.

Webhook endpoint:
- URL: https://api.businesscommandcentre.com/api/v1/billing/webhook
- Events to subscribe: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted, customer.subscription.updated, customer.subscription.trial_will_end, payment_intent.succeeded, payment_intent.payment_failed

Environment variables to set in Railway after Stripe setup:
- STRIPE_SECRET_KEY=sk_live_... (or sk_test_ for testing first)
- STRIPE_WEBHOOK_SECRET=whsec_...
- STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
- STRIPE_PRICE_ID_STARTER_ANNUAL=price_...
- STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_...
- STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL=price_...
- STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
- STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...

Include the Stripe test mode verification command:
curl -s https://api.businesscommandcentre.com/api/v1/health

TASK 2: Verify webhook raw body handling

Read apps/api/src/main.ts and the billing controller. The webhook endpoint needs the RAW request body for stripe.webhooks.constructEvent() to verify signatures. Verify one of these is true:
a) The app uses app.use(express.raw()) or rawBody option on NestFactory.create()
b) The webhook controller has a special raw body decorator/interceptor
c) NestJS is configured with rawBody: true in create() options

If raw body handling is NOT configured for the webhook route, add it. This is the #1 reason Stripe webhooks fail in NestJS.

TASK 3: Verify the checkout flow end-to-end

Trace the code path:
1. Frontend /upgrade page calls api.post('/billing/checkout', { plan, billing })
2. BillingController creates Stripe Checkout Session
3. Returns checkout URL → frontend redirects
4. After payment → Stripe fires checkout.session.completed webhook
5. Webhook handler creates Subscription record with status: 'trialing'

Verify each step has proper error handling. Check that the checkout endpoint:
- Validates the plan name
- Validates the billing interval
- Creates or retrieves a Stripe Customer for the business
- Returns a valid checkout URL

TASK 4: Add a billing health check endpoint

Add GET /billing/health (SUPER_ADMIN only) that:
- Verifies STRIPE_SECRET_KEY is set by calling stripe.balance.retrieve()
- Checks which STRIPE_PRICE_ID_* env vars are configured
- Returns { status, configuredPrices: [...], missingPrices: [...] }

Write tests for the health check endpoint.

Run: cd apps/api && npx jest billing --maxWorkers=50%
Commit: "billing: add Stripe setup guide, verify webhook handling, add billing health check"
```

### Session 5 — Channel Configuration Guide + Web Chat Widget Build

```
All 6 messaging channels are fully implemented. This session creates the configuration guide and verifies the web chat widget builds.

TASK 1: Create comprehensive channel setup guide

Create docs/CHANNEL-SETUP.md documenting the exact configuration for each channel:

WHATSAPP:
- Prerequisites: Meta Business Account (verified), WhatsApp Business API access
- Meta Business Suite: API Setup → get Phone Number ID + Permanent Access Token
- Webhook URL: https://api.businesscommandcentre.com/api/v1/whatsapp/webhook
- Verify Token: set WHATSAPP_VERIFY_TOKEN in Railway (any random string, must match Meta config)
- Environment variables: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN
- Test: send a message to the WhatsApp number, verify it appears in inbox

INSTAGRAM:
- Prerequisites: Facebook App with instagram_manage_messages permission, Instagram Business Account linked to Facebook Page
- OAuth flow: user clicks "Connect Instagram" in settings → redirected to Facebook OAuth → callback stores tokens
- The app has a daily cron refreshing tokens expiring within 10 days
- Environment variables: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_VERIFY_TOKEN
- Webhook URL: https://api.businesscommandcentre.com/api/v1/instagram/webhook
- Ice breaker configuration via POST /instagram-auth/:locationId/ice-breakers

FACEBOOK:
- Prerequisites: Facebook Page with Messenger enabled, Facebook App with pages_messaging permission
- Webhook URL: https://api.businesscommandcentre.com/api/v1/facebook/webhook
- Environment variables: FACEBOOK_VERIFY_TOKEN, FACEBOOK_APP_SECRET
- Subscribe page to webhooks in Facebook App dashboard

SMS (TWILIO):
- Prerequisites: Twilio account, purchased phone number, A2P 10DLC registration (US)
- Environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_URL
- Webhook URL: https://api.businesscommandcentre.com/api/v1/sms/webhook
- Configure webhook URL in Twilio phone number settings
- Note: A2P 10DLC registration can take days-weeks for US numbers

EMAIL (RESEND):
- Prerequisites: Resend account, verified sending domain (SPF, DKIM, DMARC)
- Environment variables: EMAIL_PROVIDER=resend, EMAIL_API_KEY=re_..., EMAIL_FROM=notifications@yourdomain.com
- Inbound webhook: https://api.businesscommandcentre.com/api/v1/email/webhook
- Configure inbound forwarding in Resend dashboard

WEB CHAT:
- Self-hosted, no third-party account needed
- Build: cd packages/web-chat-widget && npm run build
- Embed snippet for customer websites
- Public config endpoint: GET /public/chat/config/:businessSlug
- Location config via webChatConfig JSON field

Include the priority order: Email + Web Chat first (no third-party approval), then WhatsApp (highest value), then SMS (A2P delay), then Instagram + Facebook (Meta approval).

TASK 2: Build and verify the web chat widget

cd packages/web-chat-widget && npm install && npm run build

Verify the IIFE bundle is generated. Check what the output file is and where it goes.
If the build fails, fix the issues.

Document the embed snippet in CHANNEL-SETUP.md:
```html
<script src="https://api.businesscommandcentre.com/widget/bookingos-chat.js"></script>
<script>
  BookingOSChat.init({ businessSlug: 'your-slug' });
</script>
```

(Adjust the actual URL/API based on how the widget is served — check if there's a static file serving endpoint or if it needs CDN hosting)

TASK 3: Verify MESSAGING_PROVIDER switching

Read packages/messaging-provider/src/ to understand how providers are registered. Verify that:
- When MESSAGING_PROVIDER=mock → messages are logged but not sent (dev mode)
- When MESSAGING_PROVIDER=whatsapp-cloud (or however the real mode is activated) → real providers are used
- There's no accidental fallback to mock in production

Document the switching mechanism in CHANNEL-SETUP.md.

Commit: "docs: comprehensive channel setup guide, verify web chat widget build"
```

### Session 6 — Admin App Tests + Production Data Cleanup

```
Two parallel tasks: fill the biggest test gap and prepare for real customers.

TASK 1: Add admin app test suite

The admin app at apps/admin/ has 20 routes and ZERO tests. This is the biggest test coverage gap.

First check test infrastructure:
- Does apps/admin/jest.config.ts exist? If not, create one based on apps/web/jest.config.ts (next/jest preset, jsdom)
- Is @testing-library/react available? If not, install it.

Create tests for the most critical admin pages. For each page:
- Test it renders without crashing (mock all API calls)
- Test key interactive elements exist
- Test loading/error states

Priority (create at least basic render tests for all):
1. apps/admin/src/app/businesses/page.tsx — business directory
2. apps/admin/src/app/businesses/[id]/page.tsx — Business 360
3. apps/admin/src/app/billing/page.tsx — billing dashboard
4. apps/admin/src/app/agents/page.tsx — agent governance
5. apps/admin/src/app/health/page.tsx — system health
6. apps/admin/src/app/messaging/page.tsx — messaging ops
7. apps/admin/src/app/audit/page.tsx — audit log
8. apps/admin/src/app/support/page.tsx — support cases
9. apps/admin/src/app/settings/page.tsx — platform settings
10. apps/admin/src/app/page.tsx — overview dashboard

For remaining pages, create minimal render tests.

Mock the API client (apps/admin/src/lib/api.ts) and next/navigation for all tests.

Target: 40+ tests covering all 20 routes.

TASK 2: Create production seed script

Create packages/db/src/seed-production.ts that seeds ONLY:
- Platform settings (from seed-console.ts, just the PlatformSetting records)
- Default PlatformAgentDefault records
- NO demo businesses, customers, or bookings

Make it idempotent (upsert, safe to re-run).

Add to packages/db/package.json: "seed:production": "tsx src/seed-production.ts"

Run tests: cd apps/admin && npx jest --maxWorkers=50%
Commit: "test: admin app test suite (20 routes), add production seed script"
```

---

## PHASE 3: Test Gaps + Continuous Delivery (Days 5–10, parallel)

### Session 7 — Missing Module Tests

```
Add tests for the 2 API modules with zero test coverage.

TASK 1: Instagram Auth Module

Read apps/api/src/modules/instagram-auth/ (controller, service, module).

Create instagram-auth.service.spec.ts covering:
- OAuth token exchange (mock HTTP calls to Instagram/Facebook API)
- Short-to-long-lived token exchange
- Daily token refresh cron logic
- Page lookup and Instagram Business Account selection
- Ice breaker configuration (validate 1-4 prompts)
- Disconnect flow (clear location config)
- Status check (connected, disconnected, expiring)
- Error paths: invalid code, expired token, no Instagram Business Account

Create instagram-auth.controller.spec.ts covering:
- GET /instagram-auth/authorize — generates correct OAuth URL with state
- GET /instagram-auth/callback — no auth guard, exchanges code
- DELETE /instagram-auth/:locationId/disconnect — requires auth
- GET /instagram-auth/:locationId/status
- POST /instagram-auth/:locationId/ice-breakers — validates array length (1-4)

TASK 2: Translation Module

Read apps/api/src/modules/translation/ (controller, service, module).

Create translation.service.spec.ts covering:
- Loading translations for a locale
- Key resolution with fallback (missing Spanish key → English)
- Business-level translation overrides
- Missing key handling

Create translation.controller.spec.ts covering:
- GET /translations/:locale — returns translations
- PUT /translations — creates/updates overrides
- Auth guards, validation

Run: cd apps/api && npx jest instagram-auth translation --maxWorkers=50%
Commit: "test: add instagram-auth and translation module tests"
```

### Session 8 — Staged Deployments + Bundle Tracking

```
Improve CI/CD for safer continuous delivery.

Read .github/workflows/ci.yml first. Make surgical edits only.

TASK 1: Implement staged deployment

Currently the deploy job runs all three `railway up` commands together. Change to sequential with health checks:

Step 1: Deploy API
  railway up --service api -p ${{ secrets.RAILWAY_PROJECT_ID }} -e production --detach

Step 2: Wait for API health (poll /api/v1/health every 5 seconds, timeout 5 minutes)

Step 3: Deploy Web (only if API healthy)
  railway up --service web -p ${{ secrets.RAILWAY_PROJECT_ID }} -e production --detach

Step 4: Wait for Web health (poll https://businesscommandcentre.com, timeout 5 minutes)

Step 5: Deploy Admin (only if Web healthy)
  railway up --service admin -p ${{ secrets.RAILWAY_PROJECT_ID }} -e production --detach

Step 6: Wait for Admin health (poll https://admin.businesscommandcentre.com, timeout 5 minutes)

If any health check fails, the workflow should fail and not proceed to next service.

TASK 2: Add bundle size reporting for PRs

Add a new step in the docker-build or lint-and-test job (whichever builds the web app) that:
- After building, runs: du -sh apps/web/.next/
- Posts the size as a job summary (echo "### Bundle Size" >> $GITHUB_STEP_SUMMARY)
- Optionally fails if total exceeds 60MB

TASK 3: Verify the existing smoke-test.sh

Read scripts/smoke-test.sh. Verify it actually tests meaningful endpoints:
- Health check
- Public booking portal
- Admin app
If it's minimal, enhance it to also check:
- POST /auth/login with demo credentials returns 200 (or skip if demo data removed)
- GET /api/v1/health returns { status: "healthy" }

Commit: "ci: staged deployments with health checks, bundle size reporting"
```

---

## PHASE 4: Mobile App via Capacitor (Days 8–14)

### Session 9 — Capacitor Scaffold + Platform Detection

```
Set up Capacitor to wrap the existing Next.js web app as native iOS + Android apps for business staff.

The web app at apps/web uses output: 'standalone' in next.config.js for production Docker builds. Capacitor needs a different approach.

IMPORTANT DECISION: Since the Capacitor config supports loading from a remote URL (server.url), we DON'T need static export at all. The native app will load from https://businesscommandcentre.com directly. This means:
- Zero code duplication
- Instant updates (no app store review for web changes)
- The native shell just provides push notifications + native feel

TASK 1: Add Capacitor dependencies
cd apps/web
npm install @capacitor/core @capacitor/cli @capacitor/app @capacitor/network @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences @capacitor/push-notifications

TASK 2: Initialize Capacitor
Create apps/web/capacitor.config.ts:

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookingos.staff',
  appName: 'Booking OS',
  webDir: 'out',  // fallback for offline, but primary load is from server
  server: {
    url: 'https://businesscommandcentre.com',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#71907C', // sage-600 from design system
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#FCFCFD', // warm off-white from design system
      showSpinner: false,
      launchShowDuration: 2000,
    },
  },
};

export default config;

TASK 3: Add platforms
cd apps/web
npx cap add ios
npx cap add android

TASK 4: Create platform detection hook
Create apps/web/src/hooks/useCapacitor.ts:

import { useEffect, useState } from 'react';

export function useCapacitor() {
  const [info, setInfo] = useState({ isNative: false, platform: 'web' as string });

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('@capacitor/core').then(({ Capacitor }) => {
      setInfo({
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
      });
    }).catch(() => {
      // Not in Capacitor context
    });
  }, []);

  return info;
}

TASK 5: Add safe area CSS
In apps/web/src/app/globals.css, add at the end:

/* Capacitor safe area insets for notched devices */
@supports (padding: env(safe-area-inset-top)) {
  .mobile-safe-top { padding-top: env(safe-area-inset-top); }
  .mobile-safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .mobile-safe-left { padding-left: env(safe-area-inset-left); }
  .mobile-safe-right { padding-right: env(safe-area-inset-right); }
}

Apply mobile-safe-top to the main app shell header/layout component. Read the shell layout to find where to add it.

TASK 6: Create a minimal static fallback for offline
Add to apps/web/package.json:
"build:mobile": "NEXT_OUTPUT=export next build || echo 'Static export not needed - using server URL'"

In next.config.js, add output conditional:
output: process.env.NEXT_OUTPUT === 'export' ? 'export' : 'standalone',

This is a fallback only — the app loads from the live server URL.

TASK 7: Sync and verify
npx cap sync

Verify ios/ and android/ directories exist. Add both to .gitignore with a comment explaining they're generated.

Add to apps/web/package.json scripts:
"cap:sync": "npx cap sync",
"cap:ios": "npx cap open ios",
"cap:android": "npx cap open android"

Commit: "mobile: scaffold Capacitor for iOS and Android with server-mode loading"
```

### Session 10 — Push Notifications

```
Add push notification support so staff get alerts when the app is backgrounded.

TASK 1: Add DeviceToken model to Prisma schema

In packages/db/prisma/schema.prisma, add:

model DeviceToken {
  id          String   @id @default(cuid())
  staffId     String
  businessId  String
  token       String
  platform    String   // 'ios' | 'android' | 'web'
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  staff       Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([staffId, token])
  @@index([businessId])
  @@index([staffId, isActive])
  @@map("device_tokens")
}

Add the relation fields (DeviceToken[]) to Staff and Business models.

Run: npx prisma migrate dev --name add_device_tokens --schema=packages/db/prisma/schema.prisma
Run: npx prisma generate --schema=packages/db/prisma/schema.prisma

TASK 2: Create DeviceToken API module

Create apps/api/src/modules/device-token/ with standard NestJS pattern:
- device-token.module.ts — imports PrismaService
- device-token.service.ts — register(staffId, businessId, token, platform), unregister(token), findActiveByStaff(staffId), findActiveByBusiness(businessId), deactivateStale()
- device-token.controller.ts:
  - POST /device-tokens — register token (body: { token, platform }), uses @BusinessId() and current user from JWT
  - DELETE /device-tokens/:token — unregister
  - Protected by TenantGuard + JwtAuthGuard
- DTOs with class-validator

Register in app.module.ts.

TASK 3: Create PushNotificationService

Create apps/api/src/modules/push-notification/:
- push-notification.service.ts
  - sendToStaff(staffId: string, notification: { title, body, data? }): Promise<void>
  - sendToBusiness(businessId: string, notification: { title, body, data? }): Promise<void>
  - Uses DeviceTokenService to get active tokens
  - For now, implement a SIMPLE HTTP-based push via Firebase Cloud Messaging (FCM) HTTP v1 API — this works for BOTH iOS and Android when configured through Firebase
  - Add FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_KEY env vars to .env.example
  - Graceful degradation: if FCM is not configured, log the notification instead of crashing
- push-notification.module.ts

TASK 4: Integrate with Socket.IO events for push fallback

Read the InboxGateway or wherever socket events are emitted. Find the methods that emit:
- message:new
- booking:updated
- action-card:created

For each, add push notification fallback: if the target staff has registered device tokens but NO active WebSocket connection (check presence tracking — the gateway already has viewing:start/viewing:stop), send a push notification.

Implementation: create a helper method shouldSendPush(staffId) that checks presence. Call pushNotificationService.sendToStaff() when shouldSendPush returns true.

Keep it simple — don't over-engineer. The push notification is a supplement to Socket.IO, not a replacement.

TASK 5: Create frontend push registration hook

Create apps/web/src/hooks/usePushNotifications.ts:
- Import PushNotifications from @capacitor/push-notifications
- Import useCapacitor hook
- On mount (native only): request permission, get token, POST to /device-tokens
- Listen for pushNotificationReceived (foreground) and pushNotificationActionPerformed (tap)
- On tap: navigate to relevant page based on notification data (inbox, bookings, etc.)
- On unmount: clean up listeners

Wire it into the app shell layout so it runs on app launch for native platforms.

TASK 6: Tests

- device-token.service.spec.ts — register, unregister, find, deactivate stale
- device-token.controller.spec.ts — auth guards, validation, happy/error paths
- push-notification.service.spec.ts — mock FCM, test fallback to logging when unconfigured

Run: cd apps/api && npx jest device-token push-notification --maxWorkers=50%
Commit: "mobile: push notifications with FCM integration and Socket.IO fallback"
```

### Session 11 — iOS + Android Build Config + App Icons

```
Configure the native iOS and Android projects for App Store / Play Store.

Prerequisites: apps/web/ios/ and apps/web/android/ directories from Session 9.

TASK 1: iOS Configuration

Edit apps/web/ios/App/App/Info.plist (or use PlistBuddy commands):
- CFBundleDisplayName: "Booking OS"
- Minimum deployment target: iOS 15.0
- Add NSCameraUsageDescription: "Booking OS needs camera access to capture photos for customer records"
- Add NSPhotoLibraryUsageDescription: "Booking OS needs photo library access to attach images to messages"
- Ensure push notification entitlement is present

Set in the Xcode project (via direct file edit or script):
- PRODUCT_BUNDLE_IDENTIFIER = com.bookingos.staff
- MARKETING_VERSION = 1.0.0
- CURRENT_PROJECT_VERSION = 1

TASK 2: Android Configuration

Edit apps/web/android/app/build.gradle:
- applicationId: "com.bookingos.staff"
- versionCode: 1
- versionName: "1.0.0"
- minSdkVersion: 24
- targetSdkVersion: 34

Edit apps/web/android/app/src/main/AndroidManifest.xml:
- Ensure INTERNET permission exists
- Add POST_NOTIFICATIONS permission for Android 13+

TASK 3: Generate app icons

Create a simple app icon using Node.js canvas or SVG:
- 1024x1024 PNG
- Sage-600 (#71907C) background with rounded corners
- White "B" letterform centered (bold, clean)
- Use this as the source for all platform icon sizes

Then create a script scripts/generate-app-icons.sh that:
- Takes the source PNG
- Generates iOS sizes: 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024
- Generates Android sizes: 48 (mdpi), 72 (hdpi), 96 (xhdpi), 144 (xxhdpi), 192 (xxxhdpi)
- Copies to correct directories in ios/ and android/

If ImageMagick/sips isn't available, generate the icons directly in Node.js using the canvas or sharp package.

TASK 4: Splash screen

Set splash screen background color:
- iOS: already handled by Capacitor SplashScreen plugin config (#FCFCFD)
- Android: edit values/styles.xml to set the splash theme background to #FCFCFD

TASK 5: Build scripts

Add to apps/web/package.json:
"cap:build": "npx cap sync",
"cap:ios:open": "npx cap open ios",
"cap:android:open": "npx cap open android"

TASK 6: Create mobile release documentation

Add to DEPLOY.md a "## Mobile App Releases" section:
- How to build iOS: open Xcode via `npm run cap:ios:open`, archive, upload to TestFlight
- How to build Android: open Android Studio via `npm run cap:android:open`, build signed AAB, upload to Play Console
- Required accounts: Apple Developer ($99/yr), Google Play Console ($25 one-time)
- Required secrets for CI: IOS_SIGNING_CERTIFICATE, ANDROID_KEYSTORE (for future CI builds)

Commit: "mobile: iOS and Android build config, app icons, release docs"
```

### Session 12 — Mobile CI/CD Pipeline

```
Create a GitHub Actions workflow for building and distributing mobile apps.

TASK 1: Create .github/workflows/mobile.yml

Triggered on:
- Push of tags matching 'mobile-v*' (e.g., mobile-v1.0.0)
- Manual workflow_dispatch with version input

Job 1: build-android
  runs-on: ubuntu-latest
  steps:
  - Checkout
  - Setup Node.js + install dependencies
  - cd apps/web && npx cap sync android
  - Setup JDK 17 (actions/setup-java@v4)
  - Decode ANDROID_KEYSTORE from base64 secret → keystore.jks
  - Build release AAB: cd apps/web/android && ./gradlew bundleRelease
  - Sign with keystore
  - Upload AAB as artifact

Job 2: build-ios
  runs-on: macos-latest
  steps:
  - Checkout
  - Setup Node.js + install dependencies
  - cd apps/web && npx cap sync ios
  - Setup Xcode (maxim-lobanov/setup-xcode@v1)
  - Import signing certificate from IOS_SIGNING_CERTIFICATE secret
  - Import provisioning profile from IOS_PROVISIONING_PROFILE secret
  - Build archive: xcodebuild -workspace ios/App/App.xcworkspace -scheme App archive
  - Export IPA
  - Upload IPA as artifact

Both jobs should be independent (run in parallel).

TASK 2: Create ExportOptions.plist for iOS

Create apps/web/ios/ExportOptions.plist with app-store distribution method. Use the bundle ID com.bookingos.staff.

TASK 3: Document secret setup

In DEPLOY.md under "## Mobile App Releases", add:

Required GitHub Secrets:
- ANDROID_KEYSTORE: base64-encoded .jks file (generate with keytool)
- ANDROID_KEYSTORE_PASSWORD: keystore password
- ANDROID_KEY_ALIAS: key alias
- ANDROID_KEY_PASSWORD: key password
- IOS_SIGNING_CERTIFICATE: base64-encoded .p12 certificate
- IOS_SIGNING_PASSWORD: certificate password
- IOS_PROVISIONING_PROFILE: base64-encoded .mobileprovision

Include commands to generate Android keystore:
keytool -genkeypair -v -keystore bookingos.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bookingos

And to base64 encode for GitHub secrets:
base64 -i bookingos.jks | pbcopy

Commit: "ci: mobile build pipeline for iOS and Android"
```

---

## External Setup Tasks (Start Day 1 — These Have Lead Time)

### Stripe (you have an account)
1. Create 3 products (Starter, Professional, Enterprise) with monthly + annual prices matching: $49/$99/$199 monthly, $39/$79/$159 annually
2. Create webhook endpoint: `https://api.businesscommandcentre.com/api/v1/billing/webhook`
3. Subscribe to events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted, customer.subscription.updated, customer.subscription.trial_will_end, payment_intent.succeeded, payment_intent.payment_failed
4. Set env vars in Railway (all 8 STRIPE_* variables)
5. Test in Stripe test mode first, switch to live after verification

### Meta (you have an account)
1. WhatsApp: Get Phone Number ID + Permanent Access Token from API Setup. Configure webhook URL + verify token in Railway.
2. Instagram: Ensure Facebook App has instagram_manage_messages permission. Set webhook URL. The OAuth flow is built — users connect via app settings.
3. Facebook: Subscribe page to Messenger webhooks. Set verify token.

### Twilio
1. Create account, purchase phone number
2. Start A2P 10DLC registration (required for US SMS, takes days-weeks)
3. Set webhook URL in phone number config
4. Set 4 TWILIO_* env vars in Railway

### Resend
1. Create account, add sending domain, verify DNS (SPF, DKIM, DMARC)
2. Set EMAIL_PROVIDER=resend, EMAIL_API_KEY, EMAIL_FROM in Railway

### Apple Developer + Google Play
1. Apple Developer Program enrollment ($99/year) — needed for TestFlight + App Store
2. Google Play Console ($25 one-time) — needed for Play Store

### Railway
1. Verify PostgreSQL daily backups enabled in dashboard
2. Set all environment variables from Stripe, Meta, Twilio, Resend setup
3. Ensure MESSAGING_PROVIDER is NOT 'mock' for production

### Generate Production Secrets
```bash
# Run locally to generate fresh secrets
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → JWT_REFRESH_SECRET
openssl rand -hex 16  # → WHATSAPP_VERIFY_TOKEN
openssl rand -hex 16  # → INSTAGRAM_VERIFY_TOKEN
openssl rand -hex 16  # → FACEBOOK_VERIFY_TOKEN
openssl rand -hex 32  # → CALENDAR_ENCRYPTION_KEY
```
