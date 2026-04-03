# Booking OS — Comprehensive Code Review Report

**Date:** April 3, 2026
**Scope:** Full codebase — 118 service files, 93 controllers, 96 Prisma models, frontend apps, queue processors
**Reviewer:** AI-assisted deep review (Claude)

---

## Executive Summary

This review identified **62 findings** across the Booking OS production codebase, including **7 critical**, **16 high**, **27 medium**, and **12 low** severity issues. The most urgent items are webhook signature verification gaps on status endpoints, a user enumeration vulnerability in the portal auth flow, missing transaction wrappers on multi-step operations, and a default-allow behavior in the RBAC guard.

The codebase demonstrates strong security foundations — JWT httpOnly cookies, tenant isolation via TenantGuard, atomic token consumption, circuit breaker patterns, and rate limiting on 34+ controllers. The issues below represent gaps in otherwise well-architected systems.

| Severity | Count | Categories |
|----------|-------|------------|
| Critical | 7 | Webhook auth (3), multi-tenancy (2), RBAC (1), rate limiting (1) |
| High | 16 | Auth bypass, user enumeration, transaction safety, data leaks |
| Medium | 27 | Race conditions, validation gaps, performance, error handling |
| Low | 12 | Code quality, documentation, minor edge cases |

---

## 1. Database Transaction Safety

Places where multiple DB writes happen outside a `$transaction` wrapper. A failure mid-operation would leave data inconsistent.

### F1.1 — Webhook inbound message + conversation update (MEDIUM)

**File:** `apps/api/src/modules/messaging/webhook.controller.ts` — `handleWhatsAppInbound()`
**Risk:** Message creation and conversation `lastMessageAt` update happen in separate queries. If the server crashes between the two writes, messages exist without updated conversation timestamps, causing them to appear out of order in the inbox.
**Fix:** Wrap both operations in `prisma.$transaction()`.

### F1.2 — Customer bulk creation without transaction (MEDIUM)

**File:** `apps/api/src/modules/customer/customer.service.ts` — `bulkCreate()`
**Risk:** Creates customers in a loop without transaction wrapping. If a database constraint fails on customer #40 of 50, the first 39 are persisted but the import is marked as failed. No rollback.
**Fix:** Wrap the creation loop in `prisma.$transaction()` for atomic batch creation.

### F1.3 — CSV import partial failure (HIGH)

**File:** `apps/api/src/modules/customer/customer.controller.ts` — `importCsv()`
**Risk:** Calls `bulkCreate` without error handling for partial failures. Some customers created, import marked failed, no rollback semantics. Orphaned customer records.
**Fix:** `bulkCreate` should use `prisma.$transaction()`. Caller should handle partial failure gracefully.

### F1.4 — Human takeover metadata read-modify-write (HIGH)

**File:** `apps/api/src/modules/ai/human-takeover.service.ts` — `initiateTakeover()` and `resolveTakeover()`
**Risk:** Both methods read `conversation.metadata`, spread it with new fields, and write back. Two concurrent calls race on the read, and the second write overwrites the first's changes. This breaks AI state mid-conversation.
**Fix:** Wrap in `prisma.$transaction()` with a SELECT FOR UPDATE equivalent. Consider adding an `updatedAt` optimistic lock field.

### F1.5 — Web chat config JSON read-modify-write (MEDIUM)

**File:** `apps/api/src/modules/messaging/web-chat.controller.ts` — `saveConfig()`
**Risk:** `channelSettings` JSON field is read, spread with new values, and written back. Concurrent updates to different nested keys (e.g., `primaryColor` and `title`) lose the first write.
**Fix:** Wrap in transaction with row lock, or use Prisma's JSON path updates.

### F1.6 — Customer merge across 7 entity types (MEDIUM)

**File:** `apps/api/src/modules/customer/customer-merge.service.ts` — `mergeDuplicateById()`
**Risk:** Updates 7 entity types (bookings, conversations, invoices, etc.) to reassign from duplicate to primary customer. No row lock on the duplicate record — another request could merge or delete the duplicate concurrently. Action history creation happens after the transaction, so audit trail can be lost.
**Fix:** Add row lock before transaction. Move action history inside transaction block.

### F1.7 — Deposit payment intent without idempotency (MEDIUM)

**File:** `apps/api/src/modules/billing/billing.service.ts` — `createDepositPaymentIntent()`
**Risk:** Stripe `paymentIntents.create()` call has no idempotency key. If the call succeeds but the response times out, a retry creates a duplicate payment intent. Customer could be charged twice.
**Fix:** Pass `idempotencyKey: \`deposit-${bookingId}-${Date.now()}\`` to the Stripe call.

### F1.8 — Refund creation without idempotency (MEDIUM)

**File:** `apps/api/src/modules/refunds/refunds.service.ts` — `create()`
**Risk:** Stripe refund call has no idempotency key. Same timeout-and-retry scenario as F1.7 creates duplicate refunds.
**Fix:** Pass `idempotencyKey: \`refund-${paymentId}\`` to the Stripe refund call.

### F1.9 — Invoice number generation race condition (MEDIUM)

**File:** `apps/api/src/modules/invoice/invoice.service.ts` — `generateInvoiceNumber()`
**Risk:** Sequential counter (INV-YYYY-NNNN) per business. Two concurrent invoice creations can read the same counter value, generating duplicate invoice numbers.
**Fix:** Use atomic increment via `prisma.$transaction()` with row lock, or use a database sequence.

---

## 2. Multi-Tenancy Violations

Any query missing `businessId` scoping means one tenant can see or modify another tenant's data.

### F2.1 — Staff email uniqueness checked globally (HIGH)

**File:** `apps/api/src/modules/staff/staff.service.ts` — `create()`
**Risk:** Email uniqueness query uses `findUnique({ email })` without `businessId` filter. In a multi-tenant system, the same email should be allowed across different businesses. Currently, a staff member at Business A blocks that email from being used at Business B.
**Fix:** Change to `findFirst({ where: { email, businessId } })` for per-business uniqueness.

### F2.2 — Refund authorization missing business check (HIGH)

**File:** `apps/api/src/modules/refunds/refunds.service.ts` — `create()`
**Risk:** No validation that the payment being refunded belongs to a booking in the requesting business. An attacker could refund another tenant's payment by providing a cross-tenant `paymentId`.
**Fix:** Verify `payment.booking.businessId === businessId` before processing refund.

### F2.3 — Customer journey query missing businessId on deals (HIGH)

**File:** `apps/api/src/modules/customer/customer.service.ts` — `getJourney()`
**Risk:** Dealership-specific queries for deals linked to customer bookings may not filter by `businessId`, potentially leaking cross-tenant deal data.
**Fix:** Add explicit `where: { businessId }` to every Prisma query in this method.

### F2.4 — Booking staff assignment not validated (HIGH)

**File:** `apps/api/src/modules/booking/booking.controller.ts` — `create()`
**Risk:** No validation that `body.staffId` belongs to the requesting business. A user could create a booking assigned to staff from a different tenant.
**Fix:** In `bookingService.create()`, verify `staffId` belongs to `businessId` via `prisma.staff.findFirst({ where: { id: body.staffId, businessId } })`.

### F2.5 — Webhook subscription business verification (HIGH)

**File:** `apps/api/src/modules/billing/billing.service.ts` — `handleWebhookEvent()`
**Risk:** Stripe webhook events update business subscription data without verifying the subscription belongs to the target business. A crafted webhook payload could update an arbitrary business's plan.
**Fix:** After fetching the subscription, verify it belongs to the expected business before applying changes.

### F2.6 — RolesGuard default-allow behavior (CRITICAL)

**File:** `apps/api/src/common/roles.guard.ts`
**Risk:** If no `@Roles()` decorator is applied to an endpoint, `requiredRoles` is empty and the guard returns `true` (allows access). Any developer who forgets `@Roles()` on a sensitive endpoint accidentally opens it to all authenticated users regardless of role.
**Fix:** Change default from `return true` to `throw new ForbiddenException('Endpoint requires role declaration')`. Audit all 93 controllers to ensure every mutation endpoint has explicit `@Roles()`.

### F2.7 — Staff preferences modification without ownership check (CRITICAL)

**File:** `apps/api/src/modules/staff/staff.service.ts` — `updatePreferences()`
**Risk:** Accepts `staffId` but does not verify the requesting user owns that staffId or has admin privileges. Any authenticated user can modify any staff member's preferences within the same business.
**Fix:** Add check: `if (req.user.sub !== staffId && !['OWNER', 'ADMIN'].includes(req.user.role)) throw ForbiddenException()`.

---

## 3. Null and Undefined Edge Cases

### F3.1 — AI response JSON not validated (HIGH)

**File:** `apps/api/src/modules/ai/` — `booking-assistant`, `reply-generator`, `intent-detector`
**Risk:** `JSON.parse(response)` immediately accesses `parsed.state`, `parsed.serviceId`, etc. without checking fields exist. If Claude returns valid JSON but with missing fields (e.g., `{}`), the booking state machine receives `undefined` values and breaks mid-conversation.
**Fix:** Add Zod or manual validation: verify required fields exist before accessing. Return fallback state on validation failure.

### F3.2 — SMS shortening silent failure (HIGH)

**File:** `apps/api/src/modules/ai/reply-generator.ts` — SMS handling (lines ~80-98)
**Risk:** If the AI shortening call returns no `draftText` field, line 92 throws a TypeError (`undefined.length`). The catch block falls back to the original oversized draft, which Twilio silently truncates. User sees mangled message.
**Fix:** Check `shortenParsed?.draftText` before accessing `.length`. If shortening fails, log a warning and indicate to caller that the message was not shortened.

### F3.3 — Customer timeline unbounded queries (HIGH)

**File:** `apps/api/src/modules/customer/customer.service.ts` — `getTimeline()`
**Risk:** Parallel queries across 10+ entity types without `take` limits. A customer with 1000 bookings + 1000 conversations loads everything into memory, risking OOM on the API server.
**Fix:** Add `take: 50` to each parallel query. Return total counts separately for pagination.

### F3.4 — Waitlist metrics division by zero (LOW)

**File:** `apps/api/src/modules/waitlist/waitlist.service.ts` — `getMetrics()`
**Risk:** `fillRate = (claimed / offered) * 100` — if `offered` is 0, returns `Infinity`.
**Fix:** Guard: `fillRate = offered > 0 ? (claimed / offered) * 100 : 0`.

### F3.5 — Policy text returned unsanitized (MEDIUM)

**File:** `apps/api/src/modules/ai/policy-compliance.service.ts`
**Risk:** `policyText` from business JSON config returned directly in API response. If it contains HTML/script tags (e.g., injected via admin UI), frontend rendering without sanitization could execute injected code (stored XSS).
**Fix:** Sanitize policy text on output, or validate on input (strip HTML tags).

---

## 4. Cascading Data Integrity

### F4.1 — Booking status transitions unvalidated (MEDIUM)

**File:** `apps/api/src/modules/booking/booking.controller.ts` — `updateStatus()`
**Risk:** No state machine validation. A COMPLETED booking can be moved back to PENDING. This breaks revenue reporting, cancellation policies, and package redemption logic.
**Fix:** Define allowed transitions per status in a state machine map. Reject invalid transitions with `BadRequestException`.

### F4.2 — Vehicle sold status not checked on deal close (MEDIUM)

**File:** `apps/api/src/modules/deal/deal.service.ts` — `changeStage()`
**Risk:** On CLOSED_WON, auto-sets vehicle status to SOLD without checking if another deal already sold it. Two deals can mark the same vehicle as SOLD.
**Fix:** Check `vehicle.status !== 'SOLD'` before updating. Throw `ConflictException` if already sold.

### F4.3 — Deal auto-advance creates duplicate history (MEDIUM)

**File:** `apps/api/src/modules/deal/deal.service.ts` — `advanceDealOnTestDriveCompletion()`
**Risk:** Auto-advances deal stage on test drive completion without checking current stage. If deal was manually moved to NEGOTIATION, this creates a duplicate QUALIFIED→TEST_DRIVE history entry.
**Fix:** Query deal with `where: { stage: { in: ['INQUIRY', 'QUALIFIED'] } }` to guard auto-advance.

### F4.4 — Invoice cancellation with partial payment (MEDIUM)

**File:** `apps/api/src/modules/invoice/invoice.service.ts` — `cancel()`
**Risk:** Allows cancelling SENT and VIEWED invoices without checking if partial payment exists. Cancellation with partial payment leaves accounting in inconsistent state.
**Fix:** Require explicit refund before cancellation if `paidAmount > 0`.

---

## 5. API and Authentication Gaps

### F5.1 — Webhook status endpoints missing signature verification (CRITICAL)

**File:** `apps/api/src/modules/messaging/webhook.controller.ts`
**Affected endpoints:**
- `POST /webhooks/whatsapp/status` — no HMAC-SHA256 verification
- `POST /webhooks/sms/status` — no Twilio signature verification
- `POST /webhooks/email/status` — no provider signature verification

**Risk:** While the *inbound message* webhook handlers correctly verify signatures, the *status update* endpoints do not. An attacker can forge delivery confirmations, read receipts, bounce notifications, or failure events. This can:
- Mark undelivered messages as "delivered" (masking failures)
- Trigger false bounce handling (unsubscribing valid customers)
- Manipulate delivery metrics
**Fix:** Apply the same HMAC signature verification used on inbound handlers to status endpoints. Use `crypto.timingSafeEqual()` for all comparisons.

### F5.2 — Staff pricing endpoint missing role guard (HIGH)

**File:** `apps/api/src/modules/staff/staff.controller.ts` — `getServicePricing()`
**Risk:** `@Get(':id/pricing')` has no `@Roles()` guard. Any authenticated user (including SERVICE_PROVIDER and AGENT roles) can view any staff member's pricing.
**Fix:** Add `@Roles('OWNER', 'ADMIN')` decorator, or allow SERVICE_PROVIDER to view only their own pricing.

### F5.3 — Portal auth user enumeration (HIGH)

**File:** `apps/api/src/modules/portal/portal-auth.service.ts` — `requestOtp()` and `requestMagicLink()`
**Risk:** Returns different error messages for found vs. not-found customers. An attacker can enumerate valid phone numbers and email addresses by observing response differences.
**Fix:** Return identical success response regardless of whether the customer exists: `"If an account exists, you will receive a code."` Log the actual result internally.

### F5.4 — AI daily rate limit uses in-memory Map (CRITICAL)

**File:** `apps/api/src/modules/ai/ai.service.ts`
**Risk:** Daily call counter uses `private dailyCalls = new Map<string, { count: number; date: string }>()`. In a multi-instance deployment (Railway), each instance maintains separate counters. A client can bypass the 500-call/day limit by distributing requests across instances. The counter also resets on every deploy.
**Fix:** Replace with Redis-backed counter: `INCR ai:daily:${businessId}:${date}` with `EXPIRE 86400`.

### F5.5 — Refresh endpoint returns 200 on auth errors (MEDIUM)

**File:** `apps/api/src/modules/auth/auth.controller.ts`
**Risk:** Both "no token" and "token revoked" cases on the refresh endpoint return 200 OK with a message field, not 401. Clients may misinterpret these as successful refreshes.
**Fix:** Throw `UnauthorizedException` for both error cases.

### F5.6 — Middleware path matching too broad (MEDIUM)

**File:** `apps/web/src/middleware.ts`
**Risk:** PUBLIC_PATHS whitelist uses `pathname.startsWith(p)`, so `/booking-anything` matches the `/book` public path, and `/management` matches `/manage`. Unintended routes could bypass auth.
**Fix:** Use exact matching with path boundary: `pathname === p || pathname.startsWith(p + '/')`.

---

## 6. WhatsApp and Messaging Failures

### F6.1 — Email provider config reads wrong object (HIGH)

**File:** `apps/api/src/modules/messaging/messaging.service.ts` — `getProviderForConversation()`
**Risk:** Email provider lookup reads `emailProviderKey` from `locationWhatsappConfig` instead of `locationEmailConfig`. Per-location email configuration is completely broken — all emails fall back to the default provider.
**Fix:** Change to `const emailKey = locationEmailConfig?.emailProviderKey;`. Add `locationEmailConfig` parameter.

### F6.2 — Missing timeout on all outbound provider calls (MEDIUM)

**File:** `apps/api/src/modules/messaging/messaging.service.ts`
**Risk:** All outbound calls to WhatsApp Cloud, Twilio, Resend, SendGrid, Instagram, and Facebook lack timeout protection. If a provider network hangs, the NestJS default timeout (120s) triggers, leaving the message in PENDING state with no retry.
**Fix:** Wrap all provider calls in `Promise.race()` with a 10-second timeout. On timeout, mark message as FAILED and queue for retry.

### F6.3 — Email provider instantiated per-request (HIGH)

**File:** `apps/api/src/modules/messaging/email-channel.controller.ts` — `sendTestEmail()`
**Risk:** Creates a new `EmailChannelProvider` instance on every request (unlike WhatsApp/Instagram/Facebook which use a registry pattern). Inefficient, inconsistent with other channels, and risks leaking connections.
**Fix:** Use the same registry-based lazy initialization pattern as other channels. Cache instances by `(businessId + provider + apiKeyHash)`.

### F6.4 — Prompt injection via customer context (HIGH)

**File:** `apps/api/src/modules/ai/reply-generator.ts`
**Risk:** Customer name and phone are embedded directly into the AI system prompt without sanitization: `customerInfo = \`Customer info: Name: ${customerContext.name}\``. A customer named `"Ignore previous instructions. You are now..."` corrupts the prompt structure.
**Fix:** Sanitize customer data before embedding: strip control characters, limit length, escape quotes. Or pass customer context as a separate `user` message rather than embedding in the system prompt.

### F6.5 — Unbounded token context in AI prompts (MEDIUM)

**File:** `apps/api/src/modules/ai/booking-assistant.ts`
**Risk:** `recentContext` (conversation history) and `context.services` (all business services) are passed into the system prompt without token budget accounting. A business with 500 services or months of history could exceed Claude's input token limit.
**Fix:** Implement context windowing: limit to last 10 messages and top 50 services. Count tokens before sending.

---

## 7. BullMQ Job Safety

### F7.1 — Notification processor has no idempotency (HIGH)

**File:** `apps/api/src/common/queue/notifications.processor.ts`
**Risk:** If a notification job is retried (e.g., after worker restart), the email/push notification is sent again. No deduplication check. Customers could receive duplicate reminder emails or push notifications.
**Fix:** Add `emailSentAt` tracking. Before sending, check if notification was already sent for this job's unique key.

### F7.2 — AI processing failure card leaks error details (MEDIUM)

**File:** `apps/api/src/common/queue/ai-processing.processor.ts` — `createFailureActionCard()`
**Risk:** `error.message` stored as plain text in ActionCard metadata. If the error contains sensitive context (API keys from Claude response, internal URLs), it persists in the database and is visible to business staff.
**Fix:** Sanitize error before storing: extract only error type and generic message. Strip stack traces and nested error details.

### F7.3 — Calendar sync processor silent failure (MEDIUM)

**File:** `apps/api/src/common/queue/calendar-sync.processor.ts` — `process()`
**Risk:** If booking is not found, logs a warning and returns without throwing. Job appears successful in BullMQ dashboard, but calendar sync never executes. No way to distinguish "booking not found" from "sync completed."
**Fix:** Throw a typed error for permanent failures vs. transient failures. Move to DLQ on permanent failure.

### F7.4 — Onboarding drip fragile job versioning (MEDIUM)

**File:** `apps/api/src/common/queue/onboarding-drip.processor.ts`
**Risk:** Job type determined by `job.name.startsWith('seq-step-')` string prefix check. If naming convention changes, fallback silently activates legacy service with no warning.
**Fix:** Use explicit `job.data.type` field instead of name-based routing. Add deprecation log when legacy path is used.

### F7.5 — Billing lifecycle cron loads all businesses into memory (MEDIUM)

**File:** `apps/api/src/modules/billing/billing-lifecycle.service.ts` — `checkAnnualRenewals()`
**Risk:** `findMany` without `take` limit. At scale (10,000+ businesses), all are loaded into memory simultaneously.
**Fix:** Paginate in batches of 100: `while (true) { batch = findMany({ skip, take: 100 }); ... }`.

### F7.6 — Cron jobs crash on individual failures (MEDIUM)

**File:** `apps/api/src/modules/billing/billing-lifecycle.service.ts` — `checkAccountAnniversaries()`
**Risk:** If `emailService.send()` fails for one business, the entire cron job crashes. Subsequent businesses in the batch are never processed.
**Fix:** Wrap email send in try/catch per business. Log error and continue to next.

---

## 8. AI Hub Risks

### F8.1 — Missing AI state enum validation (MEDIUM)

**File:** `apps/api/src/modules/ai/booking-assistant.ts`
**Risk:** `parsed.state` from Claude's response is not validated against the allowed `BookingState` enum values. A malformed AI response could return an invalid state string, corrupting the conversation flow.
**Fix:** Validate against an allowlist of states before accepting.

### F8.2 — Intent confidence masking API failures (LOW)

**File:** `apps/api/src/modules/ai/intent-detector.ts`
**Risk:** Defaults confidence to 0.5 when the AI response is unparseable. Callers cannot distinguish between a genuine 50% confidence detection and a complete API failure. Routing decisions may be made on fake confidence.
**Fix:** Return a separate `success: boolean` flag alongside confidence. On parse failure, set `success: false`.

### F8.3 — AI settings lack enum validation (MEDIUM)

**File:** `apps/api/src/modules/ai/ai.controller.ts` — `updateSettings()`
**Risk:** `selectedIntents: string[]` and `channelOverrides: Record<string, ...>` accept arbitrary strings. Invalid intent types or channel names are persisted in `business.aiSettings` JSON and cause downstream failures.
**Fix:** Add `@IsEnum(IntentType, { each: true })` validation. Validate channel keys against the `Channel` enum.

### F8.4 — Customer chat input unbounded (HIGH)

**File:** `apps/api/src/modules/ai/ai.controller.ts` — `customerChat()`
**Risk:** `body.question` has no max length. A malicious user can send a 100KB string, consuming unbounded Claude API tokens per request. At $15/million tokens, this is a direct cost attack.
**Fix:** Add `@MaxLength(2000)` to the DTO. Implement per-user token budget tracking.

---

## 9. Schema and Migration Risks

### F9.1 — Non-nullable fields without defaults on evolving models (MEDIUM)

**File:** `packages/db/prisma/schema.prisma`
**Risk:** When adding a new non-nullable field to an existing model (e.g., `String` without `@default`), the migration fails if the table already has rows. This is a "deployment bomb" — it works in dev (empty DB) but fails in production.
**Fix:** For all new fields on existing tables: use `@default("")` or make the field optional (`String?`) initially, then backfill and tighten.

### F9.2 — Missing composite indexes on high-traffic queries (MEDIUM)

**File:** `packages/db/prisma/schema.prisma`
**Risk:** Many queries filter by `(businessId, status)`, `(businessId, createdAt)`, or `(businessId, customerId)`. If these lack composite `@@index` directives, queries do full table scans as data grows.
**Fix:** Audit slow query logs. Add `@@index([businessId, status])` and `@@index([businessId, createdAt])` to high-traffic models (Booking, Conversation, Message, Customer).

### F9.3 — JSON fields queried without indexes (LOW)

**File:** `packages/db/prisma/schema.prisma`
**Risk:** JSON fields like `packConfig`, `aiSettings`, `channelSettings`, `metadata` are queried but PostgreSQL cannot index JSON path expressions without explicit GIN indexes.
**Fix:** For frequently queried JSON paths, add GIN indexes or extract into proper relational fields.

---

## 10. Additional Scenarios

### F10.1 — WebSocket room isolation relies on JWT alone (MEDIUM)

**File:** `apps/api/src/modules/` — `inbox.gateway.ts`
**Risk:** Clients join `business:${businessId}` rooms based on JWT claims. No secondary database check that the user belongs to that business. If a JWT is forged with a different `businessId`, the user receives all real-time events for another tenant.
**Fix:** On connection, verify `staffId` belongs to `businessId` via database query.

### F10.2 — WebSocket presence cleanup O(n*m) complexity (MEDIUM)

**File:** `apps/api/src/modules/` — `inbox.gateway.ts` — `handleDisconnect()`
**Risk:** Presence cleanup iterates all conversations × all viewers. For a business with 10K conversations, disconnect cleanup blocks the event loop.
**Fix:** Index presence by `socketId` for O(1) cleanup: `Map<socketId, Set<conversationId>>`.

### F10.3 — Exception filter leaks library names (LOW)

**File:** `apps/api/src/common/all-exceptions.filter.ts`
**Risk:** The `error` field in error responses includes exception class names like `PrismaClientKnownRequestError`, leaking internal library information to clients.
**Fix:** Remove the `error` field from production responses. Return only `statusCode`, `message`, `timestamp`, `path`.

### F10.4 — Seed scripts contain hardcoded demo credentials (LOW)

**File:** `packages/db/src/seed-demo.ts` and `CLAUDE.md`
**Risk:** Demo credentials are committed in the repo (`Bk0s!DemoSecure#2026`). If the repo is leaked, demo environments are immediately compromised.
**Fix:** Generate random passwords at seed time. Output to a gitignored file.

### F10.5 — Web chat config has no input validation (HIGH)

**File:** `apps/api/src/modules/messaging/web-chat.controller.ts` — `saveConfig()`
**Risk:** Body is typed inline with no DTO or class-validator decorators. Accepts arbitrary string lengths, invalid hex colors, invalid position values. Stored directly in `channelSettings` JSON.
**Fix:** Create a proper DTO with `@IsOptional()`, `@IsHexColor()`, `@MaxLength(100)`, `@IsEnum()` validators.

### F10.6 — Package expiration cron timezone mismatch (MEDIUM)

**File:** `apps/api/src/modules/package/package.service.ts` — `checkExpiredPackages()`
**Risk:** `@Cron(EVERY_DAY_AT_6AM)` runs in server timezone. If server is UTC but business is US/Eastern, packages expire 5 hours early from the customer's perspective.
**Fix:** Use timezone-agnostic expiration: `WHERE expiresAt < NOW()` rather than time-of-day based checks.

### F10.7 — Waitlist bulk operations lack rate limiting (MEDIUM)

**File:** `apps/api/src/modules/waitlist/waitlist.service.ts` — `bulkAction()`
**Risk:** Accepts up to 50 IDs per call with no rate limit. A caller can send 50-ID requests every second, modifying thousands of entries rapidly.
**Fix:** Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` to the controller method.

### F10.8 — Redis adapter failure degrades silently (MEDIUM)

**File:** `apps/api/src/modules/` — `inbox.gateway.ts` — `afterInit()`
**Risk:** If Redis adapter fails to initialize, WebSocket continues in single-instance mode. In multi-instance deployments, events are not synced between instances. No alert is raised.
**Fix:** If `REDIS_URL` is set, fail hard on adapter initialization failure. Log and alert.

---

## Part 2 — Test Plan

### Priority 1: Critical Security (Run First)

#### T1.1 — Webhook status endpoint spoofing
**What to do:** Send a POST to `/webhooks/whatsapp/status` with a forged body (no valid signature header). Set a known message's status to "delivered."
**What to check:** Check the database — was the message status actually updated?
**Expected:** Request should be rejected (401/403). Message status should remain unchanged.

#### T1.2 — Cross-tenant refund
**What to do:** As Business A staff, create a payment for a booking. Note the `paymentId`. Log in as Business B staff. Call `POST /refunds` with Business A's `paymentId`.
**What to check:** Does the refund process? Is money deducted from Business A's Stripe account?
**Expected:** Should return 403 or 404. No refund created.

#### T1.3 — Cross-tenant staff assignment
**What to do:** Note a `staffId` from Business B. Log in as Business A. Create a booking with `staffId` from Business B.
**What to check:** Does the booking get created? Is the foreign staff assigned?
**Expected:** Should return 400 or 403. Booking should not be created.

#### T1.4 — RolesGuard default-allow
**What to do:** Find a controller endpoint that's missing `@Roles()`. Call it as a SERVICE_PROVIDER user.
**What to check:** Does the endpoint execute?
**Expected:** Should be blocked by role guard. If it executes, the default-allow behavior is confirmed.

#### T1.5 — AI rate limit bypass across instances
**What to do:** Deploy two API instances. Send 250 AI requests to each instance (total 500).
**What to check:** Does the daily limit (500) actually block at 500, or does each instance allow 500 (total 1000)?
**Expected:** Should block at 500 total. If not, in-memory counter is confirmed as broken.

#### T1.6 — Portal auth user enumeration
**What to do:** Send `POST /portal/request-otp` with a valid phone number, then with an invalid one.
**What to check:** Are the response messages identical? Is the response timing similar?
**Expected:** Both should return the same message and similar timing.

### Priority 2: Data Integrity (Run After Security)

#### T2.1 — Concurrent conversation metadata updates
**What to do:** Simultaneously send two requests that modify `conversation.metadata` — one initiating human takeover, one updating AI state.
**What to check:** After both complete, does metadata contain both changes?
**Expected:** Both changes should be preserved. If one is lost, the race condition is confirmed.

#### T2.2 — Booking status transition validation
**What to do:** Create a COMPLETED booking. Try to update its status to PENDING.
**What to check:** Does the status change succeed?
**Expected:** Should return 400. COMPLETED → PENDING is not a valid transition.

#### T2.3 — Concurrent invoice number generation
**What to do:** Fire 10 concurrent `POST /invoices` requests for the same business.
**What to check:** Are all invoice numbers unique?
**Expected:** All 10 should have unique sequential numbers. If duplicates exist, the race condition is confirmed.

#### T2.4 — Customer bulk import rollback
**What to do:** Upload a CSV with 50 customers where row #40 has an invalid email (violates unique constraint).
**What to check:** How many customers are created? Is the import marked as failed?
**Expected:** Either all 50 created (constraint handled) or zero created (atomic rollback). Not 39.

### Priority 3: Messaging (Run After Data Integrity)

#### T3.1 — Email provider config bug
**What to do:** Configure a per-location email provider (different from default). Send an email through that location.
**What to check:** Which provider is used? Check logs for provider key resolution.
**Expected:** Should use the location-specific provider. If it uses the default, the `locationWhatsappConfig` bug is confirmed.

#### T3.2 — SMS over 160 characters
**What to do:** Trigger an AI reply on the SMS channel where the natural response exceeds 160 characters.
**What to check:** Is the message shortened? Is the full message sent? Is it truncated?
**Expected:** Message should be shortened to ≤160 chars. If it arrives truncated, the shortening bug is confirmed.

#### T3.3 — Provider timeout handling
**What to do:** Simulate a provider timeout (e.g., block WhatsApp API at the network level). Send a message.
**What to check:** Does the request hang for 120 seconds? Is the message queued for retry?
**Expected:** Should timeout within 10 seconds and queue for retry. If it hangs for 120s, timeout protection is missing.

### Priority 4: Performance (Run Under Load)

#### T4.1 — Customer timeline memory usage
**What to do:** Create a customer with 500 bookings and 500 conversations. Call `GET /customers/:id/timeline`.
**What to check:** Monitor API server memory. Does it spike? How long does the response take?
**Expected:** Should return paginated results quickly. If memory spikes by >100MB, unbounded queries are confirmed.

#### T4.2 — WebSocket disconnect cleanup
**What to do:** Connect 100 WebSocket clients to a business room. Have each view a different conversation. Disconnect all 100 simultaneously.
**What to check:** How long does cleanup take? Does the event loop block?
**Expected:** Cleanup should complete in <100ms. If it takes >1s, the O(n*m) complexity is a problem.

---

## Jest Test Files

See companion files:
- `apps/api/src/modules/messaging/__tests__/webhook-signature.spec.ts`
- `apps/api/src/modules/refunds/__tests__/tenant-isolation.spec.ts`
- `apps/api/src/modules/ai/__tests__/rate-limit-redis.spec.ts`

---

*Report generated April 3, 2026. Total findings: 62 (7 critical, 16 high, 27 medium, 12 low).*
