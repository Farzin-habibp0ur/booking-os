# BookingOS AI Hub — Implementation Fix Plan

> **QA Audit Date:** April 3, 2026
> **Total Issues:** 46 bugs + 14 feature gaps
> **Priority:** CRITICAL fixes first, then HIGH, then MEDIUM/LOW
> **Rule:** Every fix MUST include tests. Run the full Self-Validation Protocol (CLAUDE.md) before committing.

---

## Sprint 1 — Critical Fixes (Week 1)

### FIX-01: DELAY Step Infinite Self-Loop [CRITICAL]

**File:** `apps/api/src/modules/automation/automation-executor.service.ts`
**Lines:** 356–367

**Bug:** When a DELAY step is the last step in a workflow, `findNextStep()` returns null. Line 365 falls back to `stepId: nextStep?.id || step.id`, causing the execution to re-schedule itself to run the same DELAY step indefinitely.

**Compare with:** The ACTION handler (lines 341–355) correctly checks `if (nextStep)` and sets `status: 'COMPLETED'` when there's no next step. The DELAY handler is missing this same terminal check.

**Fix:**

```
In the `} else if (step.type === 'DELAY') {` block (line 356), replace lines 359-367 with:

const nextStep = this.findNextStep(allSteps, step);
if (!nextStep) {
  // Terminal DELAY — mark execution as completed
  await this.prisma.automationExecution.update({
    where: { id: executionId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
} else {
  const delayMinutes = stepConfig.delayMinutes || 0;
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  await this.prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      status: 'WAITING',
      scheduledAt,
      stepId: nextStep.id,
    },
  });
}
```

**Test:** In the automation-executor spec, add a test case: "should complete execution when DELAY is the last step" — create a workflow with a single DELAY step, advance it, and assert status is COMPLETED (not WAITING).

---

### FIX-02: Add Distributed Locking to Agent Framework [CRITICAL]

**Files:**
- `apps/api/src/modules/agent/agent-framework.service.ts` (lines 69–129)
- `apps/api/src/modules/automation/automation-executor.service.ts` (line 13)

**Bug:** `triggerAgent()` has zero concurrency protection. The automation executor uses `private processing = false` which is in-memory only — useless in multi-pod deployments.

**Context:** The project uses Redis via `REDIS_URL` environment variable. Redis is already injected as optional in several services (Socket.IO adapter, BullMQ queues). There is no existing Redlock or distributed lock utility.

**Fix — Part A (create shared lock utility):**

Create `apps/api/src/common/distributed-lock.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DistributedLockService implements OnModuleInit {
  private readonly logger = new Logger(DistributedLockService.name);
  private redis: Redis | null = null;

  onModuleInit() {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  /**
   * Acquire a lock. Returns an unlock function, or null if lock could not be acquired.
   * Uses Redis SET NX EX pattern (no Redlock dependency needed for single-instance Redis).
   */
  async acquire(key: string, ttlMs: number = 60_000): Promise<(() => Promise<void>) | null> {
    if (!this.redis) return async () => {}; // No Redis = no locking, proceed (dev mode)

    const lockValue = `${Date.now()}-${Math.random()}`;
    const result = await this.redis.set(key, lockValue, 'PX', ttlMs, 'NX');

    if (result !== 'OK') return null; // Lock already held

    return async () => {
      // Only release if we still own the lock (Lua script for atomicity)
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
      await this.redis!.eval(script, 1, key, lockValue);
    };
  }
}
```

Register in `AppModule` providers and exports so it's globally available.

**Fix — Part B (use lock in agent framework):**

In `agent-framework.service.ts`, inject `DistributedLockService` and wrap `triggerAgent()`:

```typescript
async triggerAgent(businessId: string, agentType: string) {
  const agent = this.agents.get(agentType);
  if (!agent) throw new NotFoundException(`Agent type ${agentType} not registered`);
  // ... existing config check ...

  const lockKey = `agent-lock:${businessId}:${agentType}`;
  const unlock = await this.lockService.acquire(lockKey, 120_000); // 2 min TTL
  if (!unlock) {
    throw new BadRequestException(`Agent ${agentType} is already running for this business`);
  }

  try {
    // ... existing run creation and execution logic ...
  } finally {
    await unlock();
  }
}
```

**Fix — Part C (use lock in automation executor):**

Replace `private processing = false` (line 13) with distributed lock in `executeRules()`:

```typescript
async executeRules() {
  const lockKey = 'automation-executor-lock';
  const unlock = await this.lockService.acquire(lockKey, 55_000); // 55s (< 60s cron interval)
  if (!unlock) return; // Another instance is processing

  try {
    // ... existing processing logic (remove this.processing references) ...
  } finally {
    await unlock();
  }
}
```

**Test:** Test that `triggerAgent()` throws `BadRequestException` when lock is already held. Mock `DistributedLockService.acquire()` to return `null`.

---

### FIX-03: Wire Up 3 Missing Automation Triggers [HIGH]

**Bug:** MESSAGE_RECEIVED, CUSTOMER_CREATED, and PAYMENT_RECEIVED triggers exist in the AutomationTrigger enum but no service calls `evaluateTrigger()` for them.

**Existing pattern** (copy from `campaign-dispatch.service.ts:155` and `testimonials.controller.ts:140`):

```typescript
// Fire-and-forget pattern used across the codebase:
if (this.automationExecutor) {
  this.automationExecutor
    .evaluateTrigger('TRIGGER_NAME', { businessId, customerId, ...context })
    .catch((err) => this.logger.warn(`Trigger evaluation failed: ${err.message}`));
}
```

**Fix A — MESSAGE_RECEIVED:**

File: `apps/api/src/modules/messaging/webhook.controller.ts`

1. Add import at the top of the file:
   ```typescript
   import { AutomationExecutorService } from '../automation/automation-executor.service';
   ```
   Note: `forwardRef`, `Optional`, and `Inject` are already imported in this file.

2. Add to the constructor (line 50–63) as the last parameter:
   ```typescript
   @Optional() @Inject(forwardRef(() => AutomationExecutorService))
   private automationExecutor?: AutomationExecutorService,
   ```

3. In the private `processInboundMessage()` method (line 140), add BEFORE the `return` statement at line 357 (after usage recording, after AI queue). The local variables available at this point are `business`, `customer`, `conversation`, `message`, and `channel`:
   ```typescript
   if (this.automationExecutor) {
     this.automationExecutor
       .evaluateTrigger('MESSAGE_RECEIVED', {
         businessId: business.id,
         customerId: customer.id,
         conversationId: conversation.id,
         messageId: message.id,
         channel,
       })
       .catch((err) => this.logger.warn(`MESSAGE_RECEIVED trigger failed: ${err.message}`));
   }
   ```

4. Register `AutomationExecutorService` in the messaging module's imports/providers if not already available.

**Fix B — CUSTOMER_CREATED:**

File: `apps/api/src/modules/customer/customer.service.ts`

1. Add `AutomationExecutorService` as optional dependency (same `@Optional() @Inject(forwardRef(...))` pattern).
2. The `create()` method (line 186) currently returns inline: `return this.prisma.customer.create(...)`. Restructure it to capture the result:
   ```typescript
   async create(
     businessId: string,
     data: { name: string; phone: string; email?: string; tags?: string[]; customFields?: any },
   ) {
     const created = await this.prisma.customer.create({ data: { businessId, ...data } });

     if (this.automationExecutor) {
       this.automationExecutor
         .evaluateTrigger('CUSTOMER_CREATED', {
           businessId: created.businessId,
           customerId: created.id,
           customerName: created.name,
           customerEmail: created.email,
           customerPhone: created.phone,
         })
         .catch((err) => this.logger.warn(`CUSTOMER_CREATED trigger failed: ${err.message}`));
     }

     return created;
   }
   ```

**Fix C — PAYMENT_RECEIVED:**

File: `apps/api/src/modules/payments/payments.service.ts`

1. Add `AutomationExecutorService` as optional dependency (same `@Optional() @Inject(forwardRef(...))` pattern).
2. The `create()` method (line 9) currently returns inline. Restructure it:
   ```typescript
   async create(businessId: string, data: CreatePaymentDto, recordedById: string) {
     const payment = await this.prisma.payment.create({
       data: {
         businessId,
         bookingId: data.bookingId,
         customerId: data.customerId,
         amount: data.amount,
         method: data.method,
         reference: data.reference,
         notes: data.notes,
         recordedById,
       },
       include: { booking: true, customer: true },
     });

     if (this.automationExecutor) {
       this.automationExecutor
         .evaluateTrigger('PAYMENT_RECEIVED', {
           businessId,
           customerId: data.customerId,
           bookingId: data.bookingId,
           amount: payment.amount,
           paymentMethod: payment.method,
         })
         .catch((err) => this.logger.warn(`PAYMENT_RECEIVED trigger failed: ${err.message}`));
     }

     return payment;
   }
   ```

**Note:** Stripe webhook payments are handled in `billing.service.ts` via `payment_intent.succeeded`. Consider also wiring PAYMENT_RECEIVED there if you want automation triggers for Stripe payments, not just manual recordings.

**Test:** In each spec file, add a test verifying `evaluateTrigger` is called with correct args. Mock the executor as `{ evaluateTrigger: jest.fn().mockResolvedValue(undefined) }` — same pattern used in `campaign-dispatch.service.spec.ts:54` and `testimonials.controller.spec.ts:34`.

---

### FIX-04: Implement 3 Missing Automation Actions [HIGH]

**File:** `apps/api/src/modules/automation/automation-executor.service.ts`
**Lines:** 561–686 (inside `executeActions()` for-loop)

**Bug:** SEND_TEMPLATE, ASSIGN_STAFF, and SEND_NOTIFICATION are in the AutomationAction enum but have no execution handlers.

**Fix:** Add three new `if` blocks inside the `for (const action of actions)` loop in `executeActions()`, following the exact same pattern as the existing SEND_EMAIL block (lines 612–638):

```typescript
// SEND_TEMPLATE — send a pre-approved message template via the notification queue
if (action.type === 'SEND_TEMPLATE' && action.templateId && this.notificationQueue) {
  const customer = customerId
    ? await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, phone: true, email: true },
      })
    : null;
  if (customer) {
    const channel = await this.resolveChannel(customer, businessId);
    const address = channel === 'EMAIL' ? customer.email : customer.phone;
    if (address) {
      await this.notificationQueue.add('automation-template', {
        to: address,
        channel,
        templateId: action.templateId,
        variables: { customerName: customer.name || 'there', ...(action.variables || {}) },
        businessId,
        customerId: customer.id,
        automationRuleId: rule.id,
      });
      this.usageService
        .recordUsage(businessId, channel, 'OUTBOUND')
        .catch((err) => this.logger.error(`Usage recording failed: ${err.message}`));
    }
  }
}

// ASSIGN_STAFF — assign a staff member to the customer's conversation
if (action.type === 'ASSIGN_STAFF' && action.staffId) {
  const conversation = customerId
    ? await this.prisma.conversation.findFirst({
        where: { businessId, customerId, status: { in: ['OPEN', 'WAITING'] } },
        orderBy: { lastMessageAt: 'desc' },
      })
    : null;
  if (conversation) {
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedStaffId: action.staffId },
    });
  }
}

// SEND_NOTIFICATION — push notification to staff via InboxGateway + optional push
if (action.type === 'SEND_NOTIFICATION' && action.message && this.notificationQueue) {
  await this.notificationQueue.add('automation-notification', {
    businessId,
    title: action.title || 'Automation Notification',
    message: this.renderTemplate(action.message, { customerName: 'Customer' }),
    targetStaffId: action.staffId || null, // null = broadcast to all staff
    automationRuleId: rule.id,
  });
}
```

**Test:** Add test cases for each new action type in automation-executor spec. Mock `notificationQueue.add` and verify it's called with correct job name and payload.

---

## Sprint 2 — High Severity Fixes (Week 2)

### FIX-05: Implement `check_waitlist` CTA Handler [HIGH]

**File:** `apps/api/src/modules/action-card/action-card-executor.service.ts`
**Lines:** 40–54 (switch statement)

**Bug:** SchedulingOptimizer cards include `{ label: 'Check Waitlist', action: 'check_waitlist', variant: 'primary' }` (scheduling-optimizer.service.ts line 120) but executeCta() has no case for it.

**Context:** The executor already has access to PrismaService and InboxGateway. The WaitlistEntry model has fields: customerId, serviceId, staffId, status, timeWindowStart, timeWindowEnd, dateFrom, dateTo. The card metadata includes `date`, `staffId`, `totalGapMins`, `gapCount`.

**Fix:** Add a new case in the switch and a handler method:

```typescript
// In the switch (line 40):
case 'check_waitlist':
  return this.handleCheckWaitlist(businessId, actionCard, staffId);

// New handler method:
private async handleCheckWaitlist(
  businessId: string,
  actionCard: any,
  staffId: string,
): Promise<ExecutionResult> {
  const metadata = (actionCard.metadata as any) || {};
  const preview = (actionCard.preview as any) || {};
  const gapDate = metadata.date;
  const gapStaffId = metadata.staffId;

  if (!gapDate) {
    return { success: false, action: 'check_waitlist', error: 'No date in card metadata' };
  }

  // Find ACTIVE waitlist entries that could fill this gap
  const entries = await this.prisma.waitlistEntry.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      ...(gapStaffId && { OR: [{ staffId: gapStaffId }, { staffId: null }] }),
      ...(gapDate && {
        OR: [
          { dateFrom: null },
          { dateFrom: { lte: new Date(gapDate) }, dateTo: { gte: new Date(gapDate) } },
        ],
      }),
    },
    include: { customer: true, service: true },
    take: 10,
  });

  if (entries.length === 0) {
    return { success: true, action: 'check_waitlist', error: 'No matching waitlist entries found' };
  }

  // Emit event with matching entries so the UI can display them
  this.inboxGateway.emitToBusinessRoom(businessId, 'action-card:updated', {
    actionCardId: actionCard.id,
    waitlistMatches: entries.map((e) => ({
      id: e.id,
      customerName: e.customer.name,
      serviceName: e.service.name,
      customerId: e.customerId,
    })),
  });

  return { success: true, action: 'check_waitlist' };
}
```

**Test:** Mock prisma.waitlistEntry.findMany to return entries, verify the socket emit includes customer names.

---

### FIX-06: Implement `merge` CTA Handler [HIGH]

**File:** `apps/api/src/modules/action-card/action-card-executor.service.ts`

**Bug:** DataHygieneAgent cards include 'Merge' CTAs but executeCta() has no handler. The card preview contains `customer1` and `customer2` objects with IDs.

**Context:** The Customer model has 26 relations (bookings, conversations, actionCards, testimonials, deals, payments, waitlistEntries, outboundDrafts, etc.). A merge must re-point all relations from the secondary customer to the primary, then soft-delete the secondary. Customer has `deletedAt` for soft delete.

**Fix:** Add switch case and handler:

```typescript
case 'merge':
  return this.handleMerge(businessId, actionCard, staffId);

private async handleMerge(
  businessId: string,
  actionCard: any,
  staffId: string,
): Promise<ExecutionResult> {
  const preview = (actionCard.preview as any) || {};
  const primaryId = preview.customer1?.id;
  const secondaryId = preview.customer2?.id;

  if (!primaryId || !secondaryId) {
    return { success: false, action: 'merge', error: 'Missing customer IDs for merge' };
  }

  // Verify both customers belong to this business
  const [primary, secondary] = await Promise.all([
    this.prisma.customer.findFirst({ where: { id: primaryId, businessId } }),
    this.prisma.customer.findFirst({ where: { id: secondaryId, businessId } }),
  ]);

  if (!primary || !secondary) {
    return { success: false, action: 'merge', error: 'One or both customers not found' };
  }

  // Use a transaction to re-point all relations and soft-delete
  await this.prisma.$transaction(async (tx) => {
    // Re-point bookings
    await tx.booking.updateMany({
      where: { customerId: secondaryId, businessId },
      data: { customerId: primaryId },
    });
    // Re-point conversations
    await tx.conversation.updateMany({
      where: { customerId: secondaryId, businessId },
      data: { customerId: primaryId },
    });
    // Re-point action cards
    await tx.actionCard.updateMany({
      where: { customerId: secondaryId, businessId },
      data: { customerId: primaryId },
    });
    // Merge tags (union)
    const primaryTags = (primary.tags || []) as string[];
    const secondaryTags = (secondary.tags || []) as string[];
    const mergedTags = [...new Set([...primaryTags, ...secondaryTags])];
    await tx.customer.update({
      where: { id: primaryId },
      data: {
        tags: mergedTags,
        // Fill in missing contact info from secondary
        ...((!primary.email && secondary.email) && { email: secondary.email }),
        ...((!primary.phone && secondary.phone) && { phone: secondary.phone }),
      },
    });
    // Soft-delete secondary
    await tx.customer.update({
      where: { id: secondaryId },
      data: { deletedAt: new Date() },
    });
  });

  return { success: true, action: 'merge' };
}
```

**Test:** Mock prisma.$transaction callback. Verify updateMany calls for bookings, conversations, actionCards. Verify secondary customer gets deletedAt set.

---

### FIX-07: Unify Step-Based and Direct Action Execution [HIGH]

**File:** `apps/api/src/modules/automation/automation-executor.service.ts`
**Lines:** 407–443

**Bug:** `executeStepAction()` only handles UPDATE_STATUS and ADD_TAG. All other action types (SEND_MESSAGE, SEND_EMAIL, WEBHOOK, etc.) silently skip but FALSELY log as 'SENT' on line 434–443.

**Fix:** Delegate unhandled actions to the existing `executeActions()` method instead of silently logging success:

```typescript
private async executeStepAction(execution: any, config: Record<string, any>) {
  const actionType = config.actionType || 'SEND_MESSAGE';

  if (actionType === 'UPDATE_STATUS' && config.newStatus && execution.bookingId) {
    await this.prisma.booking.update({
      where: { id: execution.bookingId },
      data: { status: config.newStatus },
    });
  } else if (actionType === 'ADD_TAG' && config.tag && execution.customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: execution.customerId },
      select: { tags: true },
    });
    if (customer) {
      const tags = (customer.tags || []) as string[];
      if (!tags.includes(config.tag)) {
        await this.prisma.customer.update({
          where: { id: execution.customerId },
          data: { tags: [...tags, config.tag] },
        });
      }
    }
  } else {
    // Delegate all other action types to executeActions()
    // which handles SEND_MESSAGE, SEND_EMAIL, REQUEST_TESTIMONIAL,
    // UPDATE_CUSTOMER_FIELD, WEBHOOK, SEND_TEMPLATE, ASSIGN_STAFF, SEND_NOTIFICATION
    const rule = await this.prisma.automationRule.findUnique({
      where: { id: execution.automationRuleId },
    });
    if (rule) {
      await this.executeActions(
        rule,
        [{ type: actionType, ...config }],
        execution.businessId,
        execution.bookingId,
        execution.customerId,
      );
      return; // executeActions handles its own logging
    }
  }

  // Log only for actions handled directly above
  await this.prisma.automationLog.create({
    data: {
      automationRuleId: execution.automationRuleId,
      businessId: execution.businessId,
      bookingId: execution.bookingId || null,
      customerId: execution.customerId || null,
      action: actionType,
      outcome: 'SENT',
    },
  });
}
```

**Test:** Create a step-based execution with actionType 'SEND_MESSAGE', verify it delegates to executeActions and actually sends (notificationQueue.add called).

---

### FIX-08: Implement Advanced Filter Operators [HIGH]

**File:** `apps/api/src/modules/automation/automation-executor.service.ts`
**Lines:** 739–746

**Bug:** `matchesFilters()` only supports strict equality (`!==`). Cannot express `amount > 100` or `serviceName contains Facial`.

**Fix:** Replace the simple equality check with an operator-based matcher:

```typescript
private matchesFilters(filters: Record<string, any>, context: Record<string, any>): boolean {
  for (const [key, filterValue] of Object.entries(filters)) {
    const actual = context[key];
    if (actual === undefined) continue; // Skip fields not in context

    // Support operator objects: { operator: 'gt', value: 100 }
    if (typeof filterValue === 'object' && filterValue !== null && filterValue.operator) {
      const { operator, value } = filterValue;
      switch (operator) {
        case 'eq': if (actual !== value) return false; break;
        case 'neq': if (actual === value) return false; break;
        case 'gt': if (actual <= value) return false; break;
        case 'gte': if (actual < value) return false; break;
        case 'lt': if (actual >= value) return false; break;
        case 'lte': if (actual > value) return false; break;
        case 'contains':
          if (typeof actual !== 'string' || !actual.toLowerCase().includes(String(value).toLowerCase())) return false;
          break;
        case 'in':
          if (!Array.isArray(value) || !value.includes(actual)) return false;
          break;
        case 'not_in':
          if (Array.isArray(value) && value.includes(actual)) return false;
          break;
        default:
          if (actual !== value) return false; // Fallback to equality
      }
    } else {
      // Backward compatible: plain value = strict equality
      if (actual !== filterValue) return false;
    }
  }
  return true;
}
```

**Test:** Test each operator: eq, neq, gt, gte, lt, lte, contains, in, not_in. Test backward compatibility with plain value filters.

---

### FIX-09: Fix Agent Dedup Race Conditions [HIGH]

**Files:** All 5 agent files in `apps/api/src/modules/agent/agents/`

**Bug:** All agents use `findFirst → create` for deduplication, which has a race window between the check and the insert.

**Fix:** Two changes needed per agent:

**Change 1 — Expand dedup status filter (all 5 agents):**

The dedup query currently only checks `status: 'PENDING'`. Expand to include SNOOZED and APPROVED so snoozed or approved-but-not-yet-executed cards prevent duplicate creation:

```typescript
// BEFORE (e.g., retention-agent.service.ts line 89):
status: 'PENDING',

// AFTER:
status: { in: ['PENDING', 'SNOOZED', 'APPROVED'] },
```

**Change 2 — Concurrency protection (covered by FIX-02):**

FIX-02's distributed lock already prevents concurrent agent runs for the same business+agentType, which eliminates the findFirst→create race condition. No additional transaction wrapping is needed if FIX-02 is implemented first.

If you want defense-in-depth beyond the distributed lock, wrap the dedup check + card creation in a Prisma interactive transaction. Note: agents currently use `this.actionCardService.create()` which handles socket emit events. To keep that behavior, perform the dedup check inside a serializable transaction and call actionCardService.create() only if no duplicate was found:

```typescript
// BEFORE:
const existingCard = await this.prisma.actionCard.findFirst({ where: { ... } });
if (existingCard) continue;
await this.actionCardService.create({ ... });

// AFTER (defense-in-depth):
const isDuplicate = await this.prisma.$transaction(async (tx) => {
  const existingCard = await tx.actionCard.findFirst({
    where: {
      businessId,
      type: 'CARD_TYPE',
      status: { in: ['PENDING', 'SNOOZED', 'APPROVED'] },
      // ... existing dedup fields (customerId, staffId, metadata path, etc.)
    },
  });
  return !!existingCard;
}, { isolationLevel: 'Serializable' });

if (isDuplicate) continue;
await this.actionCardService.create({ ... }); // Preserves socket emits and other side effects
cardsCreated++;
```

Apply the status filter expansion to all 5 agents:
- `waitlist-agent.service.ts` (lines 82–95)
- `retention-agent.service.ts` (lines 85–94) — **this is AG-03, most impacted**
- `data-hygiene-agent.service.ts` (~lines 80–100)
- `scheduling-optimizer.service.ts` (lines 82–95)
- `quote-followup-agent.service.ts` (~lines 80–95)

**Prerequisite:** Implement FIX-02 first for full concurrency protection.

**Test:** For each agent, verify the dedup query includes `status: { in: ['PENDING', 'SNOOZED', 'APPROVED'] }`. Test that a SNOOZED card for the same customer prevents duplicate creation.

---

### FIX-10: Fix UTC Timezone Bugs [HIGH]

**Files:**
- `apps/api/src/modules/agent/agents/scheduling-optimizer.service.ts` (line 163)
- `apps/api/src/modules/automation/automation-executor.service.ts` (lines 511–512, 537–538)

**Bug A — Scheduling Optimizer (line 163):** Uses `toISOString().split('T')[0]` which converts to UTC. A business in PST at 10pm local sees tomorrow's date.

**Fix A:** Look up the business timezone and use it for date calculation:

```typescript
// Add at the top of detectGaps(), after loading the business:
const business = await this.prisma.business.findUnique({
  where: { id: businessId },
  select: { timezone: true },
});
const timezone = business?.timezone || 'UTC';

// Replace line 163:
// BEFORE: const dateStr = checkDate.toISOString().split('T')[0];
// AFTER:
const dateStr = checkDate.toLocaleDateString('en-CA', { timeZone: timezone }); // 'en-CA' gives YYYY-MM-DD format
```

**Bug B — Automation frequency cap (lines 511–512 and 537–538):** Uses `new Date().setHours(0,0,0,0)` for day boundary, which is server timezone.

**Fix B:** Use the business timezone (already fetched in processRule on line 71–75):

```typescript
// In executeActions(), accept timezone as a parameter:
private async executeActions(
  rule: any,
  actions: any[],
  businessId: string,
  bookingId?: string,
  customerId?: string,
  timezone: string = 'UTC', // NEW PARAMETER
) {
  // Replace the frequency cap date calculation:
  // BEFORE:
  // const today = new Date();
  // today.setHours(0, 0, 0, 0);
  // AFTER:
  const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const today = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
```

Then pass the timezone from `processRule()` into `executeActions()` calls. The timezone is already being fetched on line 71–75 of processRule(). Also update `evaluateTrigger()` (line 726) to pass the timezone it already fetches at lines 702–706 into its `executeActions()` call.

**Test:** Test that a business with timezone 'America/Los_Angeles' at 11pm local (which is next day UTC) still shows today's date for gap detection. Test frequency cap resets at local midnight, not UTC.

---

## Sprint 3 — High/Medium Fixes (Week 3)

### FIX-11: Optimize DataHygiene O(n²) Algorithm [HIGH]

**File:** `apps/api/src/modules/agent/agents/data-hygiene-agent.service.ts`
**Lines:** 162–170

**Bug:** Nested loop comparing every customer pair. For 1000 customers = 499,500 comparisons.

**Fix:** Pre-filter by phone normalization before doing expensive name comparisons:

```typescript
private async findDuplicates(businessId: string, batchSize: number): Promise<DuplicatePair[]> {
  const customers = await this.prisma.customer.findMany({
    where: { businessId, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  const duplicates: DuplicatePair[] = [];

  // Phase 1: Group by normalized phone (O(n) instead of O(n²) for phone matches)
  const phoneGroups = new Map<string, typeof customers>();
  for (const c of customers) {
    if (c.phone) {
      const normalizedPhone = this.normalizePhone(c.phone);
      const group = phoneGroups.get(normalizedPhone) || [];
      group.push(c);
      phoneGroups.set(normalizedPhone, group);
    }
  }

  // Compare within phone groups (typically 2-3 per group, not n²)
  for (const group of phoneGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const match = this.compareCustomers(group[i], group[j]);
        if (match) duplicates.push(match);
      }
    }
  }

  // Phase 2: Email-based grouping for customers without phone matches
  const emailGroups = new Map<string, typeof customers>();
  const alreadyMatched = new Set(duplicates.flatMap((d) => [d.customer1.id, d.customer2.id]));
  for (const c of customers) {
    if (c.email && !alreadyMatched.has(c.id)) {
      const normalizedEmail = c.email.toLowerCase();
      const group = emailGroups.get(normalizedEmail) || [];
      group.push(c);
      emailGroups.set(normalizedEmail, group);
    }
  }

  for (const group of emailGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const match = this.compareCustomers(group[i], group[j]);
        if (match) duplicates.push(match);
      }
    }
  }

  duplicates.sort((a, b) => b.confidence - a.confidence);
  return duplicates;
}
```

This reduces the typical case from O(n²) to O(n) by only comparing customers that share a phone or email.

**Test:** Test with 100 customers where 5 share a phone number. Verify those 5 are correctly identified as potential duplicates without comparing all 4,950 pairs.

---

### FIX-12: Fix App Crash on AI Hub Mode Switch [HIGH]

**Bug:** Reported by the other QA session — app crashes or shows blank screen when switching between AI Hub tabs/modes.

**Context:** This is a frontend issue in `apps/web/`. The AI Hub pages are in `apps/web/src/app/(protected)/ai/`. Mode switching is controlled by `mode-config.ts` and `nav-config.ts`. The app uses client-side state with `useState`/`useEffect` hooks.

**Investigation steps:**
1. Read `apps/web/src/app/(protected)/ai/` layout and page files
2. Check if there's shared state that's not properly cleaned up on unmount
3. Look for `useEffect` cleanup functions that might be missing
4. Check if socket event listeners are being added without cleanup on tab switch
5. Look for race conditions in data fetching when switching tabs quickly (stale closures)

**Common fix pattern:** Ensure all `useEffect` hooks return cleanup functions, add abort controllers to fetch calls, and wrap state updates in `if (!aborted)` checks.

**Test:** Add E2E test in `apps/web/e2e/` that rapidly switches between AI Hub tabs and verifies no blank screen.

---

### FIX-13: Enhanced Template Engine [MEDIUM]

**File:** `apps/api/src/modules/automation/automation-executor.service.ts`
**Lines:** 810–812

**Bug:** `renderTemplate()` regex `/\{\{(\w+)\}\}/g` only matches word characters. Cannot do `{{customer.name}}`.

**Fix:**

```typescript
private renderTemplate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    // Support dot notation: {{customer.name}} resolves vars.customer.name
    const value = path.split('.').reduce((obj: any, key: string) => {
      return obj != null ? obj[key] : undefined;
    }, vars);
    return value != null ? String(value) : '';
  });
}
```

**Test:** Test `{{name}}` (simple), `{{customer.name}}` (nested), `{{a.b.c}}` (deep), `{{missing}}` (returns ''), `{{customer.missing}}` (returns '').

---

### FIX-14: Scheduling Optimizer Lunch/Break Awareness [MEDIUM]

**File:** `apps/api/src/modules/agent/agents/scheduling-optimizer.service.ts`

**Bug:** Gap detection only checks workingHours, timeOff, and bookings. Doesn't account for lunch breaks or blocked time.

**Fix:** In the `getDaySchedule()` method (line 184), after fetching bookings, also query for any blocked time or breaks:

```typescript
// After fetching bookings for the day, also check for break entries
// (if your schema has a staff break or blocked-time model, query it here)
// Then add break slots to the bookings array before gap detection:
const breaks = await this.prisma.staffBreak?.findMany?.({
  where: { staffId, dayOfWeek },
}) || [];

// Add breaks as "virtual bookings" that block the time slots
for (const brk of breaks) {
  bookings.push({
    startTime: new Date(`${dateStr}T${brk.startTime}`),
    endTime: new Date(`${dateStr}T${brk.endTime}`),
    // Mark as break so it's not counted as a booking
  });
}
```

**Note:** Check if a StaffBreak or BlockedTime model exists in the Prisma schema. If not, this may require a schema addition or a convention of using a specific booking status/type for breaks.

---

## Sprint 4 — Medium/Low Fixes (Week 4)

### FIX-15: Accessibility Fixes for AI Hub [MEDIUM]

**Files:**
- `apps/web/src/components/action-card/action-card-list.tsx`
- `apps/web/src/components/action-card/action-card.tsx`
- `apps/web/src/app/(protected)/ai/agents/page.tsx`
- `apps/web/src/app/(protected)/ai/automations/page.tsx`

**Fixes needed:**

1. **Filter buttons** — Add `aria-label` to each category filter chip:
   ```tsx
   <button aria-label={`Filter by ${category} cards`} ...>
   ```

2. **View toggle** — Add `role="radiogroup"` and `aria-label`:
   ```tsx
   <div role="radiogroup" aria-label="View mode">
     <button role="radio" aria-checked={view === 'list'} aria-label="List view" ...>
     <button role="radio" aria-checked={view === 'kanban'} aria-label="Kanban view" ...>
   </div>
   ```

3. **CTA buttons** — Add contextual `aria-label`:
   ```tsx
   <button aria-label={`Send follow-up to ${customerName}`} ...>
   ```

4. **Card list keyboard navigation** — Import and use `useListNavigation` from `apps/web/src/lib/use-keyboard-shortcut.ts` for J/K navigation through cards.

5. **Outcome indicators** — Add icons alongside color in automation activity log:
   ```tsx
   {outcome === 'SENT' && '✓ '}{outcome === 'SKIPPED' && '⏭ '}{outcome === 'FAILED' && '✗ '}
   ```

**Test:** Run axe-core accessibility checks in the E2E tests (already configured via `@axe-core/playwright` in the project).

---

### FIX-16: Agent Run Error Details [MEDIUM]

**File:** `apps/web/src/app/(protected)/ai/agents/page.tsx`

**Bug:** Failed runs only show a status icon. The `agentRun.error` field contains the error message but it's not displayed.

**Fix:** Add an expandable error detail section in the run history list:

```tsx
{run.status === 'FAILED' && run.error && (
  <div className="mt-2 bg-red-50 rounded-xl p-3 text-sm text-red-700">
    <span className="font-medium">Error: </span>{run.error}
  </div>
)}
```

**Test:** Render a failed run with an error message, assert the error text is visible.

---

### FIX-17: Automation Step Progress Display [MEDIUM]

**File:** `apps/web/src/app/(protected)/ai/automations/page.tsx` (Activity Log section)

**Bug:** Multi-step workflow outcomes only show final status, not per-step progress.

**Fix:** When displaying an activity log entry for a multi-step rule, query for the execution's step history and show a step progress indicator:

```tsx
{execution.steps && execution.steps.length > 1 && (
  <div className="flex items-center gap-1 mt-1">
    {execution.steps.map((step, i) => (
      <div key={i} className={`w-2 h-2 rounded-full ${
        step.status === 'COMPLETED' ? 'bg-sage-500' :
        step.status === 'FAILED' ? 'bg-red-500' :
        step.status === 'WAITING' ? 'bg-amber-400' : 'bg-slate-200'
      }`} title={`Step ${i+1}: ${step.type} — ${step.status}`} />
    ))}
  </div>
)}
```

**Backend:** Add step execution details to the automation log API response. Either embed in the automationLog record or add a separate endpoint to fetch step details for an execution.

---

### FIX-18: UI Warning for Unimplemented Triggers/Actions [MEDIUM]

**File:** `apps/web/src/app/(protected)/ai/automations/page.tsx` (rule creation/edit form)

**Fix:** Add a validation layer that warns users when selecting unimplemented triggers or actions:

```typescript
const UNIMPLEMENTED_TRIGGERS = ['MESSAGE_RECEIVED', 'CUSTOMER_CREATED', 'PAYMENT_RECEIVED'];
// Remove triggers from this list as they get implemented (FIX-03)

const UNIMPLEMENTED_ACTIONS = ['SEND_TEMPLATE', 'ASSIGN_STAFF', 'SEND_NOTIFICATION'];
// Remove actions from this list as they get implemented (FIX-04)
```

Show an amber warning banner when selected:

```tsx
{UNIMPLEMENTED_TRIGGERS.includes(selectedTrigger) && (
  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
    This trigger is not yet active. Rules using it will not fire until it's implemented.
  </div>
)}
```

**Note:** Once FIX-03 and FIX-04 are deployed, remove the corresponding entries from these arrays.

---

### FIX-19: Agent Card Rate Limiting [MEDIUM]

**File:** `apps/api/src/modules/agent/agent-framework.service.ts`

**Bug:** No global cap on cards created per business per day. Repeated agent triggers can flood the inbox.

**Fix:** Add a daily card check before executing the agent:

```typescript
async triggerAgent(businessId: string, agentType: string) {
  // ... existing validation ...

  // Check daily card cap (configurable per-agent, default 50)
  const agentConfig = config.config as any;
  const dailyCap = agentConfig?.dailyCardCap || 50;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Map agentType to the card type it creates (these don't always share a prefix)
  const AGENT_CARD_TYPE_MAP: Record<string, string> = {
    WAITLIST: 'WAITLIST_MATCH',
    RETENTION: 'RETENTION_DUE',
    DATA_HYGIENE: 'DUPLICATE_CUSTOMER',
    SCHEDULING_OPTIMIZER: 'SCHEDULE_GAP',
    QUOTE_FOLLOWUP: 'QUOTE_FOLLOWUP',
  };
  const cardType = AGENT_CARD_TYPE_MAP[agentType];

  const todayCardCount = await this.prisma.actionCard.count({
    where: {
      businessId,
      ...(cardType ? { type: cardType } : { type: { startsWith: agentType } }),
      createdAt: { gte: todayStart },
    },
  });

  if (todayCardCount >= dailyCap) {
    this.logger.warn(`Agent ${agentType} daily cap (${dailyCap}) reached for business ${businessId}`);
    throw new BadRequestException(`Daily card limit reached for ${agentType}`);
  }

  // ... proceed with existing lock + execution logic ...
}
```

---

## Backlog

### FIX-20: Batch Card Dismiss/Snooze [LOW]
Use the existing `BulkActionBar` component. Add multi-select checkboxes to action cards and a bulk action bar with "Dismiss Selected" and "Snooze Selected" buttons. Add a `PATCH /action-cards/bulk` API endpoint.

### FIX-21: Config Save Feedback [LOW]
Add success/error toasts when saving agent configuration. Use a simple `useState`-based toast pattern (the project doesn't use a toast library).

### FIX-22: Expired Card Visual Distinction [LOW]
In `action-card.tsx`, check if `card.expiresAt < new Date()` and add `opacity-50` class plus an "Expired" badge. Optionally auto-archive expired cards via a cron job.

### FIX-23: Activity Log Export [LOW]
Add a "Download CSV" button to the automation activity log. Generate CSV client-side from the displayed data using Papaparse.

### FIX-24: Make Agent Thresholds Configurable [LOW]
For DataHygieneAgent's Levenshtein threshold (line 236), read from `agentConfig.config.similarityThreshold` instead of hardcoded 0.8. Default to 0.8 if not set. Similarly, make WaitlistAgent's 48-hour expiry configurable.

---

## Implementation Order Summary

| Order | Fix IDs | What | Effort |
|-------|---------|------|--------|
| 1 | FIX-01 | DELAY infinite loop | 0.5 day |
| 2 | FIX-02 | Distributed locking (agent + automation) | 1.5 days |
| 3 | FIX-03 | Wire 3 missing triggers | 1.5 days |
| 4 | FIX-04 | Implement 3 missing actions | 1.5 days |
| 5 | FIX-05, FIX-06 | check_waitlist + merge CTA handlers | 2 days |
| 6 | FIX-07 | Unify step/direct action execution | 1 day |
| 7 | FIX-08 | Advanced filter operators | 1.5 days |
| 8 | FIX-09 | Agent dedup race conditions | 1 day |
| 9 | FIX-10 | UTC timezone fixes | 1 day |
| 10 | FIX-11 | DataHygiene O(n²) optimization | 1 day |
| 11 | FIX-12 | App crash on mode switch | 1–2 days |
| 12 | FIX-13 to FIX-19 | Template, accessibility, UX | 4 days |
| 13 | FIX-20 to FIX-24 | Backlog polish | 3 days |

**Total estimated effort: ~20 developer-days**

---

## Reminders for Claude Code

- Follow the Self-Validation Protocol from CLAUDE.md after every fix
- Run `npm run format && npm run format:check && npm run lint && npm test` before committing
- Update CLAUDE.md if you add new models, enums, socket events, or queues
- Every fix MUST include tests — controller specs, service specs, or E2E
- Use design tokens from `apps/web/src/lib/design-tokens.ts` for any new status colors
- Add translation keys to both `locales/en.json` and `locales/es.json` for new UI text
- Use the existing skeleton components (ListSkeleton, etc.) for loading states
- Never remove the API client token refresh logic in `apps/web/src/lib/api.ts`
