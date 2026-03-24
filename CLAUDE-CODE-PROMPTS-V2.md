# Booking OS — Claude Code Prompts (Post-Audit)

> **Generated March 23, 2026** from comprehensive 6-agent codebase audit.
>
> **Phase 1 (Sessions 1–3) already completed:** Database indexes, Redis brute force, refresh token rotation, rate limiting expansion, CI security hardening, backup system, operational runbooks.
>
> **How to use:** Copy each prompt block into Claude Code in your terminal. Run sessions in order within each phase. Sessions marked ⚡ can run in parallel.

---

## PHASE 2: Go-Live Configuration (Days 4–5)

### Session 4 — Stripe Dashboard Config + Verification

```
The Stripe billing code is FULLY IMPLEMENTED in this codebase — 8 webhook events, dunning sequence, deposit payments, plan switching with proration. DO NOT rewrite billing code. This session creates the setup guide and adds a verification endpoint.

TASK 1: Create Stripe setup guide

Create docs/STRIPE-SETUP.md with exact steps for Stripe Dashboard configuration:

Products & Prices — create 3 products with 2 prices each (6 total):
- Starter: $49/month (monthly), $39/month billed annually ($468/year)
- Professional: $99/month (monthly), $79/month billed annually ($948/year)
- Enterprise: $199/month (monthly), $159/month billed annually ($1,908/year)

These prices are hardcoded in apps/api/src/modules/billing/billing.service.ts. The Stripe prices must match exactly.

Webhook endpoint configuration:
- URL: https://api.businesscommandcentre.com/api/v1/billing/webhook
- Events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted, customer.subscription.updated, customer.subscription.trial_will_end, payment_intent.succeeded, payment_intent.payment_failed

Railway environment variables to set after Stripe setup:
- STRIPE_SECRET_KEY=sk_live_...
- STRIPE_WEBHOOK_SECRET=whsec_...
- STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
- STRIPE_PRICE_ID_STARTER_ANNUAL=price_...
- STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_...
- STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL=price_...
- STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=price_...
- STRIPE_PRICE_ID_ENTERPRISE_ANNUAL=price_...

Include a "Testing Checklist" section with curl commands to verify the webhook endpoint is reachable and Stripe test mode checkout works.

TASK 2: Verify webhook raw body handling

Read apps/api/src/main.ts and confirm rawBody: true is set in NestFactory.create() options. This is critical — Stripe's stripe.webhooks.constructEvent() requires the raw request body to verify signatures. If rawBody is not configured, the webhook will silently reject all events with a 400 error.

Also read the billing controller's webhook handler to confirm it accesses the raw body correctly (usually via @Req() req with req.rawBody).

If anything is missing, fix it. If it's already correct, note it in the setup guide.

TASK 3: Trace the full checkout flow in code

Trace these code paths and verify each has proper error handling:
1. Frontend /upgrade or /pricing page → calls POST /billing/checkout
2. BillingController creates Stripe Checkout Session with correct price ID
3. Returns checkout URL → frontend redirects to Stripe
4. Stripe fires checkout.session.completed webhook after payment
5. Webhook handler creates/updates Subscription record
6. Trial end → active → past_due (invoice.payment_failed) → dunning → canceled

Verify the controller validates plan name and billing interval. Document any issues found.

TASK 4: Add billing health check endpoint

Add GET /billing/health to BillingController (protect with @Roles('SUPER_ADMIN')):
- Call stripe.balance.retrieve() to verify the API key works
- Check which STRIPE_PRICE_ID_* env vars are set vs missing
- Return { status: 'ok' | 'degraded', configuredPrices: string[], missingPrices: string[], stripeConnected: boolean }

Write tests for the health check (mock Stripe SDK).

Run: cd apps/api && npx jest billing --maxWorkers=50%
Commit: "billing: Stripe setup guide, verify webhook handling, add billing health check"
```

### Session 5 — Channel Configuration + Web Chat Widget Build

```
All 6 messaging channels are fully implemented with HMAC signature verification, circuit breakers, and delivery tracking. This session creates the setup documentation and verifies the web chat widget builds.

TASK 1: Create channel setup guide

Create docs/CHANNEL-SETUP.md with exact configuration steps for each channel:

WHATSAPP:
- Prerequisites: Meta Business Account (verified), WhatsApp Business API access
- Meta Business Suite → API Setup → get Phone Number ID + generate Permanent Access Token
- Webhook URL: https://api.businesscommandcentre.com/api/v1/whatsapp/webhook
- Set WHATSAPP_VERIFY_TOKEN in Railway (any random string, must match what you enter in Meta)
- Railway env vars: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN
- Verification test: send a WhatsApp message to the number, check it arrives in the inbox

INSTAGRAM:
- Prerequisites: Facebook App with instagram_manage_messages permission, Instagram Business Account linked to Facebook Page
- The app has a built-in OAuth flow — users connect via Settings → Channels → Instagram
- Daily cron refreshes tokens expiring within 10 days
- Webhook URL: https://api.businesscommandcentre.com/api/v1/instagram/webhook
- Railway env vars: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_VERIFY_TOKEN

FACEBOOK MESSENGER:
- Prerequisites: Facebook Page with Messenger, Facebook App with pages_messaging permission
- Webhook URL: https://api.businesscommandcentre.com/api/v1/facebook/webhook
- Subscribe the page to messaging webhooks in Facebook App dashboard
- Railway env vars: FACEBOOK_VERIFY_TOKEN, FACEBOOK_APP_SECRET

SMS (TWILIO):
- Prerequisites: Twilio account, phone number, A2P 10DLC registration (US — takes days/weeks)
- Configure webhook in Twilio phone number settings
- Webhook URL: https://api.businesscommandcentre.com/api/v1/sms/webhook
- Railway env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_URL

EMAIL (RESEND):
- Prerequisites: Resend account, verified domain (SPF + DKIM + DMARC DNS records)
- Inbound webhook: https://api.businesscommandcentre.com/api/v1/email/webhook
- Railway env vars: EMAIL_PROVIDER=resend, EMAIL_API_KEY=re_..., EMAIL_FROM=noreply@yourdomain.com, SENDGRID_INBOUND_WEBHOOK_SECRET (if using SendGrid inbound)

WEB CHAT:
- No third-party accounts needed — self-hosted
- Build command: cd packages/web-chat-widget && npm run build
- Location config stored in Location.webChatConfig JSON field
- Public config endpoint: GET /public/chat/config/:businessSlug

Include a "Recommended Setup Order" section: Web Chat + Email first (no approval needed), then WhatsApp (highest customer value), then SMS (A2P delay), then Instagram + Facebook (Meta review).

TASK 2: Build and verify the web chat widget

Run: cd packages/web-chat-widget && npm install && npm run build

Check what the output bundle is (filename, location, size). Verify it generates a working IIFE bundle. If the build fails, fix it.

Document the embed snippet in CHANNEL-SETUP.md:
```html
<script src="https://api.businesscommandcentre.com/widget/bookingos-chat.js"></script>
<script>BookingOSChat.init({ businessSlug: 'your-slug' });</script>
```

Check how the widget is actually served — is there a static file serving route in the API? If not, document alternatives (CDN, S3, or serving from the API's public directory).

TASK 3: Verify MESSAGING_PROVIDER switching

Read packages/messaging-provider/src/ to understand how providers are loaded. Verify:
- MESSAGING_PROVIDER=mock → messages logged, not sent (safe for dev)
- MESSAGING_PROVIDER=whatsapp-cloud (or whatever the production value is) → real providers used
- There's no accidental fallback to mock when env var is missing

Document the switching mechanism in CHANNEL-SETUP.md.

Commit: "docs: channel setup guide, verify web chat widget build"
```

---

## PHASE 3: Test Coverage + Code Gaps (Days 5–8)

### Session 6 — Admin App Test Suite ⚡

```
The admin app at apps/admin/ has 20 routes and ZERO test files. This is the single biggest test coverage gap in the codebase.

TASK 1: Set up test infrastructure

Check if apps/admin/ has a working test setup:
- Does jest.config.ts (or jest.config.js) exist? If not, create one based on apps/web/jest.config.ts — use next/jest preset with jsdom testEnvironment
- Is @testing-library/react installed? If not: cd apps/admin && npm install -D @testing-library/react @testing-library/jest-dom jest @types/jest
- Create apps/admin/src/test-utils.tsx with a render wrapper that provides any needed context (router mock, etc.)
- Mock apps/admin/src/lib/api.ts globally in a jest setup file

TASK 2: Create tests for all 20 admin routes

For each page, create a test file co-located with the page that verifies:
- Component renders without crashing (smoke test)
- Key UI elements are present (headings, tables, buttons)
- Loading states render correctly
- Error handling works (mock API returning errors)

Mock next/navigation (useRouter, useParams, usePathname) for all tests.
Mock the API client to return reasonable mock data.

Pages to test (all in apps/admin/src/app/):
1.  page.tsx — Overview dashboard (KPI cards, recent activity)
2.  businesses/page.tsx — Business directory table
3.  businesses/[id]/page.tsx — Business 360 detail view
4.  billing/page.tsx — Billing dashboard
5.  billing/past-due/page.tsx — Past-due businesses
6.  billing/subscriptions/page.tsx — Subscription management
7.  agents/page.tsx — Agent governance dashboard
8.  messaging/page.tsx — Messaging operations
9.  health/page.tsx — System health checks
10. audit/page.tsx — Audit log viewer
11. support/page.tsx — Support cases
12. settings/page.tsx — Platform settings
13. packs/page.tsx — Pack registry
14. packs/[slug]/page.tsx — Pack detail
15. packs/skills/page.tsx — Pack skills
16. marketing/page.tsx — Marketing landing
17. marketing/queue/page.tsx — Content approval queue
18. marketing/agents/page.tsx — Marketing agents
19. marketing/sequences/page.tsx — Email sequences
20. marketing/rejection-analytics/page.tsx — Rejection analytics

Target: at least 2 test cases per page (render + one interaction or state), totaling 40+ tests.

Run: cd apps/admin && npx jest --maxWorkers=50%
Commit: "test: admin app test suite covering all 20 routes"
```

### Session 7 — Missing API Module Tests ⚡

```
Two API modules have zero test coverage. Add comprehensive tests for both.

TASK 1: Instagram Auth Module Tests

Read apps/api/src/modules/instagram-auth/ completely (controller, service, module, any DTOs).

Create instagram-auth.service.spec.ts testing:
- OAuth URL generation with correct scopes and state parameter
- Authorization code exchange (mock HTTP to Facebook Graph API)
- Short-lived to long-lived token exchange
- Token refresh cron logic (identifies tokens expiring within 10 days)
- Page lookup and Instagram Business Account selection
- Ice breaker configuration (1-4 prompts, validates array length)
- Disconnect flow (clears location Instagram config)
- Status check (connected, disconnected, token expiring)
- Error paths: invalid code, expired token, no Instagram Business Account found, rate limited

Create instagram-auth.controller.spec.ts testing:
- GET /instagram-auth/authorize — returns correct OAuth URL
- GET /instagram-auth/callback — exchanges code, no auth guard on this route
- DELETE /instagram-auth/:locationId/disconnect — requires auth + tenant guard
- GET /instagram-auth/:locationId/status — returns connection status
- POST /instagram-auth/:locationId/ice-breakers — validates 1-4 items, rejects 0 or 5+

TASK 2: Translation Module Tests

Read apps/api/src/modules/translation/ completely.

Create translation.service.spec.ts testing:
- Loading translations for 'en' locale
- Loading translations for 'es' locale
- Key resolution with fallback (missing Spanish key falls back to English)
- Business-level translation overrides (custom labels per tenant)
- Missing key handling (returns key itself or placeholder)

Create translation.controller.spec.ts testing:
- GET /translations/:locale — returns translation object
- PUT /translations — creates/updates business overrides
- Auth guards present and functional
- Validation on locale parameter

Run: cd apps/api && npx jest instagram-auth translation --maxWorkers=50%
Commit: "test: instagram-auth and translation module tests"
```

### Session 8 — CALENDAR_SYNC Queue Processor + Audit Fixes

```
The codebase audit found several small but important gaps. Fix them all in this session.

TASK 1: Implement CALENDAR_SYNC queue processor

The CALENDAR_SYNC queue is registered in BullMQ but has no dedicated processor file.

Read apps/api/src/common/queue/ to see how other processors are structured (look at the AI_PROCESSING or MESSAGING processor as examples).

Read apps/api/src/modules/calendar-sync/ (or wherever calendar sync logic lives) to understand what jobs should do.

Create the processor file following the same pattern as existing processors:
- Process calendar sync jobs (Google Calendar / Outlook sync)
- Handle errors gracefully with logging
- Use the same retry/backoff pattern as other processors

Register the processor in the appropriate module.

If the calendar sync module doesn't have enough implementation to warrant a real processor, create a minimal processor that:
- Accepts jobs from the queue
- Logs the job data
- Calls any existing CalendarSyncService methods
- Has proper error handling

TASK 2: Make Trivy scanning blocking for CRITICAL vulnerabilities

Read .github/workflows/ci.yml and find the Trivy scan step.

Change exit-code from 0 to 1, BUT only for CRITICAL severity. This way:
- CRITICAL vulnerabilities fail the build (must fix)
- HIGH/MEDIUM/LOW are reported but don't block

Update the Trivy step:
  --severity CRITICAL
  --exit-code 1

Keep a second Trivy run (or expand the same one) that reports HIGH,MEDIUM as informational (exit-code 0) in the GitHub step summary.

TASK 3: Create production seed script

Create packages/db/src/seed-production.ts that seeds ONLY what a fresh production database needs:
- PlatformSetting records (from seed-console.ts logic)
- PlatformAgentDefault records
- Default AutonomyConfig templates
- NO demo businesses, customers, bookings, or conversations

Make it fully idempotent (upsert pattern, safe to run multiple times).

Add to packages/db/package.json scripts: "seed:production": "tsx src/seed-production.ts"

TASK 4: Fix npm audit to be meaningful

Read .github/workflows/ci.yml. The npm audit step has continue-on-error: true, making it purely informational. Change it to:
- Run npm audit --audit-level=critical --omit=dev (fail on critical only)
- Remove continue-on-error: true for this stricter check
- Add a SEPARATE informational step: npm audit --audit-level=high --omit=dev with continue-on-error: true

This gives two signals: critical = must fix (blocks CI), high = should fix (warns but passes).

Run all tests: cd apps/api && npx jest --maxWorkers=50%
Commit: "fix: CALENDAR_SYNC processor, blocking Trivy, production seed, strict npm audit"
```

---

## PHASE 4: CI/CD Hardening (Day 8–9)

### Session 9 — Staged Deployments + Bundle Monitoring

```
Improve CI/CD for safer continuous delivery with zero-downtime deploys.

Read .github/workflows/ci.yml thoroughly before making any changes. Make surgical edits only.

TASK 1: Implement staged deployment with health check gates

The deploy job should deploy services sequentially with health verification between each:

Step 1: Deploy API
  railway up --service api -p ${{ secrets.RAILWAY_PROJECT_ID }} -e production --detach

Step 2: Poll API health
  Poll https://api.businesscommandcentre.com/api/v1/health every 5 seconds.
  Timeout after 300 seconds (5 minutes). Fail the workflow if health never returns 200.
  Use a bash while loop with curl, NOT a sleep-and-pray approach.

Step 3: Deploy Web (only runs if Step 2 passed)
  railway up --service web -p ${{ secrets.RAILWAY_PROJECT_ID }} -e production --detach

Step 4: Poll Web health
  Poll https://businesscommandcentre.com/api/v1/health every 5 seconds, 300-second timeout.

Step 5: Deploy Admin (only runs if Step 4 passed)
  railway up --service admin -p ${{ secrets.RAILWAY_PROJECT_ID }} -e production --detach

Step 6: Poll Admin health
  Poll https://admin.businesscommandcentre.com every 5 seconds, 300-second timeout.

If any health check fails, the workflow stops — downstream services are NOT deployed.

TASK 2: Add bundle size tracking

In the job that builds the web app, add a step after the build that:
- Calculates bundle size: du -sh apps/web/.next/ | cut -f1
- Writes to GitHub Step Summary:
  echo "### 📦 Bundle Size" >> $GITHUB_STEP_SUMMARY
  echo "Web: $(du -sh apps/web/.next/ | cut -f1)" >> $GITHUB_STEP_SUMMARY
- Fails the build if .next/ exceeds 60MB (extract numeric value and compare)

TASK 3: Verify smoke-test.sh coverage

Read scripts/smoke-test.sh. Verify it covers these categories:
- API health endpoint returns 200
- Public booking portal loads
- Admin app loads
- Static assets load (JS, CSS)
- Auth endpoint is reachable (POST /auth/login returns 401 for bad creds, not 500)

If any category is missing, add it. Keep the script idempotent and fast (<30 seconds).

Commit: "ci: staged deployments with health gates, bundle size tracking"
```

---

## PHASE 5: Mobile App (Days 10–14)

### Session 10 — Capacitor Scaffold + Platform Detection

```
Set up Capacitor to wrap the existing Next.js web app as native iOS and Android apps.

IMPORTANT: The native app loads from the LIVE server URL (https://businesscommandcentre.com). This means zero code duplication, instant web updates without app store review, and the native shell just provides push notifications and native feel.

TASK 1: Install Capacitor dependencies

cd apps/web
npm install @capacitor/core @capacitor/cli @capacitor/app @capacitor/network @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences @capacitor/push-notifications

TASK 2: Create Capacitor config

Create apps/web/capacitor.config.ts:

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookingos.staff',
  appName: 'Booking OS',
  webDir: 'out',
  server: {
    url: 'https://businesscommandcentre.com',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#71907C',
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#FCFCFD',
      showSpinner: false,
      launchShowDuration: 2000,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

TASK 3: Add native platforms

cd apps/web
npx cap add ios
npx cap add android

TASK 4: Create platform detection hook

Create apps/web/src/hooks/useCapacitor.ts:

import { useEffect, useState } from 'react';

interface CapacitorInfo {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
}

export function useCapacitor(): CapacitorInfo {
  const [info, setInfo] = useState<CapacitorInfo>({ isNative: false, platform: 'web' });

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      setInfo({
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform() as CapacitorInfo['platform'],
      });
    }).catch(() => {
      // Not in Capacitor context — web browser
    });
  }, []);

  return info;
}

TASK 5: Add safe area CSS for notched devices

In apps/web/src/app/globals.css, add at the end:

/* Capacitor safe area insets for notched devices */
@supports (padding: env(safe-area-inset-top)) {
  .mobile-safe-top { padding-top: env(safe-area-inset-top); }
  .mobile-safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .mobile-safe-left { padding-left: env(safe-area-inset-left); }
  .mobile-safe-right { padding-right: env(safe-area-inset-right); }
}

Find the main app shell layout component and apply mobile-safe-top to the outermost wrapper. Read the layout file first to understand its structure.

TASK 6: Add conditional output mode for Next.js

In apps/web/next.config.js, make the output mode configurable:
output: process.env.NEXT_OUTPUT === 'export' ? 'export' : 'standalone',

Add to package.json scripts:
"build:mobile": "NEXT_OUTPUT=export next build",
"cap:sync": "npx cap sync",
"cap:ios": "npx cap open ios",
"cap:android": "npx cap open android"

TASK 7: Sync and verify

Run: cd apps/web && npx cap sync

Verify ios/ and android/ directories were created. Add both to .gitignore:
# Capacitor native projects (generated)
apps/web/ios/
apps/web/android/

Commit: "mobile: Capacitor scaffold with server-mode loading for iOS and Android"
```

### Session 11 — Push Notifications (Backend + Frontend)

```
Add push notification support so business staff get alerts when the app is backgrounded.

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

Add DeviceToken[] relation fields to both the Staff and Business models.

Run: npx prisma migrate dev --name add_device_tokens --schema=packages/db/prisma/schema.prisma
Run: npx prisma generate --schema=packages/db/prisma/schema.prisma

TASK 2: Create DeviceToken API module

Create apps/api/src/modules/device-token/ following the standard NestJS pattern:

device-token.module.ts — register PrismaService
device-token.service.ts:
  - register(staffId, businessId, token, platform) — upsert by staffId+token
  - unregister(token) — mark isActive: false
  - findActiveByStaff(staffId) — returns active tokens for a staff member
  - findActiveByBusiness(businessId) — returns all active tokens for a business
  - deactivateStale() — deactivate tokens not updated in 90 days (for a cron job)

device-token.controller.ts:
  - POST /device-tokens — register token (body: { token, platform }), extract staffId from JWT and businessId from @BusinessId()
  - DELETE /device-tokens/:token — deactivate token
  - Protected by TenantGuard + JwtAuthGuard

DTOs with class-validator decorators.
Register module in app.module.ts.

TASK 3: Create PushNotificationService

Create apps/api/src/modules/push-notification/:

push-notification.service.ts:
  - sendToStaff(staffId, notification: { title, body, data? }) — get active tokens via DeviceTokenService, send via FCM HTTP v1 API
  - sendToBusiness(businessId, notification: { title, body, data? }) — get all business tokens, send batch
  - Use Firebase Cloud Messaging HTTP v1 API (works for both iOS and Android through Firebase)
  - Add to .env.example: FCM_PROJECT_ID, FCM_SERVICE_ACCOUNT_KEY (JSON)
  - CRITICAL: Graceful degradation — if FCM is not configured (env vars missing), log the notification payload instead of crashing. Return success so callers don't need to handle push failures.

push-notification.module.ts — export PushNotificationService

TASK 4: Integrate push with existing Socket.IO events

Read the InboxGateway (apps/api/src/modules/inbox/ or wherever WebSocket events are emitted). Find where these events are emitted:
- message:new
- booking:updated
- action-card:created

For each event, add push notification fallback: if the target staff member has registered device tokens but NO active WebSocket connection, send a push notification instead.

The gateway already has presence tracking (viewing:start/viewing:stop). Create a helper:
  async shouldSendPush(staffId: string): Promise<boolean>
  — returns true if staff has device tokens but no active socket connection

Call pushNotificationService.sendToStaff() when shouldSendPush returns true.

Keep it simple. Push supplements Socket.IO — it's NOT a replacement.

TASK 5: Frontend push registration hook

Create apps/web/src/hooks/usePushNotifications.ts:
- Import PushNotifications from @capacitor/push-notifications
- Import the useCapacitor hook from Task 4 of the previous session
- On mount (native platforms only):
  1. Request permission
  2. Register for push notifications
  3. On registration success: POST token to /device-tokens with the correct platform
- Listen for pushNotificationReceived (foreground): show in-app toast or badge
- Listen for pushNotificationActionPerformed (user tapped notification): navigate to relevant page based on notification.data (e.g., /inbox, /bookings/:id)
- On unmount: remove listeners
- Export the hook

Wire it into the main app shell layout so it runs once on app launch for native platforms only. Use the isNative check from useCapacitor to guard the entire flow.

TASK 6: Write tests

Create:
- device-token.service.spec.ts — register, unregister, findActiveByStaff, deactivateStale
- device-token.controller.spec.ts — auth guards, validation, happy paths, error paths (duplicate token, missing fields)
- push-notification.service.spec.ts — mock FCM HTTP calls, test graceful degradation when FCM not configured, test batch sending

Run: cd apps/api && npx jest device-token push-notification --maxWorkers=50%
Commit: "mobile: push notifications with FCM, device token API, Socket.IO fallback"
```

### Session 12 — iOS + Android Build Config

```
Configure the native projects for App Store and Play Store distribution.

Prerequisites: apps/web/ios/ and apps/web/android/ directories must exist from Session 10.

TASK 1: iOS configuration

Edit apps/web/ios/App/App/Info.plist:
- Set CFBundleDisplayName to "Booking OS"
- Set MinimumOSVersion to 15.0
- Add NSCameraUsageDescription: "Booking OS needs camera access to capture photos for customer records"
- Add NSPhotoLibraryUsageDescription: "Booking OS needs photo library access to attach images"
- Verify push notification entitlement is present (aps-environment)

In the Xcode project.pbxproj (or via direct file editing):
- PRODUCT_BUNDLE_IDENTIFIER = com.bookingos.staff
- MARKETING_VERSION = 1.0.0
- CURRENT_PROJECT_VERSION = 1

TASK 2: Android configuration

Edit apps/web/android/app/build.gradle:
- applicationId "com.bookingos.staff"
- versionCode 1
- versionName "1.0.0"
- minSdkVersion 24
- targetSdkVersion 34
- compileSdkVersion 34

Edit apps/web/android/app/src/main/AndroidManifest.xml:
- Verify INTERNET permission
- Add: <uses-permission android:name="android.permission.POST_NOTIFICATIONS" /> (Android 13+)

TASK 3: Generate app icon

Create a Node.js script at scripts/generate-app-icon.js that:
- Creates a 1024x1024 PNG with sage-600 (#71907C) background
- Centered white bold "B" lettermark
- Uses the sharp npm package (npm install -D sharp) or canvas
- Generates all required sizes:
  iOS: 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024
  Android: 48 (mdpi), 72 (hdpi), 96 (xhdpi), 144 (xxhdpi), 192 (xxxhdpi)
- Copies to the correct directories under ios/ and android/

Run the script after creating it.

TASK 4: Android splash screen

Edit apps/web/android/app/src/main/res/values/styles.xml:
- Set the splash background color to #FCFCFD (warm off-white from design system)

TASK 5: Add build scripts to package.json

In apps/web/package.json, add or update:
"cap:build": "npx cap sync",
"cap:ios:open": "npx cap open ios",
"cap:android:open": "npx cap open android"

TASK 6: Document mobile release process

Add a "## Mobile App Releases" section to DEPLOY.md:

iOS Release:
1. npm run cap:build (syncs web assets)
2. npm run cap:ios:open (opens Xcode)
3. In Xcode: Product → Archive → Distribute App → App Store Connect
4. Upload to TestFlight for beta testing
5. Submit for App Store review

Android Release:
1. npm run cap:build
2. npm run cap:android:open (opens Android Studio)
3. Build → Generate Signed Bundle/APK → Android App Bundle (.aab)
4. Upload to Google Play Console → Internal testing track
5. Promote to production after testing

Required Accounts:
- Apple Developer Program ($99/year)
- Google Play Console ($25 one-time)

Required GitHub Secrets (for future CI):
- ANDROID_KEYSTORE (base64-encoded .jks)
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
- IOS_SIGNING_CERTIFICATE (base64-encoded .p12)
- IOS_SIGNING_PASSWORD
- IOS_PROVISIONING_PROFILE (base64-encoded .mobileprovision)

Generate Android keystore: keytool -genkeypair -v -keystore bookingos.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bookingos

Commit: "mobile: iOS + Android build config, app icons, release documentation"
```

### Session 13 — Mobile CI/CD Pipeline

```
Create a GitHub Actions workflow for automated mobile builds.

TASK 1: Create .github/workflows/mobile.yml

Trigger on:
- Push of tags matching 'mobile-v*' (e.g., mobile-v1.0.0)
- Manual workflow_dispatch with a version input

Job 1: build-android (runs-on: ubuntu-latest)
  steps:
  - Checkout code
  - Setup Node.js 22 + npm ci
  - cd apps/web && npx cap sync android
  - Setup JDK 17 (actions/setup-java@v4 with distribution: temurin)
  - Decode ANDROID_KEYSTORE secret from base64 to apps/web/android/keystore.jks
  - Build release AAB:
    cd apps/web/android && ./gradlew bundleRelease
    -Pandroid.injected.signing.store.file=$GITHUB_WORKSPACE/apps/web/android/keystore.jks
    -Pandroid.injected.signing.store.password=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
    -Pandroid.injected.signing.key.alias=${{ secrets.ANDROID_KEY_ALIAS }}
    -Pandroid.injected.signing.key.password=${{ secrets.ANDROID_KEY_PASSWORD }}
  - Upload AAB as artifact (actions/upload-artifact@v4, retention-days: 30)

Job 2: build-ios (runs-on: macos-latest)
  steps:
  - Checkout code
  - Setup Node.js 22 + npm ci
  - cd apps/web && npx cap sync ios
  - Setup Xcode (maxim-lobanov/setup-xcode@v1, xcode-version: latest-stable)
  - Create keychain, import signing certificate from IOS_SIGNING_CERTIFICATE secret
  - Import provisioning profile from IOS_PROVISIONING_PROFILE secret
  - Build archive:
    xcodebuild -workspace apps/web/ios/App/App.xcworkspace
    -scheme App -configuration Release
    -archivePath build/App.xcarchive archive
    CODE_SIGN_STYLE=Manual
  - Export IPA using ExportOptions.plist
  - Upload IPA as artifact (retention-days: 30)
  - Clean up keychain

Both jobs run in parallel (no dependency between them).

TASK 2: Create iOS ExportOptions.plist

Create apps/web/ios/ExportOptions.plist:
- method: app-store
- teamID: (use placeholder $TEAM_ID — document that this needs to be set)
- bundleID: com.bookingos.staff
- signingStyle: manual

TASK 3: Document the mobile release workflow

In DEPLOY.md under "## Mobile App Releases", add a "### Automated Builds" subsection:

To trigger a mobile build:
  git tag mobile-v1.0.0
  git push origin mobile-v1.0.0

Or manually via GitHub Actions → Mobile Build → Run workflow.

The workflow produces:
- Android: signed .aab artifact (upload to Play Console)
- iOS: signed .ipa artifact (upload to App Store Connect via Transporter)

Required secrets setup:
1. Generate Android keystore: keytool -genkeypair ...
2. Base64 encode: base64 -i bookingos.jks | pbcopy
3. Add to GitHub Secrets: ANDROID_KEYSTORE, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
4. Export iOS certificate from Keychain as .p12
5. Base64 encode certificate and provisioning profile
6. Add to GitHub Secrets: IOS_SIGNING_CERTIFICATE, IOS_SIGNING_PASSWORD, IOS_PROVISIONING_PROFILE

Commit: "ci: mobile build pipeline for iOS and Android"
```

---

## PHASE 6: Final Hardening (Day 14)

### Session 14 — Remaining Audit Gaps

```
Close out the remaining smaller gaps identified in the codebase audit.

TASK 1: Implement Web Chat file upload (replace stub)

Read packages/web-chat-widget/ and apps/api/src/modules/inbox/ (specifically the WebChatGateway).

The web chat currently has a stub for file:upload-request that returns "not yet supported". Implement basic file upload:

- In the WebChatGateway, handle file:upload events
- Accept base64-encoded file data with metadata (filename, mimeType, size)
- Validate: max 5MB, allowed types (image/png, image/jpeg, image/gif, application/pdf)
- Store the file (check if there's an existing file storage service — look for S3, local uploads, or similar patterns in the codebase)
- Create a Message record with the file attachment
- Emit the message to the conversation

If there's no file storage infrastructure, implement a simple local storage approach (save to a uploads/ directory served statically) with a TODO comment noting it should move to S3/CloudFront for production scale.

TASK 2: Add rate limiting to high-risk unprotected controllers

The audit found 71 controllers relying on the global 100/60s default. Add explicit @Throttle() decorators to the most security-sensitive ones that don't already have custom limits:

Read each controller first to check if it already has @Throttle(). Only add where missing:

- WebhookController (all channels) → { default: { limit: 120, ttl: 60000 } } (webhooks are high-volume)
- AI endpoints (POST /ai/*) → { default: { limit: 20, ttl: 60000 } } (expensive operations)
- OutboundController (send messages) → { default: { limit: 60, ttl: 60000 } }
- BulkActionController (if exists) → { default: { limit: 10, ttl: 60000 } }
- Export/report endpoints → { default: { limit: 5, ttl: 60000 } } (expensive queries)

Import @Throttle from @nestjs/throttler in each controller if not already imported.

TASK 3: Add email domain validation

Read packages/messaging-provider/src/email.provider.ts. There's a stub for email domain validation.

Implement basic validation using Node.js DNS module:
- dns.promises.resolveMx(domain) to check MX records exist
- Cache results for 1 hour (simple Map with TTL) to avoid repeated DNS lookups
- On validation failure: log warning but still attempt to send (soft validation, not blocking)
- Use this validation when a new customer email is first added, not on every message send

TASK 4: Run full test suite and verify nothing is broken

Run the complete test suite:
cd apps/api && npx jest --maxWorkers=50%
cd apps/web && npx jest --maxWorkers=50%
cd apps/admin && npx jest --maxWorkers=50%

Fix any failures.

Commit: "fix: web chat file upload, rate limiting expansion, email domain validation"
```

---

## Quick Reference: Session Execution Order

| Day | Sessions | What Gets Done |
|-----|----------|---------------|
| 4 | 4, 5 | Stripe guide, channel guide, web chat build |
| 5-6 | 6 ⚡, 7 ⚡ | Admin tests (40+), instagram-auth tests, translation tests |
| 7 | 8 | CALENDAR_SYNC processor, Trivy blocking, production seed, npm audit |
| 8 | 9 | Staged deploys, bundle monitoring, smoke test verification |
| 10-11 | 10, 11 | Capacitor scaffold, push notifications (DeviceToken + FCM) |
| 12-13 | 12, 13 | iOS/Android build config, mobile CI/CD pipeline |
| 14 | 14 | Web chat uploads, rate limiting, email validation, final test run |

⚡ = Can run in parallel

---

## External Setup Tasks (Start Day 4 — These Have Lead Time)

### Stripe (you have an account)
1. Create 3 products × 2 prices = 6 prices matching: $49/$99/$199 monthly, $39/$79/$159 annually
2. Create webhook endpoint: `https://api.businesscommandcentre.com/api/v1/billing/webhook`
3. Subscribe to 8 events (listed in Session 4)
4. Set all STRIPE_* env vars in Railway
5. Test in Stripe test mode first

### Meta (you have an account)
1. WhatsApp: Get Phone Number ID + Permanent Access Token, set webhook URL + verify token
2. Instagram: Ensure instagram_manage_messages permission, set webhook URL
3. Facebook: Subscribe page to Messenger webhooks, set verify token

### Twilio
1. Create account, purchase phone number
2. Start A2P 10DLC registration (US requirement, takes days–weeks)
3. Set webhook URL + 4 TWILIO_* env vars in Railway

### Resend
1. Create account, verify sending domain (SPF + DKIM + DMARC DNS records)
2. Set EMAIL_PROVIDER=resend + EMAIL_API_KEY + EMAIL_FROM in Railway

### Apple Developer + Google Play (for mobile)
1. Apple Developer Program enrollment ($99/year) — needed for TestFlight + App Store
2. Google Play Console ($25 one-time) — needed for Play Store

### Railway Production Checklist
1. Verify PostgreSQL daily backups enabled
2. Set all env vars from Stripe, Meta, Twilio, Resend setup
3. Ensure MESSAGING_PROVIDER is NOT 'mock'
4. Run: npx tsx packages/db/src/seed-production.ts (after Session 8)

### Generate Fresh Production Secrets
```bash
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → JWT_REFRESH_SECRET
openssl rand -hex 32  # → CALENDAR_ENCRYPTION_KEY
```
