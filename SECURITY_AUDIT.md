# Booking OS - Security Audit Report

**Date:** 2026-02-17
**Scope:** Full codebase audit across 5 security domains
**Auditor:** Automated deep analysis (Claude Code)

---

## Executive Summary

The Booking OS codebase demonstrates **strong foundational security** including Prisma-based SQL injection prevention, multi-tenant isolation via TenantGuard, rate limiting on auth endpoints, secure cookie configuration, AES-256-GCM encryption for OAuth tokens, and comprehensive Nginx/Helmet security headers.

However, the audit identified **9 critical**, **12 high**, and **16 medium** severity issues across authentication, business logic, and input validation. The most urgent themes are:

1. **Race conditions** in booking creation, waitlist claims, payment processing, and status transitions (no database-level locking)
2. **JWT token lifecycle** gaps (no revocation, no active-status check, weak default secret)
3. **Client-side token storage** in localStorage (XSS-vulnerable, bypasses httpOnly cookies)
4. **Payment security** gaps (no idempotency keys, deposit race condition)
5. **Missing input validation** on campaign, automation, and custom field endpoints

---

## Findings by Priority

### CRITICAL (Fix Immediately - 9 issues) — ALL FIXED

| # | Issue | File | Lines | Impact |
|---|-------|------|-------|--------|
| C1 | **Double-booking race condition** - Conflict check and booking creation not wrapped in a transaction. Two simultaneous requests for same slot can both succeed | `booking.service.ts` | 88-171 | Overbooking, data integrity |
| C2 | **JWT tokens in localStorage** - Frontend stores JWT in localStorage instead of using httpOnly cookies set by backend. Any XSS can steal auth tokens | `apps/web/src/lib/api.ts` | 9-13 | Full account takeover via XSS |
| C3 | **Weak default JWT secret** - Hardcoded fallback `'dev-secret-change-in-production'` used if JWT_SECRET env var is missing. Attacker can forge valid JWTs | `jwt.strategy.ts`, `auth.service.ts` | 20, 52 | Authentication bypass |
| C4 | **Password change doesn't revoke JWTs** - Revokes `PASSWORD_RESET` tokens instead of JWT access tokens. Stolen tokens remain valid after password change | `auth.service.ts` | 233-252 | Persistent unauthorized access |
| C5 | **Self-serve token reuse** - Tokens marked as used AFTER action executes. Concurrent requests can reuse same reschedule/cancel token | `self-serve.service.ts` | 81-260 | Duplicate reschedules/cancellations |
| C6 | **Waitlist claim race condition** - Status check and booking creation not atomic. Two simultaneous claims create duplicate bookings | `self-serve.service.ts` | 216-260 | Double-booking of waitlist slots |
| C7 | **Booking status transition race** - `updateStatus()` reads current status without transaction lock. Concurrent updates create invalid state | `booking.service.ts` | 242-411 | Data inconsistency |
| C8 | **Deposit payment race condition** - `createDepositPaymentIntent()` reads booking and deposit amount in separate calls without a transaction. Price can change between read and Stripe call | `billing.service.ts` | 199-233 | Financial discrepancy |
| C9 | **No Stripe idempotency keys** - `stripe.paymentIntents.create()` called without idempotency keys. Network retries can create duplicate payment intents for same booking | `billing.service.ts` | 214 | Duplicate charges |

---

### HIGH (Fix Within 1 Sprint - 12 issues)

| # | Issue | File | Lines | Impact |
|---|-------|------|-------|--------|
| H1 | **No JWT revocation/blacklist system** - Once issued, JWTs valid until expiry. Logout only clears cookies, doesn't invalidate tokens | `auth.controller.ts` | 88-93 | Stolen tokens can't be revoked |
| H2 | **No staff active-status check in JWT strategy** - JWT validation doesn't verify staff still exists/is active. Deactivated users keep access | `jwt.strategy.ts` | 25-34 | Deactivated staff retain access |
| H3 | **Refresh token accepted from request body** - Should only come from httpOnly cookies. Body-based tokens vulnerable to XSS/logging leaks | `auth.controller.ts` | 71-86 | Token theft via request logging |
| H4 | **No rate limiting on campaign send** - Admin can send unlimited campaigns simultaneously, causing notification spam and resource exhaustion | `campaign.controller.ts` | 53 | DoS, notification spam |
| H5 | **Unbounded automation rule execution** - Cron runs every minute processing ALL active rules without pagination or time limits | `automation-executor.service.ts` | 12-31 | CPU exhaustion DoS |
| H6 | **No booking creation rate limit** - The `create()` endpoint has no `@Throttle()` decorator | `booking.controller.ts` | 45 | DoS via booking spam |
| H7 | **iCal feed token never expires** - Token-only access to 90+ days of booking data with no expiry or rotation mechanism | `calendar-sync.service.ts` | 244-264 | Persistent data exposure |
| H8 | **Bulk booking update lacks audit + validation** - 50 bookings updated at once with no per-booking status validation or audit logging | `booking.service.ts` | 542-576 | Mass cancellation without trail |
| H9 | **No offer redemption limit** - Offers have date ranges but no max redemption count. Single code usable unlimited times | `offer.service.ts` | - | Revenue loss |
| H10 | **Open redirect in OAuth flow** - Calendar sync redirect URL comes from API response without client-side validation | `settings/calendar/page.tsx` | 83 | Phishing via redirect |
| H11 | **No server-side route protection** - Protected pages rely entirely on client-side auth checks. No Next.js middleware guards | Shell/AuthProvider | - | Brief access to protected UI |
| H12 | **Campaign/automation controllers accept `any` body** - No DTO validation on these endpoints despite global ValidationPipe | `campaign.controller.ts`, `automation.controller.ts` | 25, 41 | Mass assignment, injection |

---

### MEDIUM (Fix Within 2 Sprints - 16 issues)

| # | Issue | File | Lines | Impact |
|---|-------|------|-------|--------|
| M1 | **Weak password requirements** - Only 8 chars minimum, no complexity rules (uppercase, numbers, special chars) | `dto.ts` | 474-475 | Weak account security |
| M2 | **In-memory brute force tracking** - `failedAttempts` Map lost on restart, per-instance in multi-server deployments | `auth.service.ts` | 14-47 | Brute force bypass |
| M3 | **Refresh token falls back to JWT secret** - Same signing key for both token types if `JWT_REFRESH_SECRET` not set | `auth.service.ts` | 49-55 | Reduced token isolation |
| M4 | **Unvalidated JSON custom fields** - `Record<string, unknown>` allows arbitrary nesting/depth without schema validation | `dto.ts` | 50-52, 113-115, etc. | JSON injection, DB bloat |
| M5 | **Template variable XSS** - User-provided values (names) injected into HTML email templates without escaping | `template.service.ts` | 79-83 | XSS in email clients |
| M6 | **Naive CSV parsing** - Uses `split(',')` instead of RFC 4180 parser. No file size limit on upload | `customer.controller.ts` | 77-107 | Data corruption, DoS |
| M7 | **Bcrypt rounds too low** - Uses 10 rounds; modern recommendation is 12-13 for 2026 hardware | `auth.service.ts` | 90 | Faster offline cracking |
| M8 | **No Content-Security-Policy** - CSP not configured in Nginx or helmet. Amplifies XSS impact | `nginx.conf`, `main.ts` | - | Unrestricted script execution |
| M9 | **Database SSL not enforced** - Production DATABASE_URL doesn't include `sslmode=require` | `.env.production` | - | Data in transit exposure |
| M10 | **WhatsApp webhook signature not enforced** - `verifyHmac()` exists but not called on inbound endpoint | `webhook.controller.ts` | 73 | Webhook spoofing |
| M11 | **Login rate limit too generous** - 30 attempts/minute; should be 5-10 for brute force protection | `auth.controller.ts` | 61 | Credential brute force |
| M12 | **Booking reschedule skips conflict check** - `update()` allows changing `startTime` without re-checking conflicts | `booking.service.ts` | 173-194 | Double-booking on reschedule |
| M13 | **No audit logging for CSV import** - Bulk customer import has no record of who/when/what was imported | `customer.controller.ts` | 72-110 | GDPR/compliance gap |
| M14 | **Automation frequency cap bypass** - Per-rule cap doesn't prevent multiple rules targeting same customer | `automation-executor.service.ts` | 137-158 | Message spam |
| M15 | **Error messages expose API structure** - Raw API error messages shown in client-side UI without sanitization | `apps/web/src/lib/api.ts` | 40-50 | Information disclosure |
| M16 | **No email verification on signup** - Users can register with unverified email addresses | signup flow | - | Fake registrations |

---

## Positive Findings (Already Well-Implemented)

| Area | Implementation | Assessment |
|------|---------------|------------|
| SQL injection prevention | Prisma ORM with parameterized queries; only 2 raw queries (both safe) | Excellent |
| Multi-tenancy | `TenantGuard` + `@BusinessId()` decorator on all endpoints; JWT includes businessId | Excellent |
| Cookie security | httpOnly, secure, sameSite=strict, scoped paths, appropriate maxAge | Excellent |
| HTTPS enforcement | Nginx 301 redirect, TLS 1.2/1.3 only, HSTS with 1-year max-age | Excellent |
| Nginx security headers | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy | Excellent |
| Error handling | Generic messages to client, full details logged internally, Sentry integration | Excellent |
| Log redaction | Authorization headers and cookies redacted from Pino logs | Excellent |
| Docker security | Multi-stage builds, non-root users (UID 1001), alpine images, health checks | Excellent |
| OAuth token encryption | AES-256-GCM with random IV and auth tag for calendar sync tokens | Excellent |
| Stripe webhook verification | `constructEvent()` with signature validation | Excellent |
| Global input validation | ValidationPipe with whitelist + forbidNonWhitelisted globally applied | Excellent |
| Rate limiting on auth | Signup 3/min, login 30/min, forgot-password 3/min, reset 5/min | Good |
| RBAC | `@Roles()` decorator with RolesGuard on admin endpoints | Good |
| WhatsApp HMAC | Timing-safe comparison with crypto.timingSafeEqual | Excellent |

---

## Recommended Fix Order

### Sprint 1: Critical Race Conditions + Auth + Payments (C1-C9, H1-H3)

**1. Wrap booking creation in transaction** (C1)
```typescript
// booking.service.ts - wrap conflict check + create in $transaction
const booking = await this.prisma.$transaction(async (tx) => {
  const conflict = await tx.booking.findFirst({ where: { ... } });
  if (conflict) throw new BadRequestException('Time slot not available');
  return tx.booking.create({ data: { ... } });
});
```

**2. Switch frontend to cookie-based auth** (C2, H3)
- Remove localStorage token storage from `api.ts`
- Rely on httpOnly cookies already set by backend
- Remove body-based refresh token support

**3. Remove default JWT secret fallback** (C3)
```typescript
// jwt.strategy.ts - fail hard if secret missing
const secret = config.get('JWT_SECRET');
if (!secret) throw new Error('JWT_SECRET must be configured');
```

**4. Fix password change token revocation** (C4)
```typescript
// auth.service.ts - revoke REFRESH tokens, not PASSWORD_RESET
await this.tokenService.revokeTokens(staff.email, 'REFRESH');
```

**5. Mark self-serve tokens used BEFORE executing action** (C5)
```typescript
// self-serve.service.ts
await this.tokenService.markUsed(tokenRecord.id); // FIRST
const booking = await this.bookingService.create(...); // THEN
```

**6. Wrap waitlist claim in transaction** (C6)
**7. Wrap status transitions in transaction** (C7)
**8. Add Stripe idempotency keys** (C9)
```typescript
// billing.service.ts
stripe.paymentIntents.create({ ... }, { idempotencyKey: `deposit-${bookingId}` });
```

**9. Wrap deposit payment in transaction** (C8)
**10. Add JWT blacklist with Redis** (H1)
**11. Validate staff active status in JWT strategy** (H2)

### Sprint 2: Rate Limiting + Input Validation (H4-H6, H12, M4, M6)

- Add `@Throttle()` to campaign send, booking create, automation endpoints
- Create proper DTOs for campaign and automation controllers
- Add JSON schema validation for customFields
- Upgrade CSV parsing to use a proper library with size limits

### Sprint 3: Remaining High + Medium Issues

- Add offer redemption limits
- Validate OAuth redirect URLs on client
- Add Next.js middleware for server-side route protection
- Increase password requirements to 12+ chars with complexity
- Move brute force tracking to Redis
- Add CSP headers
- Enforce database SSL
- Increase bcrypt rounds to 12
- Add audit logging for bulk operations

---

## Architecture Recommendations

1. **Add Redis** for JWT blacklist, brute force tracking, and distributed rate limiting
2. **Add Next.js middleware** (`middleware.ts`) for server-side route protection
3. **Add database constraints** for booking slot uniqueness (staffId + startTime + active status)
4. **Implement token rotation** for iCal feeds (auto-expire after 90 days)
5. **Add CSP headers** via Nginx or Next.js middleware
6. **Run `npm audit`** regularly and update deprecated transitive dependencies
