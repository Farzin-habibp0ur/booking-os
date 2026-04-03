---
name: security-review
description: "Automated security and reliability review for Booking OS code changes. Triggers after ANY code modification — new features, bugfixes, refactors, schema changes, controller edits, service updates, or queue/job changes. Checks for multi-tenancy violations, missing transaction wrappers, auth guard gaps, webhook verification, AI safety, race conditions, and cascading data integrity issues. Also triggers when user says 'review this', 'is this safe', 'check for bugs', 'security check', or 'audit this change'. If code was written or modified, this skill should run before considering the work complete. This is separate from the self-review-loop (which checks general correctness) — this skill checks for production safety patterns specific to this multi-tenant SaaS codebase."
---

# Security & Reliability Review

This skill exists because Booking OS is a production multi-tenant SaaS platform handling real customer data, payments, and medical information across multiple business verticals. A single missing `businessId` filter means one clinic can see another clinic's patient records. A missing `$transaction` wrapper means a cancelled booking might not unredeem its wellness package. These aren't theoretical risks — they're the exact class of bugs found in the April 2026 comprehensive code review (see `CODE_REVIEW_REPORT.md`).

The skill runs a structured audit on every code change, checking against 10 risk categories calibrated to this specific codebase. It blocks work from being considered complete until all findings are resolved.

## When This Runs

After any code modification. The trigger is broad on purpose — a one-line change to a Prisma query can introduce a multi-tenancy violation, and a small refactor to a controller can drop an auth guard. The review scopes itself to the blast radius of the change, so small changes get fast reviews.

## How It Works

### Step 1 — Identify the blast radius

Before checking anything, understand what changed and what it touches.

1. Identify all files that were created or modified in the current task
2. For each changed file, identify its **immediate neighbors**:
   - Service file → its controller, its DTOs, its test file
   - Controller file → its service, its guards/decorators
   - Prisma schema → all services that query the changed models
   - Queue processor → the service that enqueues jobs
   - Frontend component → its API calls, its middleware
3. For each changed file, identify **callers and dependents**:
   - Use Grep to find all files that import or reference the changed module
   - If a service method signature changed, find all callers
   - If a Prisma model changed, find all services that query it
4. Read ALL files in the blast radius (not just the changed ones)

This full-audit approach catches cross-module issues like the email provider config bug (where `messaging.service.ts` read from `locationWhatsappConfig` instead of `locationEmailConfig`) that a narrower review would miss.

### Step 2 — Run the 10-category checklist

For every file in the blast radius, check against each category below. Read `references/checklist.md` for the detailed checklist with code patterns to look for.

The 10 categories are:

1. **Database transaction safety** — Multiple DB writes without `$transaction`
2. **Multi-tenancy violations** — Queries missing `businessId` in WHERE clause
3. **Null and undefined edge cases** — Optional data accessed without guards
4. **Cascading data integrity** — Parent changes without child updates
5. **API and authentication gaps** — Missing guards, roles, rate limiting
6. **Messaging failures** — Unhandled provider errors, missing webhook signatures
7. **BullMQ job safety** — Missing idempotency, retry gaps, DLQ handling
8. **AI hub risks** — Missing fallbacks, prompt injection, unbounded tokens
9. **Schema and migration risks** — Non-nullable fields without defaults
10. **Performance** — N+1 queries, unbounded findMany, missing indexes

### Step 3 — Classify and report findings

For each issue found:
- State the file, function, and what the risk is
- Assign severity: **critical** (data leak, auth bypass, data loss), **high** (race condition, missing validation on sensitive data), **medium** (missing error handling, performance issue), **low** (code quality, documentation gap)
- State the recommended fix

### Step 4 — Enforce the gate

This is the key part. The review is not advisory — it's a gate.

**If ANY finding exists (any severity):** The work is NOT complete. Report all findings to the user and fix them before proceeding. After fixing, re-run the checklist on the fixed code (fixes can introduce new issues). Repeat until a clean pass finds zero findings.

**Only when zero findings remain:** The security review passes. Report: "Security review: clean pass (0 findings across 10 categories, N files checked)."

This strict enforcement exists because the comprehensive review found 62 issues in production code — many of which were medium or low severity individually but collectively represented significant risk. The "just a warning" approach is how those 62 issues accumulated in the first place.

## Integration with Other Checks

This skill runs alongside but separately from:

- **self-review-loop** — Checks general correctness (facts, line numbers, logic). Runs first.
- **security-review** (this skill) — Checks production safety patterns. Runs after self-review.
- **Pre-commit checks** — `npm run format`, `npm run lint`, `npm test`. Runs after both reviews.

The ordering matters: self-review catches content errors, security-review catches safety errors, pre-commit catches mechanical errors. A security fix that breaks formatting gets caught by pre-commit. A formatting fix that drops an auth guard gets caught by security-review. The layering is the safety net.

## Quick Reference: Common Patterns

These are the patterns that most frequently catch real issues in this codebase:

**The `businessId` check:** Every Prisma query in a service method should have `businessId` in its `where` clause. The only exceptions are: auth endpoints (login, signup, refresh), webhook handlers (they resolve business via provider IDs), and SUPER_ADMIN console endpoints. If you see a `findMany`, `findFirst`, `findUnique`, `update`, or `delete` without `businessId`, that's a finding.

**The `$transaction` check:** If a function makes 2+ Prisma write calls (create, update, delete, upsert), they should be wrapped in `prisma.$transaction()`. The most common miss is "create record A, then update record B" — if the update fails, record A is orphaned.

**The metadata JSON check:** Any read-modify-write on a JSON field (`conversation.metadata`, `business.channelSettings`, `business.aiSettings`, `business.packConfig`) is a race condition without a transaction. Two concurrent requests will lose each other's changes.

**The guard check:** Every controller method on a protected endpoint needs `@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)` at the class or method level, PLUS `@Roles(...)` on any method that should be role-restricted. Because the RolesGuard has a default-allow behavior (returns true when no roles are specified), missing `@Roles()` silently opens the endpoint to all authenticated users.

**The webhook signature check:** Every webhook endpoint (WhatsApp, SMS, Instagram, Facebook, Email) must verify the provider's signature header before processing the payload. The inbound message handlers do this correctly — but status update handlers have historically been missed.
