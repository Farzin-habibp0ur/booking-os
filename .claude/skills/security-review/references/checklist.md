# Security Review Checklist — Detailed Patterns

This is the detailed reference for each of the 10 risk categories. For each category, you'll find: what to look for, code patterns that indicate a problem, and what the fix looks like.

## Table of Contents

1. [Database Transaction Safety](#1-database-transaction-safety)
2. [Multi-Tenancy Violations](#2-multi-tenancy-violations)
3. [Null and Undefined Edge Cases](#3-null-and-undefined-edge-cases)
4. [Cascading Data Integrity](#4-cascading-data-integrity)
5. [API and Authentication Gaps](#5-api-and-authentication-gaps)
6. [Messaging Failures](#6-messaging-failures)
7. [BullMQ Job Safety](#7-bullmq-job-safety)
8. [AI Hub Risks](#8-ai-hub-risks)
9. [Schema and Migration Risks](#9-schema-and-migration-risks)
10. [Performance](#10-performance)

---

## 1. Database Transaction Safety

**What to look for:** Any function that makes 2+ Prisma write operations (create, update, delete, upsert, updateMany, deleteMany) without wrapping them in `prisma.$transaction()`.

**Red flag patterns:**

```typescript
// BAD: Two writes, no transaction
await this.prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
await this.prisma.packageRedemption.update({ where: { bookingId: id }, data: { unredeemed: true } });
// If second write fails, booking is cancelled but package is still redeemed

// BAD: Read-modify-write on JSON field
const business = await this.prisma.business.findUnique({ where: { id: businessId } });
const metadata = (business.channelSettings as any) || {};
await this.prisma.business.update({
  where: { id: businessId },
  data: { channelSettings: { ...metadata, webChat: newConfig } }
});
// Two concurrent requests will lose each other's changes
```

**Green flag patterns:**

```typescript
// GOOD: Transaction wrapping multiple writes
await this.prisma.$transaction(async (tx) => {
  await tx.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
  await tx.packageRedemption.update({ where: { bookingId: id }, data: { unredeemed: true } });
});

// GOOD: Transaction with row lock for JSON fields
await this.prisma.$transaction(async (tx) => {
  const business = await tx.business.findUnique({ where: { id: businessId } });
  const metadata = (business.channelSettings as any) || {};
  await tx.business.update({
    where: { id: businessId },
    data: { channelSettings: { ...metadata, webChat: newConfig } }
  });
});
```

**Exception:** Fire-and-forget operations that are logged and can be retried (like sending a notification after creating a record) don't need a transaction, but should have `.catch()` error handling.

---

## 2. Multi-Tenancy Violations

**What to look for:** Any Prisma query that doesn't include `businessId` in its `where` clause when it should. Also: queries that accept `businessId` from request body/params instead of the JWT token.

**Red flag patterns:**

```typescript
// BAD: Missing businessId — returns data from ALL businesses
const customers = await this.prisma.customer.findMany({
  where: { email: dto.email }
});

// BAD: businessId from request body (can be spoofed)
async create(@Body() body: { businessId: string; name: string }) {
  return this.service.create(body.businessId, body.name);
}

// BAD: Cross-reference without business check
const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
// staffId could belong to a different business
```

**Green flag patterns:**

```typescript
// GOOD: businessId from JWT via decorator
async create(@BusinessId() businessId: string, @Body() body: CreateDto) {
  return this.service.create(businessId, body);
}

// GOOD: Query scoped to business
const customers = await this.prisma.customer.findMany({
  where: { email: dto.email, businessId }
});

// GOOD: Cross-reference validated
const staff = await this.prisma.staff.findFirst({
  where: { id: dto.staffId, businessId }
});
if (!staff) throw new NotFoundException('Staff not found');
```

**Exceptions:** Auth endpoints (login, signup, refresh, forgot-password), webhook handlers (they resolve business via provider metadata), and SUPER_ADMIN console endpoints don't use businessId filtering.

---

## 3. Null and Undefined Edge Cases

**What to look for:** Optional parameters accessed without null checks, array operations without length checks, JSON.parse results used without field validation.

**Red flag patterns:**

```typescript
// BAD: Optional chaining missing
const name = customer.profile.firstName; // profile could be null

// BAD: AI response fields not validated
const parsed = JSON.parse(aiResponse);
return { state: parsed.state, serviceId: parsed.serviceId };
// parsed.state could be undefined or an invalid enum value

// BAD: Array assumed non-empty
const latest = bookings[0].startTime; // bookings could be empty

// BAD: Division without zero check
const rate = (completed / total) * 100; // total could be 0
```

**Green flag patterns:**

```typescript
// GOOD: Null guard
const name = customer?.profile?.firstName ?? 'Unknown';

// GOOD: AI response validated
const parsed = JSON.parse(aiResponse);
if (!parsed.state || !VALID_STATES.includes(parsed.state)) {
  return fallbackState;
}

// GOOD: Array check
if (!bookings.length) return null;
const latest = bookings[0].startTime;

// GOOD: Zero check
const rate = total > 0 ? (completed / total) * 100 : 0;
```

---

## 4. Cascading Data Integrity

**What to look for:** When a parent record changes status (booking cancelled, customer merged, staff deactivated, deal closed), are all related child records updated?

**Key cascades in this codebase:**

| Parent Change | Required Child Updates |
|---|---|
| Booking cancelled | Package redemption unredeemed, reminders cancelled, notifications updated, automation triggers fired |
| Customer merged | Bookings, conversations, invoices, payments, waitlist entries, deals — all transferred to primary |
| Staff deactivated | Future bookings reassigned or flagged, conversations reassigned, calendar sync disabled |
| Deal closed (won) | Vehicle status → SOLD (check not already sold), test drives completed |
| Business plan downgraded | Feature access revoked, automation rules over limit disabled |
| Service deleted | Future bookings using that service flagged, recurring bookings stopped |

**Red flag:** A status change function that updates only the parent record without touching children.

---

## 5. API and Authentication Gaps

**What to look for:** Controllers missing guards, endpoints missing role restrictions, mutation endpoints without rate limiting.

**Checklist for every controller:**

- [ ] Class-level or method-level `@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)`
- [ ] Every mutation endpoint (POST, PUT, PATCH, DELETE) has `@Roles(...)` specifying allowed roles
- [ ] Every mutation endpoint has `@Throttle(...)` or inherits from class-level throttle
- [ ] Every endpoint accepting an entity ID validates that entity belongs to the business
- [ ] Public endpoints (webhooks, portal) explicitly use `@Public()` or skip guards intentionally

**The RolesGuard gotcha:** If no `@Roles()` decorator is present, the guard returns `true` (allows all authenticated users). This means forgetting `@Roles('OWNER', 'ADMIN')` on a sensitive endpoint silently opens it to AGENT and SERVICE_PROVIDER roles.

**Rate limiting defaults:** If no `@Throttle()` is present, the global default of 100 requests per 60 seconds applies. Key overrides to check: auth (3-10/min), AI (20/min), billing (20/min), webhooks (200/min), messaging (60/min).

---

## 6. Messaging Failures

**What to look for:** External API calls without error handling, webhook handlers without signature verification, messages that can be silently dropped.

**Webhook signature checklist:**

| Channel | Header to Verify | Algorithm |
|---|---|---|
| WhatsApp (inbound + status) | `X-Hub-Signature-256` | HMAC-SHA256 |
| Instagram | `X-Hub-Signature-256` | HMAC-SHA256 |
| Facebook | `X-Hub-Signature-256` | HMAC-SHA256 |
| SMS/Twilio (inbound + status) | `X-Twilio-Signature` | HMAC-SHA1 |
| Email/Resend | `svix-signature` | HMAC-SHA256 |
| Email/SendGrid | Webhook signing secret | HMAC-SHA256 |

All comparisons must use `crypto.timingSafeEqual()`, not `===`.

**Outbound message checklist:**
- Every `provider.sendMessage()` call wrapped in try/catch
- Failure is logged and message status set to FAILED (not left as PENDING)
- Circuit breaker checked before sending (if available)
- Timeout protection (10s max) via `Promise.race()`
- SMS messages checked for 160-char limit before sending

---

## 7. BullMQ Job Safety

**What to look for:** Jobs that could fire twice, jobs with no failure handling, jobs that block the queue.

**Idempotency check:** If a job sends an email, creates a record, or calls an external API, what happens if it runs twice? The job should either:
- Check if the action was already performed (e.g., `if (message.sentAt) return;`)
- Use an idempotency key on the external call (e.g., Stripe's `idempotencyKey`)

**Retry behavior:** All jobs should have explicit `attempts` and `backoff` configuration. The AI_PROCESSING queue pattern (3 retries, exponential 1s/4s/16s) is the template.

**Failure handling:** On final failure, something visible should happen — an ActionCard created, an error logged to Sentry, or a DLQ entry created. Silent failure means nobody knows something broke.

**Queue blocking:** Long-running jobs (>30s) should use `concurrency > 1` on the processor or a separate queue to prevent blocking other jobs.

---

## 8. AI Hub Risks

**What to look for:** Prompt injection, unbounded token consumption, missing response validation, missing fallbacks.

**Prompt injection:** Any place where user-controlled data (customer name, message content, business name) is embedded directly into a system prompt without sanitization.

```typescript
// BAD: Direct embedding
const prompt = `Customer: ${customer.name}. Reply to: ${message.content}`;

// GOOD: Sanitized and length-limited
const safeName = customer.name.replace(/[\n\r\\'"]/g, '').slice(0, 100);
const safeContent = message.content.slice(0, 2000);
```

**Token budget:** System prompts should not grow unboundedly. If `context.services` or `conversationHistory` is passed into the prompt, it needs a cap (e.g., last 10 messages, top 50 services).

**Response validation:** Every `JSON.parse(aiResponse)` must be followed by field existence checks and enum validation before the parsed data is used.

**Fallbacks:** If ClaudeClient returns null or throws, the calling code should have a graceful fallback (e.g., transfer to human, return generic response). The AI being down should never crash a user-facing request.

**Cost control:** The `dailyCalls` limit must use Redis (not in-memory Map) to work across multiple API instances. Input text should have `@MaxLength()` validation to prevent cost attacks.

---

## 9. Schema and Migration Risks

**What to look for:** Non-nullable fields without defaults, missing indexes, missing cascade rules.

**New field on existing table:** If you add a required field (e.g., `String` without `?` or `@default`) to a model that already has data in production, the migration will fail. Always either:
- Make the field optional: `String?`
- Add a default: `String @default("")`
- Do a two-step migration: add as optional → backfill → make required

**Index coverage:** If your code queries by `(businessId, status)` or `(businessId, createdAt)`, check that the schema has `@@index([businessId, status])`. Missing indexes cause full table scans that get slower as data grows.

**Cascade rules:** When adding a relation, specify `onDelete`. The default is `RESTRICT` (blocks parent deletion). Common patterns:
- Child is owned by parent: `onDelete: Cascade`
- Child references parent: `onDelete: SetNull` (requires nullable FK)
- Child should block deletion: `onDelete: Restrict` (the default)

**Raw SQL:** If using `prisma.$queryRaw`, table names must use the `@@map` names (e.g., `"bookings"` not `"Booking"`).

---

## 10. Performance

**What to look for:** N+1 queries, unbounded findMany, missing pagination, large object loading.

**N+1 pattern:**

```typescript
// BAD: Query inside a loop
const bookings = await this.prisma.booking.findMany({ where: { businessId } });
for (const booking of bookings) {
  const customer = await this.prisma.customer.findUnique({ where: { id: booking.customerId } });
  // This makes N+1 queries
}

// GOOD: Include in the original query
const bookings = await this.prisma.booking.findMany({
  where: { businessId },
  include: { customer: true }
});
```

**Unbounded queries:**

```typescript
// BAD: No limit
const all = await this.prisma.customer.findMany({ where: { businessId } });

// GOOD: Paginated with reasonable limit
const page = await this.prisma.customer.findMany({
  where: { businessId },
  take: Math.min(dto.take || 20, 100),
  skip: dto.skip || 0,
  orderBy: { createdAt: 'desc' }
});
```

**Cron jobs:** Any `@Cron` function that calls `findMany` should paginate in batches. Loading all businesses/bookings/customers into memory in a single query will OOM at scale.
