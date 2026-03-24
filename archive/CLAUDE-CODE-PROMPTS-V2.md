# Booking OS — Claude Code Prompts (Post-Audit, Verified)

> **Generated March 23, 2026** — verified against actual codebase. Every prompt below addresses a CONFIRMED gap.
>
> **Already completed (no prompts needed):**
> - Phase 1 hardening: Database indexes, Redis brute force, refresh token rotation, rate limiting expansion, CI security, backups, runbooks
> - docs/STRIPE-SETUP.md — exists with full Stripe configuration guide
> - docs/CHANNEL-SETUP.md — exists with all 6 channel setup instructions
> - Billing health endpoint — GET /billing/health exists with SUPER_ADMIN protection
> - rawBody: true in main.ts — already configured for Stripe webhooks
> - Web chat widget — fully built with esbuild IIFE bundle
> - Admin app tests — all 20 routes have test files (20 .test.tsx files)
> - Instagram-auth tests — both service and controller spec files exist
> - Translation tests — both service and controller spec files exist
> - Staged deployments — CI/CD already deploys API→Web→Admin with 300s health check polls between each
> - Bundle size check — 60MB limit already enforced in CI
> - Production seed script — seed-production.ts already exists
> - All 83 API modules have test coverage (216 spec files total)
>
> **How to use:** Copy each prompt block into Claude Code. Run in order within each phase. Sessions marked ⚡ can run in parallel.

---

## PHASE 2: Fix Confirmed Code Gaps (Days 4–5)

### Session 4 — Missing Queue Processors + CI Security Fixes

```
The codebase audit confirmed specific gaps in queue processing and CI security settings. Fix all of them.

TASK 1: Implement CALENDAR_SYNC queue processor

The CALENDAR_SYNC queue is registered in apps/api/src/common/queue/queue.module.ts (line 12 and 68) but has NO dedicated processor file.

Read the existing processors to understand the pattern:
- apps/api/src/common/queue/ai-processing.processor.ts
- apps/api/src/common/queue/messaging.processor.ts
- apps/api/src/common/queue/reminders.processor.ts
- apps/api/src/common/queue/notifications.processor.ts
- apps/api/src/common/queue/onboarding-drip.processor.ts
- apps/api/src/common/queue/dunning.processor.ts

These 6 are the only processors that exist. Two queues are missing processors: CALENDAR_SYNC and AGENT_PROCESSING.

Create apps/api/src/common/queue/calendar-sync.processor.ts:
- Follow the exact same pattern as the other processors (use @Processor decorator with the queue name)
- Read apps/api/src/modules/calendar-sync/ (or search for CalendarSyncService) to understand what sync logic exists
- The processor should handle jobs that sync bookings to/from Google Calendar and Outlook
- If CalendarSyncService already has methods for syncing, call those methods
- If not, create a minimal processor that logs the job data and calls any available sync service methods
- Include proper error handling, logging, and retry-compatible error throwing

TASK 2: Implement AGENT_PROCESSING queue processor

The AGENT_PROCESSING queue is also registered but has NO dedicated processor.

Create apps/api/src/common/queue/agent-processing.processor.ts:
- Follow the same pattern as other processors
- Read apps/api/src/modules/agent-framework/ to understand what agent processing involves
- The processor should handle background agent jobs (running the 5 operational agents: Waitlist, Retention, DataHygiene, SchedulingOptimizer, QuoteFollowup)
- Call into AgentFrameworkService or the relevant service that orchestrates agent runs
- Include proper error handling and logging

TASK 3: Make Trivy scanning block on CRITICAL vulnerabilities

Read .github/workflows/ci.yml. The Trivy scan steps (around lines 160, 167, 174) all have exit-code: '0', meaning vulnerabilities NEVER fail the build.

Change ONLY the first Trivy scan (or the most important one — for the API image) to use:
  exit-code: '1'
  severity: 'CRITICAL'

This way CRITICAL vulnerabilities fail the build. Keep a separate informational scan for HIGH severity that does NOT block (exit-code: '0').

For the web and admin image scans, you can keep exit-code: '0' for now, or make them blocking too. Use your judgment.

TASK 4: Make npm audit block on CRITICAL vulnerabilities

Read .github/workflows/ci.yml around line 48. The npm audit step has:
  run: npm audit --audit-level=high --omit=dev
  continue-on-error: true

Change this to two separate steps:

Step 1 (blocking):
  - name: Security audit (critical)
    run: npm audit --audit-level=critical --omit=dev

Step 2 (informational):
  - name: Security audit (high - informational)
    run: npm audit --audit-level=high --omit=dev
    continue-on-error: true

This gives two signals: critical = must fix, high = should fix.

TASK 5: Write tests for both new processors

Create calendar-sync.processor.spec.ts and agent-processing.processor.spec.ts with:
- Job processing happy path (mock the service calls)
- Error handling (service throws, verify processor handles gracefully)
- Job data validation

Run: cd apps/api && npx jest calendar-sync.processor agent-processing.processor --maxWorkers=50%
Commit: "fix: add CALENDAR_SYNC and AGENT_PROCESSING queue processors, harden CI security scanning"
```

### Session 5 — Rate Limiting Expansion + Stub Replacements ⚡

```
The audit found 71 of 94 controllers rely on the global 100/60s rate limit default with no explicit @Throttle decorators. Additionally, two features are confirmed stubs. Fix all three.

TASK 1: Add rate limiting to high-risk unprotected controllers

24 controller files already have explicit @Throttle() decorators (57 total instances), including auth, booking, campaign, customer, export, message, portal, public-booking, quote, reports, self-serve, and all 12 console controllers. The following 9 controllers handle sensitive or expensive operations but have NO @Throttle decorators — verified against actual source code:

AI endpoints (expensive LLM calls):
- AiController (apps/api/src/modules/ai/) → @Throttle({ default: { limit: 20, ttl: 60000 } }) on the class
- Any controller handling POST /ai/conversations/:id/regenerate-draft

Outbound messaging (sends real messages):
- OutboundController (apps/api/src/modules/outbound/) → @Throttle({ default: { limit: 60, ttl: 60000 } })

Webhook controllers (high volume but need protection):
- WebhookController (messaging webhooks) → @Throttle({ default: { limit: 200, ttl: 60000 } })

Agent framework:
- AgentConfigController or AgentFrameworkController → @Throttle({ default: { limit: 30, ttl: 60000 } })

Action cards (can trigger message sends):
- ActionCardController → @Throttle({ default: { limit: 30, ttl: 60000 } })

Billing (sensitive financial operations):
- BillingController (check if it already has @Throttle — some billing endpoints may already be covered) → @Throttle({ default: { limit: 20, ttl: 60000 } })

Staff/service management:
- StaffController → @Throttle({ default: { limit: 30, ttl: 60000 } })
- ServiceController → @Throttle({ default: { limit: 30, ttl: 60000 } })

Automation rules:
- AutomationController → @Throttle({ default: { limit: 20, ttl: 60000 } })

Import @Throttle from @nestjs/throttler in each file where it's not already imported.

DO NOT change existing @Throttle values on controllers that already have them. Only ADD decorators where missing.

TASK 2: Replace web chat file upload stub

Read apps/api/src/common/web-chat.gateway.ts around line 563. The @SubscribeMessage('file:upload-request') handler currently returns:
  "File uploads are not yet supported in web chat. Please share files via email."

Implement actual file upload handling:
- Accept base64-encoded file data with metadata: { fileName, mimeType, size, data }
- Validate: max 5MB file size, allowed types: image/png, image/jpeg, image/gif, application/pdf
- Check if there's an existing file storage pattern in the codebase (search for multer, S3, upload, or file storage in other modules)
- If S3/storage exists, use the same pattern
- If not, save to a local uploads/ directory and serve via a static file route. Add a TODO comment: "Move to S3/CloudFront for production scale"
- Create a Message record with the file URL as an attachment
- Emit the message to the conversation via the existing message flow
- Return success/error response to the client

TASK 3: Implement email domain validation

Read packages/messaging-provider/src/email.provider.ts lines 172-186. The validateDomain() method is a stub that always returns valid: true with all checks "pending".

Replace with actual DNS validation using Node.js built-in dns module:
- Use dns.promises.resolveMx(domain) to check MX records exist
- Use dns.promises.resolveTxt(domain) to check for SPF records (look for "v=spf1")
- Cache results in a simple Map with 1-hour TTL to avoid repeated DNS lookups for the same domain
- On DNS lookup failure (ENOTFOUND, ENODATA): return valid: false with the failed check
- On timeout: return valid: true with checks "timeout" (don't block on slow DNS)
- This is soft validation — log warnings but don't prevent message sending

Write tests for all three tasks.

Run: cd apps/api && npx jest --maxWorkers=50%
Commit: "fix: expand rate limiting, implement web chat file upload, email domain validation"
```

---

## PHASE 3: Mobile App via Capacitor (Days 6–10)

### Session 6 — Capacitor Scaffold + Platform Detection

```
Set up Capacitor to wrap the existing Next.js web app as native iOS and Android apps.

IMPORTANT: The native app loads from the LIVE server URL (https://businesscommandcentre.com). This means zero code duplication — the native shell just provides push notifications and native device feel. Web updates deploy instantly without app store review.

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

In apps/web/next.config.js, make the output mode configurable so Capacitor can use static export as a fallback:
output: process.env.NEXT_OUTPUT === 'export' ? 'export' : 'standalone',

Add to apps/web/package.json scripts:
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

### Session 7 — Push Notifications (Backend + Frontend)

```
Add push notification support so business staff get alerts when the app is backgrounded. The audit confirmed: no DeviceToken model, no push notification service, no device token API module exist.

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

Create apps/api/src/modules/device-token/ following the standard NestJS module pattern:

device-token.module.ts — register PrismaService
device-token.service.ts:
  - register(staffId, businessId, token, platform) — upsert by staffId+token unique constraint
  - unregister(token) — set isActive: false
  - findActiveByStaff(staffId) — return active tokens for a staff member
  - findActiveByBusiness(businessId) — return all active tokens for a business
  - deactivateStale() — deactivate tokens not updated in 90 days

device-token.controller.ts:
  - POST /device-tokens — register (body: { token, platform }), get staffId from JWT, businessId from @BusinessId()
  - DELETE /device-tokens/:token — deactivate
  - Protected by TenantGuard + JwtAuthGuard
  - Add @Throttle({ default: { limit: 10, ttl: 60000 } })

DTOs with class-validator. Register in app.module.ts.

TASK 3: Create PushNotificationService

Create apps/api/src/modules/push-notification/:

push-notification.service.ts:
  - sendToStaff(staffId, notification: { title, body, data? }) — get active tokens via DeviceTokenService, send via FCM HTTP v1 API
  - sendToBusiness(businessId, notification: { title, body, data? }) — get all business tokens, send batch
  - Firebase Cloud Messaging HTTP v1 API (works for BOTH iOS and Android)
  - Add FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_KEY to .env.example
  - CRITICAL: Graceful degradation — if FCM env vars are missing, log the notification payload and return success. Never crash.

push-notification.module.ts — export PushNotificationService

TASK 4: Integrate push with existing Socket.IO events

Read the InboxGateway (search for where message:new, booking:updated, and action-card:created events are emitted).

For each event, add push notification fallback logic:
- Check if the target staff member has active device tokens
- Check if they have an active WebSocket connection (the gateway already tracks presence via viewing:start/viewing:stop)
- If they have tokens but NO active socket → send push notification
- Create a helper: async shouldSendPush(staffId: string): Promise<boolean>

Keep it simple — push supplements Socket.IO, not replaces it.

TASK 5: Frontend push registration hook

Create apps/web/src/hooks/usePushNotifications.ts:
- Import PushNotifications from @capacitor/push-notifications
- Import useCapacitor hook from the previous session
- On mount (native platforms only):
  1. Request permission
  2. Register for push notifications
  3. On registration success: POST token to /device-tokens
- Listen for pushNotificationReceived (foreground): show in-app indicator
- Listen for pushNotificationActionPerformed (user tapped): navigate to relevant page based on notification.data
- On unmount: remove listeners

Wire into the main app shell layout so it runs once on launch for native platforms only.

TASK 6: Write tests

- device-token.service.spec.ts — register, unregister, findActiveByStaff, deactivateStale
- device-token.controller.spec.ts — auth guards, validation, happy/error paths
- push-notification.service.spec.ts — mock FCM, test graceful degradation when unconfigured

Run: cd apps/api && npx jest device-token push-notification --maxWorkers=50%
Commit: "mobile: push notifications with FCM, device token API, Socket.IO fallback"
```

### Session 8 — iOS + Android Build Config

```
Configure the native iOS and Android projects for App Store and Play Store.

Prerequisites: apps/web/ios/ and apps/web/android/ directories must exist from Session 6.

TASK 1: iOS configuration

Edit apps/web/ios/App/App/Info.plist:
- Set CFBundleDisplayName to "Booking OS"
- Set MinimumOSVersion to 15.0
- Add NSCameraUsageDescription: "Booking OS needs camera access to capture photos for customer records"
- Add NSPhotoLibraryUsageDescription: "Booking OS needs photo library access to attach images"
- Verify push notification entitlement (aps-environment) is present

In the Xcode project settings (via pbxproj file or script):
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
- Add: <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

TASK 3: Generate app icon

Create scripts/generate-app-icon.js using the sharp npm package (npm install -D sharp):
- Create a 1024x1024 PNG: sage-600 (#71907C) background, white bold "B" lettermark centered
- Generate iOS sizes: 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024
- Generate Android sizes: 48 (mdpi), 72 (hdpi), 96 (xhdpi), 144 (xxhdpi), 192 (xxxhdpi)
- Copy to correct directories under ios/ and android/

Run the script after creating it.

TASK 4: Android splash screen

Edit apps/web/android/app/src/main/res/values/styles.xml:
- Set splash background color to #FCFCFD

TASK 5: Build scripts

Add to apps/web/package.json:
"cap:build": "npx cap sync",
"cap:ios:open": "npx cap open ios",
"cap:android:open": "npx cap open android"

TASK 6: Document mobile release process

Add a "## Mobile App Releases" section to DEPLOY.md covering:
- iOS: cap sync → open Xcode → Archive → TestFlight → App Store
- Android: cap sync → open Android Studio → signed AAB → Play Console
- Required accounts: Apple Developer ($99/yr), Google Play Console ($25 one-time)
- Required GitHub Secrets for future CI: ANDROID_KEYSTORE, IOS_SIGNING_CERTIFICATE, etc.
- Keystore generation command: keytool -genkeypair -v -keystore bookingos.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bookingos

Commit: "mobile: iOS + Android build config, app icons, release documentation"
```

### Session 9 — Mobile CI/CD Pipeline

```
Create a GitHub Actions workflow for automated mobile builds. The audit confirmed no mobile.yml workflow exists.

TASK 1: Create .github/workflows/mobile.yml

Trigger on:
- Push of tags matching 'mobile-v*' (e.g., mobile-v1.0.0)
- Manual workflow_dispatch with a version input

Job 1: build-android (runs-on: ubuntu-latest)
  steps:
  - Checkout code
  - Setup Node.js 22 + npm ci
  - cd apps/web && npx cap sync android
  - Setup JDK 17 (actions/setup-java@v4, distribution: temurin)
  - Decode ANDROID_KEYSTORE secret from base64 to keystore.jks
  - Build release AAB:
    cd apps/web/android && ./gradlew bundleRelease
    -Pandroid.injected.signing.store.file=keystore.jks
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
  - Create keychain, import IOS_SIGNING_CERTIFICATE secret
  - Import IOS_PROVISIONING_PROFILE secret
  - Build archive:
    xcodebuild -workspace apps/web/ios/App/App.xcworkspace
    -scheme App -configuration Release
    -archivePath build/App.xcarchive archive
    CODE_SIGN_STYLE=Manual
  - Export IPA using ExportOptions.plist
  - Upload IPA as artifact (retention-days: 30)
  - Clean up keychain

Both jobs run in parallel.

TASK 2: Create iOS ExportOptions.plist

Create apps/web/ios/ExportOptions.plist:
- method: app-store
- teamID: $TEAM_ID (placeholder — document that this needs to be set)
- bundleID: com.bookingos.staff
- signingStyle: manual

TASK 3: Document in DEPLOY.md

Under "## Mobile App Releases", add "### Automated Builds" subsection:
- How to trigger: git tag mobile-v1.0.0 && git push origin mobile-v1.0.0
- Or via GitHub Actions → Mobile Build → Run workflow
- Required secrets: ANDROID_KEYSTORE (base64), ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, IOS_SIGNING_CERTIFICATE (base64 .p12), IOS_SIGNING_PASSWORD, IOS_PROVISIONING_PROFILE (base64 .mobileprovision)
- Base64 encoding: base64 -i bookingos.jks | pbcopy

Commit: "ci: mobile build pipeline for iOS and Android"
```

---

## Quick Reference: Session Execution Order

| Day | Session | What Gets Done |
|-----|---------|---------------|
| 4 | 4 | CALENDAR_SYNC + AGENT_PROCESSING processors, Trivy blocking, npm audit blocking |
| 5 | 5 ⚡ | Rate limiting expansion (71 controllers), web chat file upload, email domain validation |
| 6 | 6 | Capacitor scaffold, platform detection hook, safe area CSS |
| 7 | 7 | DeviceToken model, push notification service (FCM), Socket.IO fallback |
| 8 | 8 | iOS/Android build config, app icons, splash screen |
| 9 | 9 | Mobile CI/CD pipeline (GitHub Actions) |

⚡ = Can run in parallel with previous session

**Total: 6 sessions** (down from 14 in the unverified version — 8 sessions were solving already-solved problems)

---

## External Setup Tasks (Start Day 4 — These Have Lead Time)

### Stripe (you have an account — guide at docs/STRIPE-SETUP.md)
1. Create 3 products × 2 prices = 6 prices matching: $49/$99/$199 monthly, $39/$79/$159 annually
2. Create webhook endpoint: `https://api.businesscommandcentre.com/api/v1/billing/webhook`
3. Subscribe to 8 events (listed in docs/STRIPE-SETUP.md)
4. Set all STRIPE_* env vars in Railway
5. Test in Stripe test mode first

### Meta (you have an account — guide at docs/CHANNEL-SETUP.md)
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

### Apple Developer + Google Play (for mobile — Sessions 8-9)
1. Apple Developer Program enrollment ($99/year)
2. Google Play Console ($25 one-time)

### Railway Production Checklist
1. Verify PostgreSQL daily backups enabled
2. Set all env vars from Stripe, Meta, Twilio, Resend setup
3. Ensure MESSAGING_PROVIDER is NOT 'mock'
4. Production seed already exists — run: npx tsx packages/db/src/seed-production.ts

### Generate Fresh Production Secrets
```bash
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → JWT_REFRESH_SECRET
openssl rand -hex 32  # → CALENDAR_ENCRYPTION_KEY
```
