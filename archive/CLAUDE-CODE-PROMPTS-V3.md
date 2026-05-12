# Claude Code Prompts — Campaigns, Automations & Testimonials

> Copy-paste each prompt into Claude Code. Prompts are ordered by dependency and priority.
> Each prompt is self-contained with file paths, line numbers, and acceptance criteria.

---

## PHASE 0: BUG FIXES (Do These First)

---

### BUG-01: Fix lastVisitDaysAgo Campaign Audience Filter

```
Fix a logic bug in the campaign audience filter in `apps/api/src/modules/campaign/campaign.service.ts`.

**The bug (around lines 205-216):**
The `lastVisitDaysAgo` filter in `buildAudienceWhere()` uses Prisma's `every` operator, which means "ALL bookings must be before the cutoff date." This is wrong — a customer who visited on day 5 AND day 100 would fail the filter even if their most recent visit was 100 days ago, because the day-5 booking doesn't satisfy `startTime: { lt: cutoff }` when cutoff is e.g. 30 days ago.

**The fix:**
Change `every` to `none` with inverted date logic:
```typescript
// BEFORE (buggy):
where.bookings = {
  ...where.bookings,
  every: {
    ...(where.bookings?.every || {}),
    startTime: { lt: cutoff },
  },
};

// AFTER (correct):
where.bookings = {
  ...where.bookings,
  none: {
    startTime: { gte: cutoff },
  },
};
```

This means "no bookings exist after the cutoff" = customer hasn't visited in N days.

**Tests:**
Update or add tests in `campaign.service.spec.ts` to verify:
1. Customer with only old bookings (90 days ago) IS included when filter is 30 days
2. Customer with a recent booking (5 days ago) IS excluded when filter is 30 days
3. Customer with bookings at both 5 days and 90 days ago IS excluded when filter is 30 days (the bug case)
4. Customer with no bookings IS included

**Acceptance criteria:**
- Filter logic uses `none: { startTime: { gte: cutoff } }` instead of `every: { startTime: { lt: cutoff } }`
- Tests pass and cover the edge case that was previously broken
- No other audience filters are affected
```

---

### BUG-02: Fix Quiet Hours Timezone — Use Business Timezone

```
Fix a timezone bug in `apps/api/src/modules/automation/automation-executor.service.ts`.

**The bug (around lines 521-535):**
The `isQuietHours()` method uses `new Date().getHours()` which returns hours in UTC (the server timezone on Railway). This means a business in PST (UTC-8) that sets quiet hours 10pm-8am actually gets quiet hours evaluated at 10pm-8am UTC, which is 2pm-12am PST — completely wrong.

**The Business model already has a `timezone` field** (schema.prisma line 15): `timezone String @default("UTC")`.

**The fix:**
1. Change the `isQuietHours()` method signature to accept a timezone parameter
2. Use `Intl.DateTimeFormat` or manual UTC offset to convert current time to business local time before comparison
3. Update all callers of `isQuietHours()` to pass the business timezone

Here's the approach:
```typescript
isQuietHours(quietStart?: string | null, quietEnd?: string | null, timezone: string = 'UTC'): boolean {
  if (!quietStart || !quietEnd) return false;

  // Convert current UTC time to business local time
  const now = new Date();
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const currentMinutes = localTime.getHours() * 60 + localTime.getMinutes();

  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
```

4. In the execution methods that call `isQuietHours()`, fetch the business timezone:
```typescript
const business = await this.prisma.business.findUnique({
  where: { id: rule.businessId },
  select: { timezone: true },
});
const inQuietHours = this.isQuietHours(rule.quietStart, rule.quietEnd, business?.timezone || 'UTC');
```

**Tests:**
Add tests in `automation-executor.service.spec.ts`:
1. UTC business: quiet hours 22:00-08:00 — verify correct at UTC boundaries
2. America/New_York business: verify hours are offset correctly from UTC
3. Overnight quiet hours spanning midnight work correctly with timezone
4. Missing timezone defaults to UTC

**Acceptance criteria:**
- `isQuietHours()` accepts timezone parameter
- Business timezone is fetched and passed to quiet hours check
- Tests cover multiple timezones and overnight windows
- Default to UTC when timezone is missing
```

---

### BUG-03: Fix Hardcoded Quiet Hours Display

```
Fix hardcoded quiet hours display in `apps/web/src/app/(protected)/automations/page.tsx`.

**The bug (around line 215):**
The "Safety Controls" summary banner shows:
```tsx
Active (10pm–8am)
```
This is hardcoded and doesn't reflect the actual quiet hours from the database.

**The fix:**
1. Fetch the business automation settings or use the actual quiet hours values from the loaded rules
2. Replace the hardcoded string with dynamic values

Find the Safety Controls banner section and update it. If quiet hours come from the rules data, compute the display from the first active rule's quietStart/quietEnd. If quiet hours are a global business setting, fetch them from the API.

Note: Around line 297-299, individual rules already show dynamic quiet hours correctly:
```tsx
{rule.quietStart && rule.quietEnd ? (
  <span>Quiet {rule.quietStart}–{rule.quietEnd}</span>
) : null}
```

Use the same pattern for the summary banner. Format the times in a user-friendly way (e.g., "10:00 PM" instead of "22:00") using `Intl.DateTimeFormat` or a simple helper.

**Acceptance criteria:**
- Safety Controls banner shows actual quiet hours from data, not hardcoded "10pm–8am"
- If no rules have quiet hours set, show "Not configured" instead
- Individual rule rows continue to show their own quiet hours correctly
- Format times in 12-hour format for readability (e.g., "10:00 PM – 8:00 AM")
```

---

### BUG-04: Fix Frequency Cap to Exclude Failed Sends

```
Fix the per-rule frequency cap in `apps/api/src/modules/automation/automation-executor.service.ts`.

**The bug (around lines 434-440):**
The per-rule frequency cap counts ALL automation log entries regardless of outcome:
```typescript
const todayCount = await this.prisma.automationLog.count({
  where: {
    automationRuleId: rule.id,
    customerId,
    createdAt: { gte: today },
  },
});
```

This means if a message FAILED or was SKIPPED due to quiet hours, it still counts toward the customer's daily cap. A customer could receive 0 actual messages but hit their cap of 3 because 3 attempts failed.

**Note:** The global cap (around lines 459-465) correctly filters by `outcome: 'SENT'`.

**The fix:**
Add `outcome: 'SENT'` filter to the per-rule cap query:
```typescript
const todayCount = await this.prisma.automationLog.count({
  where: {
    automationRuleId: rule.id,
    customerId,
    outcome: 'SENT',
    createdAt: { gte: today },
  },
});
```

**Tests:**
Update tests in `automation-executor.service.spec.ts`:
1. Customer with 3 FAILED logs today — should NOT be capped (can still receive messages)
2. Customer with 2 SENT + 1 FAILED — cap at 3 should show 2/3 used
3. Customer with 3 SENT — should be capped
4. SKIPPED outcomes should not count toward cap

**Acceptance criteria:**
- Per-rule cap only counts SENT outcomes
- Consistent with global cap behavior (which already filters by SENT)
- Tests cover FAILED and SKIPPED exclusion
```

---

### BUG-05: Fix Duplicate Records in Seed Script

```
Fix the duplicate records bug in `packages/db/src/seed-demo.ts` and add schema-level protection.

**The bug:**
When the idempotency guard (around lines 70-74) doesn't block re-runs, campaigns and automation rules are created as duplicates because `.create()` is used instead of `.upsert()`.

**The fix has 3 parts:**

**Part 1: Fix seed-demo.ts (packages/db/src/seed-demo.ts)**

Replace all `prisma.campaign.create()` calls (around lines 1257-1326) with upsert-style logic:
```typescript
const campaign1 = await prisma.campaign.upsert({
  where: {
    businessId_name: {
      businessId: glowId,
      name: 'February Glow-Up Special',
    },
  },
  update: {},  // Don't overwrite if exists
  create: {
    businessId: glowId,
    name: 'February Glow-Up Special',
    // ... rest of fields
  },
});
```

Do the same for all automation rule `.create()` calls (around lines 1329-1437):
```typescript
const rule1 = await prisma.automationRule.upsert({
  where: {
    businessId_name: {
      businessId: glowId,
      name: '24h Appointment Reminder',
    },
  },
  update: {},
  create: { /* ... */ },
});
```

**Part 2: Add unique constraints to Prisma schema (packages/db/prisma/schema.prisma)**

Add `@@unique` constraints to both models:
```prisma
model Campaign {
  // ... existing fields ...
  @@unique([businessId, name])
  @@index([businessId, createdAt])
  @@map("campaigns")
}

model AutomationRule {
  // ... existing fields ...
  @@unique([businessId, name])
  @@index([businessId])
  @@map("automation_rules")
}
```

**Part 3: Create a migration**
Run: `npx prisma migrate dev --name add_unique_campaign_automation_names --schema=packages/db/prisma/schema.prisma`

Note: If there are existing duplicates in the database, you'll need to delete them first. Create a one-time cleanup script or add the following before migration:
```sql
-- Delete duplicate campaigns, keeping the most recent
DELETE FROM campaigns a USING campaigns b
WHERE a.id < b.id AND a."businessId" = b."businessId" AND a.name = b.name;

-- Delete duplicate automation rules, keeping the most recent
DELETE FROM automation_rules a USING automation_rules b
WHERE a.id < b.id AND a."businessId" = b."businessId" AND a.name = b.name;
```

**Part 4: Add duplicate-name validation in API create endpoints**

In `apps/api/src/modules/campaign/campaign.service.ts`, in the create method, add:
```typescript
const existing = await this.prisma.campaign.findFirst({
  where: { businessId, name: dto.name },
});
if (existing) {
  throw new BadRequestException(`A campaign named "${dto.name}" already exists`);
}
```

Similarly in `apps/api/src/modules/automation/automation.service.ts` createRule method.

**Acceptance criteria:**
- Seed script uses upsert instead of create for campaigns and rules
- Prisma schema has @@unique([businessId, name]) on both models
- Migration is generated and applies cleanly
- API create endpoints validate for duplicate names with clear error messages
- Running seed-demo.ts multiple times does not create duplicates
```

---

### BUG-06: Wire Campaign Dispatch to Messaging Providers

```
Wire the campaign dispatch service to actually send messages through the omnichannel messaging infrastructure.

**Current state:**
`apps/api/src/modules/campaign/campaign-dispatch.service.ts` (around lines 56-69) marks CampaignSend records as SENT with a comment "actual delivery would be via notification service" but never calls any messaging provider.

**What exists that we can use:**
- `MessageService` at `apps/api/src/modules/message/message.service.ts` — handles sending via all channels
- `NotificationService` — handles notification delivery
- `CircuitBreakerService` at `apps/api/src/common/circuit-breaker/` — wraps provider calls with circuit breaker pattern
- `UsageService` at `apps/api/src/modules/usage/` — tracks per-channel message counts for billing
- `DeadLetterQueueService` at `apps/api/src/common/queue/dead-letter.service.ts` — captures failed messages
- Customer model has `phone`, `email` fields for routing
- `Business.channelSettings` JSON stores enabled channels and default reply channel

**The implementation:**

1. **Add `channel` field to CampaignSend model** in `packages/db/prisma/schema.prisma`:
```prisma
model CampaignSend {
  // ... existing fields ...
  channel      String?   // WHATSAPP, SMS, EMAIL, etc.
}
```

2. **Update campaign-dispatch.service.ts:**
- Inject `MessageService`, `CircuitBreakerService`, `UsageService`
- For each CampaignSend, determine the best channel for the customer (check customer.phone for WhatsApp/SMS, customer.email for Email, respect Business.channelSettings)
- Call the appropriate messaging provider through CircuitBreakerService
- On success: mark CampaignSend as SENT with channel
- On failure: mark as FAILED, capture to DLQ with context
- Record usage via UsageService

3. **Add campaign channel selection to Campaign model** — store the intended channel(s) on the campaign itself:
```prisma
model Campaign {
  // ... existing fields ...
  channel      String?   @default("WHATSAPP")  // Primary send channel
}
```

4. **Update the dispatch loop:**
```typescript
for (const send of pendingSends) {
  try {
    const customer = send.customer;
    const channel = campaign.channel || 'WHATSAPP';

    // Resolve recipient address
    const address = this.resolveAddress(customer, channel);
    if (!address) {
      await this.markFailed(send.id, 'No contact info for channel');
      continue;
    }

    // Send via circuit breaker
    await this.circuitBreaker.exec(`campaign-${channel}`, async () => {
      await this.messageService.sendOutbound({
        businessId: campaign.businessId,
        customerId: customer.id,
        channel,
        content: this.renderMessage(campaign, send, customer),
        source: 'CAMPAIGN',
      });
    });

    await this.prisma.campaignSend.update({
      where: { id: send.id },
      data: { status: 'SENT', sentAt: new Date(), channel },
    });

    // Track usage
    await this.usageService.recordOutbound(campaign.businessId, channel);
  } catch (err) {
    await this.prisma.campaignSend.update({
      where: { id: send.id },
      data: { status: 'FAILED', channel: campaign.channel },
    });
    await this.dlqService.capture('campaign', send.id, err);
  }
}
```

5. **Create the migration** for the new fields.

**Tests:**
Add tests in `campaign-dispatch.service.spec.ts`:
1. Successful send marks CampaignSend as SENT with channel
2. Failed send marks as FAILED and captures to DLQ
3. Customer without phone gets FAILED status with clear reason
4. Circuit breaker open state is handled gracefully
5. Usage is recorded on successful send

**Acceptance criteria:**
- Campaign dispatch actually sends messages through MessageService
- Channel field tracked on CampaignSend for per-channel analytics
- Failures captured to DLQ with retry capability
- Usage recorded for billing
- Circuit breaker protects against provider outages
- All existing campaign tests still pass
```

---

### BUG-07: Wire Automation SEND_MESSAGE to Messaging

```
Wire the automation SEND_MESSAGE action to actually send messages through the messaging infrastructure.

**Current state:**
`apps/api/src/modules/automation/automation-executor.service.ts` — the `executeStepAction()` method (around lines 328-365) handles UPDATE_STATUS and ADD_TAG actions but has no implementation for SEND_MESSAGE. Around line 483 there's a comment: "For now, log the action; real implementation would call notification service."

**What exists that we can use:**
- Same services as BUG-06 (MessageService, CircuitBreakerService, UsageService, DLQ)
- `Conversation` model for routing messages through existing conversation threads
- `CustomerIdentityService` for resolving customer channels
- AutomationRule has `actions` JSON field with message templates

**The implementation:**

1. In `executeStepAction()`, add SEND_MESSAGE handling:
```typescript
if (actionType === 'SEND_MESSAGE' && config.message) {
  const customer = await this.prisma.customer.findUnique({
    where: { id: execution.customerId },
    select: { id: true, phone: true, email: true, businessId: true },
  });

  if (!customer) {
    this.logger.warn(`Customer ${execution.customerId} not found for automation send`);
    return;
  }

  // Determine channel — use customer's last inbound channel or default
  const channel = config.channel || await this.resolveChannel(customer);

  // Render message template
  const renderedMessage = this.renderTemplate(config.message, {
    name: customer.name,
    // ... other variables
  });

  // Find or create conversation
  const conversation = await this.findOrCreateConversation(customer, channel);

  // Send via MessageService
  await this.messageService.sendOutbound({
    businessId: customer.businessId,
    conversationId: conversation.id,
    customerId: customer.id,
    channel,
    content: renderedMessage,
    source: 'AUTOMATION',
  });

  // Record usage
  await this.usageService.recordOutbound(customer.businessId, channel);
}
```

2. Add helper method `resolveChannel()`:
```typescript
private async resolveChannel(customer: { phone: string | null; email: string | null; businessId: string }): Promise<string> {
  // Check business default channel
  const business = await this.prisma.business.findUnique({
    where: { id: customer.businessId },
    select: { channelSettings: true },
  });
  const settings = business?.channelSettings as any;
  if (settings?.defaultReplyChannel) return settings.defaultReplyChannel;

  // Fallback to available channel
  if (customer.phone) return 'WHATSAPP';
  if (customer.email) return 'EMAIL';
  return 'WHATSAPP';
}
```

3. Add helper method `renderTemplate()` for variable substitution ({{name}}, etc.)

4. Wire dependencies: inject MessageService, UsageService, CustomerIdentityService into AutomationExecutorService

**Also add quiet-hours rescheduling:**
Instead of just logging SKIPPED when quiet hours block a send, create a delayed BullMQ job:
```typescript
if (this.isQuietHours(rule.quietStart, rule.quietEnd, business.timezone)) {
  // Calculate next quiet hours end
  const retryAt = this.getNextQuietEnd(rule.quietEnd, business.timezone);
  await this.agentQueue.add('automation-retry', {
    executionId: execution.id,
    ruleId: rule.id,
  }, { delay: retryAt.getTime() - Date.now() });

  await this.logExecution(rule.id, 'RESCHEDULED', `Quiet hours — will retry at ${retryAt.toISOString()}`);
  return;
}
```

**Tests:**
Add tests in `automation-executor.service.spec.ts`:
1. SEND_MESSAGE action calls MessageService with correct parameters
2. Missing customer phone/email falls back to available channel
3. Message template variables are rendered correctly
4. Failed send is logged as FAILED with error details
5. Quiet hours rescheduling creates delayed job

**Acceptance criteria:**
- SEND_MESSAGE action type sends actual messages through MessageService
- Channel resolved from customer data and business settings
- Quiet-hour blocked messages are rescheduled, not dropped
- Usage tracked for billing
- All existing automation tests still pass
```

---

### BUG-08: Set Testimonial submittedAt Field

```
Fix the unused `submittedAt` field on the Testimonial model in `apps/api/src/modules/testimonials/testimonials.service.ts`.

**The bug:**
The Testimonial Prisma model has `submittedAt DateTime?` but no code path ever sets this field. `requestedAt` is set when a request is sent, but the corresponding submission timestamp is never recorded.

**The fix:**
1. In `testimonials.service.ts`, update the `create()` method to set `submittedAt: new Date()` when creating a testimonial manually:
```typescript
async create(businessId: string, dto: CreateTestimonialDto) {
  return this.prisma.testimonial.create({
    data: {
      ...dto,
      businessId,
      source: 'MANUAL',
      submittedAt: new Date(),  // Add this
    },
  });
}
```

2. When the customer self-submission portal is built later, the `update()` or a new `submit()` method should also set `submittedAt`.

3. For now, also set it in the `update()` method when content changes on a REQUESTED testimonial that didn't previously have content (i.e., staff fills in the testimonial on behalf of customer):
```typescript
async update(businessId: string, id: string, dto: UpdateTestimonialDto) {
  const existing = await this.prisma.testimonial.findFirst({
    where: { id, businessId },
  });
  if (!existing) throw new NotFoundException();

  const data: any = { ...dto };
  // Set submittedAt if this is the first time content is being provided
  if (dto.content && !existing.submittedAt) {
    data.submittedAt = new Date();
  }

  return this.prisma.testimonial.update({
    where: { id },
    data,
  });
}
```

**Tests:**
Update `testimonials.service.spec.ts`:
1. `create()` sets submittedAt to current timestamp
2. `update()` with content on REQUESTED testimonial sets submittedAt
3. `update()` on already-submitted testimonial doesn't overwrite submittedAt

**Acceptance criteria:**
- Manual testimonial creation sets submittedAt
- Content updates on REQUESTED testimonials set submittedAt on first submission
- Existing submittedAt is not overwritten on subsequent edits
- Tests verify all scenarios
```

---

## PHASE 1: HIGH-IMPACT IMPROVEMENTS

---

### HIGH-01: Campaign Message Templates with Merge Variables

```
Add merge variable support ({{name}}, {{service}}, {{date}}, {{business}}) to campaign messages.

**Important context on how campaigns store messages:**
The Campaign model has NO standalone `message` field. Messages are stored in the `variants` JSON array (schema.prisma line 727: `variants Json @default("[]")`). Each variant has `{ id, name, content, percentage }` — the `content` field holds the message text. The `validateVariants()` method in campaign.service.ts (line 346) validates this structure. Even non-A/B campaigns use variants (a single variant with 100%).

**Files to modify:**
- `apps/api/src/modules/campaign/campaign.service.ts` — add template rendering method
- `apps/api/src/modules/campaign/campaign-dispatch.service.ts` — render templates at send time (variant.content, not campaign.message)
- `apps/web/src/app/(protected)/campaigns/new/page.tsx` — add variable picker/helper in message step

**Backend implementation:**

1. Add a `renderTemplate()` method to CampaignService or a new `TemplateService`:
```typescript
renderTemplate(template: string, context: {
  customerName?: string;
  serviceName?: string;
  businessName?: string;
  nextBookingDate?: string;
  staffName?: string;
}): string {
  return template
    .replace(/\{\{name\}\}/gi, context.customerName || 'there')
    .replace(/\{\{service\}\}/gi, context.serviceName || 'your service')
    .replace(/\{\{business\}\}/gi, context.businessName || 'us')
    .replace(/\{\{date\}\}/gi, context.nextBookingDate || '')
    .replace(/\{\{staff\}\}/gi, context.staffName || 'our team');
}
```

2. In campaign-dispatch.service.ts, before sending each message, resolve the variant and render its `content` field with customer data:
```typescript
const customer = send.customer;
// Resolve the variant for this send (from CampaignSend.variantId or campaign.variants)
const variants = campaign.variants as any[];
const variant = send.variantId
  ? variants.find((v: any) => v.id === send.variantId)
  : variants[0];
const messageContent = variant?.content || '';

const lastBooking = await this.prisma.booking.findFirst({
  where: { customerId: customer.id },
  orderBy: { startTime: 'desc' },
  include: { service: true },
});
const rendered = this.renderTemplate(messageContent, {
  customerName: customer.name,
  serviceName: lastBooking?.service?.name,
  businessName: business.name,
  nextBookingDate: lastBooking?.startTime?.toLocaleDateString(),
});
```

**Frontend implementation:**

3. In the campaign message composer step (where variant content is edited), add a "Insert Variable" dropdown button:
```tsx
const MERGE_VARIABLES = [
  { label: 'Customer Name', value: '{{name}}' },
  { label: 'Service Name', value: '{{service}}' },
  { label: 'Business Name', value: '{{business}}' },
  { label: 'Next Booking Date', value: '{{date}}' },
  { label: 'Staff Name', value: '{{staff}}' },
];
```

4. Show a preview with sample data below each variant's content input (e.g., "Preview: Hi Sarah, your next appointment at Glow Aesthetic Clinic is coming up!")

5. Highlight merge variables in the input with a different color (e.g., lavender background on `{{name}}`)

**Tests:**
1. Template with all variables renders correctly
2. Missing customer data falls back to defaults ("there", "your service", "us")
3. Template with no variables returns unchanged string
4. Frontend variable picker inserts at cursor position in variant content

**Acceptance criteria:**
- Variant content fields support {{name}}, {{service}}, {{business}}, {{date}}, {{staff}} merge tags
- Variables rendered at send time with real customer data
- Missing data gracefully falls back to sensible defaults
- Frontend has variable picker dropdown and live preview per variant
- Both A/B variants support merge variables independently
```

---

### HIGH-02: Campaign Channel Selection & Per-Channel Analytics

```
Add channel selection to campaign creation and per-channel delivery analytics.

**Files to modify:**
- `packages/db/prisma/schema.prisma` — add channel field to Campaign and CampaignSend
- `apps/api/src/modules/campaign/campaign.service.ts` — add channel-specific stats
- `apps/api/src/modules/campaign/dto/create-campaign.dto.ts` — add channel field
- `apps/web/src/app/(protected)/campaigns/new/page.tsx` — add channel picker in wizard
- `apps/web/src/app/(protected)/campaigns/[id]/page.tsx` — add channel breakdown in stats

**Schema changes:**
```prisma
model Campaign {
  // ... existing fields ...
  channel         String?   @default("WHATSAPP")  // Primary channel: WHATSAPP, SMS, EMAIL, MULTI
}

model CampaignSend {
  // ... existing fields ...
  channel         String?   // Actual channel used for this send
}
```

**Backend:**
1. Add `channel` to CreateCampaignDto with validation:
```typescript
@IsOptional()
@IsIn(['WHATSAPP', 'SMS', 'EMAIL', 'MULTI'])
channel?: string;
```

2. Add channel-breakdown stats endpoint or extend existing stats:
```typescript
async getChannelStats(campaignId: string, businessId: string) {
  const channels = await this.prisma.campaignSend.groupBy({
    by: ['channel', 'status'],
    where: { campaignId, campaign: { businessId } },
    _count: true,
  });
  // Transform into { WHATSAPP: { sent: 10, delivered: 8, read: 5, failed: 2 }, ... }
}
```

**Frontend:**
3. In campaign creation wizard (Schedule step), add channel selector:
- Radio buttons or dropdown: WhatsApp, SMS, Email, Multi-channel
- "Multi-channel" sends via customer's preferred/available channel
- Show estimated cost per channel based on audience size and rates

4. In campaign detail page, add channel breakdown section:
- Horizontal bar chart showing delivery funnel per channel
- Table: Channel | Sent | Delivered | Read | Failed | Cost
- Highlight which channel has best delivery/read rate

5. Use design tokens from `CHANNEL_STYLES` in `apps/web/src/lib/design-tokens.ts` for consistent channel coloring.

**Migration:**
Generate: `npx prisma migrate dev --name add_campaign_channel --schema=packages/db/prisma/schema.prisma`

**Tests:**
1. Campaign created with channel field persists correctly
2. Channel stats groupBy returns accurate counts
3. CampaignSend records include channel after dispatch
4. Frontend renders channel picker with all options
5. Multi-channel mode falls back per customer

**Acceptance criteria:**
- Campaign creation includes channel selection (WhatsApp/SMS/Email/Multi)
- CampaignSend records track which channel was used
- Campaign detail page shows per-channel delivery breakdown
- Estimated cost shown before sending
- Existing campaigns without channel default to WHATSAPP
```

---

### HIGH-03: Campaign Conversion Funnel Visualization

```
Add a visual conversion funnel to the campaign detail page showing Sent → Delivered → Read → Booked with drop-off percentages.

**Files to modify:**
- `apps/api/src/modules/campaign/campaign.service.ts` — add funnel stats computation
- `apps/web/src/app/(protected)/campaigns/[id]/page.tsx` — add funnel component

**Backend:**
1. Add a `getFunnelStats()` method:
```typescript
async getFunnelStats(campaignId: string, businessId: string) {
  const total = await this.prisma.campaignSend.count({
    where: { campaignId, campaign: { businessId } },
  });
  const sent = await this.prisma.campaignSend.count({
    where: { campaignId, campaign: { businessId }, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
  });
  const delivered = await this.prisma.campaignSend.count({
    where: { campaignId, campaign: { businessId }, status: { in: ['DELIVERED', 'READ'] } },
  });
  const read = await this.prisma.campaignSend.count({
    where: { campaignId, campaign: { businessId }, status: 'READ' },
  });
  // Count bookings made by campaign recipients within 7 days of send
  const booked = await this.prisma.booking.count({
    where: {
      businessId,
      customerId: { in: recipientIds },
      createdAt: { gte: campaign.sentAt },
    },
  });

  return {
    stages: [
      { label: 'Sent', count: sent, percentage: 100 },
      { label: 'Delivered', count: delivered, percentage: total > 0 ? Math.round((delivered / sent) * 100) : 0 },
      { label: 'Read', count: read, percentage: total > 0 ? Math.round((read / delivered) * 100) : 0 },
      { label: 'Booked', count: booked, percentage: total > 0 ? Math.round((booked / read) * 100) : 0 },
    ],
  };
}
```

2. Add endpoint: `GET /campaigns/:id/funnel`

**Frontend:**
3. Build a `CampaignFunnel` component using Recharts (already in the project):
- Horizontal or vertical funnel bars with decreasing widths
- Each stage shows: count, percentage, and drop-off from previous stage
- Color gradient: sage-600 → sage-400 → sage-300 → lavender-500 (for booked)
- Drop-off annotations between stages (e.g., "32% drop-off")

4. Also add a simple time-series chart showing cumulative deliveries over time (line chart with Recharts)

5. Place the funnel prominently at the top of the campaign detail page, replacing or augmenting the current raw stat counts

**Acceptance criteria:**
- Funnel shows 4 stages: Sent → Delivered → Read → Booked
- Each stage shows count and percentage conversion from previous stage
- Drop-off percentages shown between stages
- Uses Recharts for visualization (already available)
- Funnel updates when page data refreshes
- Looks good on both desktop and mobile
```

---

### HIGH-04: Campaign Unsubscribe Tracking

```
Add campaign-level opt-out tracking with per-campaign unsubscribe links.

**Files to create/modify:**
- `packages/db/prisma/schema.prisma` — add CampaignUnsubscribe model
- `apps/api/src/modules/campaign/campaign.service.ts` — add unsubscribe logic
- `apps/api/src/modules/campaign/campaign.controller.ts` — add public unsubscribe endpoint
- `apps/api/src/modules/campaign/campaign-dispatch.service.ts` — check unsubscribes before sending, append unsubscribe link to messages

**Schema:**
```prisma
model CampaignUnsubscribe {
  id          String   @id @default(cuid())
  businessId  String
  customerId  String
  campaignId  String?  // Null = global unsubscribe from all campaigns
  token       String   @unique
  createdAt   DateTime @default(now())

  business    Business @relation(fields: [businessId], references: [id])
  customer    Customer @relation(fields: [customerId], references: [id])
  campaign    Campaign? @relation(fields: [campaignId], references: [id])

  @@unique([businessId, customerId, campaignId])
  @@index([businessId, customerId])
  @@index([token])
  @@map("campaign_unsubscribes")
}
```

**Backend:**
1. Generate unique token per CampaignSend that encodes businessId + customerId
2. Append unsubscribe link to every campaign message: `https://businesscommandcentre.com/unsubscribe/{token}`
3. Public endpoint `GET /campaigns/unsubscribe/:token` — validates token, creates CampaignUnsubscribe record, returns confirmation page
4. Before sending, check if customer has unsubscribed from this campaign or globally
5. Add unsubscribe count to campaign stats

**Frontend:**
6. Create a simple public unsubscribe confirmation page at `/unsubscribe/[token]`
7. Show unsubscribe count on campaign detail page
8. In audience filter builder, add option to "Exclude unsubscribed customers"

**Tests:**
1. Unsubscribe token is generated and appended to messages
2. Valid token creates unsubscribe record
3. Invalid/expired token returns 404
4. Unsubscribed customers are excluded from future sends
5. Global unsubscribe blocks all campaign sends

**Acceptance criteria:**
- Every campaign message includes an unsubscribe link
- Public endpoint handles unsubscribe with confirmation page
- Unsubscribed customers excluded from future campaign sends
- Campaign detail shows unsubscribe count
- Both campaign-specific and global unsubscribe supported
```

---

### HIGH-05: Automation New Trigger Types

```
Add 5 new trigger types to the automation system to cover the full customer lifecycle.

**Important context on current architecture:**
The existing automation executor in `apps/api/src/modules/automation/automation-executor.service.ts` uses a **cron-based approach** — it runs every minute via `@Cron` and processes rules by querying bookings that match each trigger type via a switch/case block (starting around line 69). The current 4 triggers are: BOOKING_CREATED (line 70), BOOKING_UPCOMING (line 100), STATUS_CHANGED (line 134), BOOKING_CANCELLED (line 166).

The new triggers are **event-based** (they fire when something happens, not on a schedule), so they require a NEW `evaluateTrigger()` method that services can call directly. This is an architectural addition, not a replacement of the existing cron approach.

**Files to modify:**
- `apps/api/src/modules/automation/automation-executor.service.ts` — add event-based `evaluateTrigger()` method alongside existing cron-based `processRule()`
- `apps/api/src/modules/automation/automation.service.ts` — update trigger type validation
- `apps/web/src/app/(protected)/automations/page.tsx` — update trigger display
- `apps/web/src/app/(protected)/automations/builder/page.tsx` — add new trigger blocks
- Various service files to add trigger emission points (see below)

**New triggers:**

1. **MESSAGE_RECEIVED** — fires when a new inbound message arrives
   - Filter by: channel, keyword/intent, is first message
   - Use case: Auto-respond to common questions, route to specific staff

2. **CUSTOMER_CREATED** — fires when a new customer record is created
   - Filter by: source (PORTAL, WHATSAPP, MANUAL), has phone, has email
   - Use case: Welcome sequence, intake form request

3. **PAYMENT_RECEIVED** — fires when a payment/invoice is marked paid
   - Filter by: amount range, service type
   - Use case: Thank you message, receipt delivery, upsell

4. **TESTIMONIAL_SUBMITTED** — fires when a testimonial is created (MANUAL or REQUESTED)
   - Filter by: rating (e.g., >= 4 stars), source
   - Use case: Auto-approve high ratings, thank the customer, request Google review

5. **CAMPAIGN_SENT** — fires when a customer receives a campaign message
   - Filter by: campaign name/id, didn't book within X days
   - Use case: Follow-up sequence for non-converters

**Backend implementation:**

1. Add a NEW `evaluateTrigger()` method to AutomationExecutorService (this is separate from the existing cron-based `processRule()`):
```typescript
async evaluateTrigger(trigger: string, context: Record<string, any>) {
  const rules = await this.prisma.automationRule.findMany({
    where: { businessId: context.businessId, trigger, isActive: true },
  });
  for (const rule of rules) {
    if (this.matchesFilters(rule.filters as any, context)) {
      // Reuse existing execution logic
      await this.executeRule(rule, context);
    }
  }
}
```

2. Add event emission points in existing services:
```typescript
// In message webhook controller (MESSAGE_RECEIVED):
this.automationExecutor.evaluateTrigger('MESSAGE_RECEIVED', {
  businessId, customerId, channel, messageContent,
});

// In customer service (CUSTOMER_CREATED):
this.automationExecutor.evaluateTrigger('CUSTOMER_CREATED', {
  businessId, customerId, source,
});

// In billing/payment service (PAYMENT_RECEIVED):
this.automationExecutor.evaluateTrigger('PAYMENT_RECEIVED', {
  businessId, customerId, amount, invoiceId,
});

// In testimonials service (TESTIMONIAL_SUBMITTED):
this.automationExecutor.evaluateTrigger('TESTIMONIAL_SUBMITTED', {
  businessId, customerId, rating, testimonialId,
});

// In campaign dispatch (CAMPAIGN_SENT):
this.automationExecutor.evaluateTrigger('CAMPAIGN_SENT', {
  businessId, customerId, campaignId, campaignName,
});
```

**Frontend:**
Update the visual builder's trigger block list with the 5 new options, each with appropriate filter options in the configuration modal.

**Tests:**
Add tests for each new trigger:
1. MESSAGE_RECEIVED fires on inbound message
2. CUSTOMER_CREATED fires on new customer
3. Filters correctly match/reject based on context
4. Multiple rules can fire for same trigger
5. Inactive rules are skipped

**Acceptance criteria:**
- 5 new trigger types are available in rule creation
- Each trigger fires at the correct point in existing service flows
- Filters work correctly for each trigger type
- Visual builder shows new trigger blocks with configuration
- Existing triggers continue to work unchanged
```

---

### HIGH-06: Automation New Action Types (incl. REQUEST_TESTIMONIAL)

```
Add 4 new action types to automations, with REQUEST_TESTIMONIAL being the key cross-feature integration.

**Files to modify:**
- `apps/api/src/modules/automation/automation-executor.service.ts` — add action handlers
- `apps/api/src/modules/automation/automation.module.ts` — inject new service dependencies
- `apps/web/src/app/(protected)/automations/builder/page.tsx` — add action blocks

**New action types:**

1. **REQUEST_TESTIMONIAL** — sends a testimonial request to the customer
```typescript
if (actionType === 'REQUEST_TESTIMONIAL') {
  // sendRequest signature: (businessId: string, customerId: string)
  // See testimonials.service.ts line 137
  await this.testimonialsService.sendRequest(
    execution.businessId,
    execution.customerId,
  );
}
```
Inject TestimonialsService into AutomationExecutorService. Also import TestimonialsModule in automation.module.ts (currently NOT imported — line 11).

2. **SEND_EMAIL** — sends a specific email (distinct from SEND_MESSAGE which uses default channel)
```typescript
if (actionType === 'SEND_EMAIL' && config.subject && config.body) {
  const customer = await this.prisma.customer.findUnique({
    where: { id: execution.customerId },
  });
  if (customer?.email) {
    await this.messageService.sendOutbound({
      businessId: execution.businessId,
      customerId: customer.id,
      channel: 'EMAIL',
      content: config.body,
      metadata: { subject: config.subject },
    });
  }
}
```

3. **UPDATE_CUSTOMER_FIELD** — updates a field on the customer record
```typescript
if (actionType === 'UPDATE_CUSTOMER_FIELD' && config.field && config.value) {
  const allowedFields = ['tags', 'notes', 'customFields'];
  if (allowedFields.includes(config.field)) {
    await this.prisma.customer.update({
      where: { id: execution.customerId },
      data: { [config.field]: config.value },
    });
  }
}
```

4. **WEBHOOK** — calls an external URL with event data
```typescript
if (actionType === 'WEBHOOK' && config.url) {
  await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: rule.trigger,
      businessId: execution.businessId,
      customerId: execution.customerId,
      bookingId: execution.bookingId,
      timestamp: new Date().toISOString(),
      ...config.payload,
    }),
  });
}
```

**Frontend:**
Add new action blocks to the visual builder with configuration modals:
- REQUEST_TESTIMONIAL: Simple block, no config needed (auto-resolves customer)
- SEND_EMAIL: Subject + body inputs with merge variable support
- UPDATE_CUSTOMER_FIELD: Field picker + value input
- WEBHOOK: URL input + optional custom payload editor

**Wire the Consult Conversion playbook:**
In `automation.service.ts`, update the Consult Conversion playbook definition to include a REQUEST_TESTIMONIAL action step that fires after the existing follow-up message.

**Tests:**
1. REQUEST_TESTIMONIAL creates testimonial record and enqueues email
2. SEND_EMAIL sends via EMAIL channel with subject
3. UPDATE_CUSTOMER_FIELD updates allowed fields only (rejects disallowed)
4. WEBHOOK makes HTTP POST with correct payload
5. Webhook timeout/failure doesn't crash the executor

**Acceptance criteria:**
- 4 new action types work in both custom rules and visual builder
- REQUEST_TESTIMONIAL calls TestimonialsService.sendRequest()
- Consult Conversion playbook wired with REQUEST_TESTIMONIAL step
- WEBHOOK has timeout (5s) and failure handling
- UPDATE_CUSTOMER_FIELD restricted to safe fields only
```

---

### HIGH-07: Automation Performance Dashboard

```
Build a dedicated automation analytics page showing performance metrics.

**Files to create/modify:**
- `apps/api/src/modules/automation/automation.service.ts` — add analytics endpoints
- `apps/api/src/modules/automation/automation.controller.ts` — add analytics routes
- `apps/web/src/app/(protected)/automations/analytics/page.tsx` — new analytics page
- `apps/web/src/lib/nav-config.ts` — add nav item (or sub-tab on automations page)

**Backend endpoints:**

1. `GET /automations/analytics/overview` — summary stats:
```typescript
{
  totalRulesActive: number,
  totalMessagesSent7d: number,
  totalMessagesSkipped7d: number,
  totalMessagesFailed7d: number,
  deliveryRate: number,  // sent / (sent + failed) as percentage
  topPerformingRule: { id, name, sentCount },
  quietHoursHits7d: number,
  frequencyCapHits7d: number,
}
```

2. `GET /automations/analytics/timeline?days=30` — daily aggregation:
```typescript
[
  { date: '2026-03-01', sent: 12, skipped: 3, failed: 1 },
  // ... per day
]
```

3. `GET /automations/analytics/by-rule` — per-rule breakdown:
```typescript
[
  { ruleId, ruleName, trigger, sent: 45, delivered: 40, failed: 5, skipReasons: { quietHours: 8, frequencyCap: 3 } },
]
```

**Frontend:**
Build the analytics page with 4 sections:

1. **Summary cards** (top row): Active Rules, Messages Sent (7d), Delivery Rate, Safety Cap Hits
2. **Timeline chart** (Recharts area chart): daily sent/skipped/failed over 30 days
3. **Per-rule table**: sortable by sent count, delivery rate, fail rate
4. **Skip reasons breakdown**: pie chart showing quiet hours vs frequency cap vs other

Use the existing design system: sage for success metrics, amber for warnings, red for failures.

Add this as a sub-tab within the automations page (alongside Playbooks, Custom Rules, Activity Log) or as a standalone page at `/automations/analytics`.

**Tests:**
1. Overview endpoint returns correct aggregations
2. Timeline endpoint groups by day correctly
3. By-rule endpoint includes skip reason breakdown
4. Frontend renders charts with mock data

**Acceptance criteria:**
- Analytics page shows 7-day and 30-day performance metrics
- Timeline chart shows daily message volumes
- Per-rule breakdown identifies best/worst performing rules
- Skip reason analysis shows quiet hours and cap impacts
- Page follows existing design patterns (Recharts, sage/amber/red coloring)
```

---

### HIGH-08: Testimonial Customer Self-Submission Portal

```
Build a public testimonial submission form so customers can respond to review requests.

**Files to create:**
- `apps/api/src/modules/testimonials/dto/submit-testimonial.dto.ts` — public submission DTO
- `apps/web/src/app/testimonials/submit/[token]/page.tsx` — public submission form

**Files to modify:**
- `packages/db/prisma/schema.prisma` — add `submissionToken` to Testimonial model
- `apps/api/src/modules/testimonials/testimonials.service.ts` — add token generation and public submit
- `apps/api/src/modules/testimonials/testimonials.controller.ts` — add public submit endpoint

**Schema change:**
```prisma
model Testimonial {
  // ... existing fields ...
  submissionToken  String?  @unique  // Token for customer self-submission
}
```

**Backend:**

1. When `sendRequest()` is called, generate a unique token and store it. Note: the current signature is `sendRequest(businessId: string, customerId: string)` (plain strings) — update it to also handle token generation:
```typescript
async sendRequest(businessId: string, customerId: string) {
  const token = randomBytes(32).toString('hex');
  const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
  const testimonial = await this.prisma.testimonial.create({
    data: {
      businessId,
      customerId,
      name: customer.name || '',
      content: '',
      source: 'REQUESTED',
      requestedAt: new Date(),
      submissionToken: token,
    },
  });
  // Include token in email link
  // Email body: "Share your experience: https://businesscommandcentre.com/testimonials/submit/{token}"
}
```

2. Add public submission endpoint (no auth):
```typescript
@Post('testimonials/public/submit')
async submitPublic(@Body() dto: SubmitTestimonialDto) {
  return this.testimonialsService.submitByToken(dto);
}
```

3. Add `submitByToken()` method:
```typescript
async submitByToken(dto: { token: string; content: string; rating: number; name?: string }) {
  const testimonial = await this.prisma.testimonial.findUnique({
    where: { submissionToken: dto.token },
    include: { business: true },
  });
  if (!testimonial) throw new NotFoundException('Invalid or expired link');
  if (testimonial.submittedAt) throw new BadRequestException('Already submitted');

  return this.prisma.testimonial.update({
    where: { id: testimonial.id },
    data: {
      content: dto.content,
      rating: dto.rating,
      name: dto.name || testimonial.name,
      status: 'PENDING',
      submittedAt: new Date(),
      submissionToken: null, // Invalidate token after use
    },
  });
}
```

**SubmitTestimonialDto:**
```typescript
export class SubmitTestimonialDto {
  @IsString() token: string;
  @IsString() @MinLength(20) @MaxLength(5000) content: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
}
```

**Frontend (public page):**
Build `/testimonials/submit/[token]/page.tsx`:
- Fetch testimonial info via token: `GET /testimonials/public/verify/:token`
- Show business name and logo
- Star rating selector (1-5, interactive)
- Text area for review (min 20 chars, max 5000)
- Optional name field (pre-filled from customer record)
- Submit button
- Success state: "Thank you! Your review has been submitted and is pending approval."
- Error states: invalid token, already submitted, validation errors
- Mobile-responsive, clean design following BookingOS aesthetic

**Tests:**
1. Token generation on request
2. Valid token submission creates testimonial with content
3. Invalid token returns 404
4. Already-submitted token returns 400
5. Content validation (min/max length, rating range)
6. Token invalidated after submission

**Acceptance criteria:**
- Customers receive email with submission link
- Public form collects rating + written review
- Submission sets submittedAt and invalidates token
- Form is mobile-friendly and branded
- Submitted testimonials appear as PENDING in admin
- No authentication required
```

---

### HIGH-09: Testimonial Customer Detail Integration

```
Show testimonials on the customer detail page and add a "Request Testimonial" CTA.

**Files to modify:**
- `apps/web/src/app/(protected)/customers/[id]/page.tsx` — add testimonials section
- `apps/api/src/modules/testimonials/testimonials.controller.ts` — add endpoint to get customer testimonials

**Backend:**
1. Add endpoint: `GET /testimonials?customerId=:id`
Already supported — the existing `findAll()` method accepts query params. Just ensure `customerId` filter works:
```typescript
if (query.customerId) {
  where.customerId = query.customerId;
}
```

**Frontend:**
2. On the customer detail page, add a "Testimonials" section (or tab) that shows:
- List of testimonials from this customer (using TestimonialCard component)
- If no testimonials: "No testimonials yet" empty state with "Request Testimonial" button
- If testimonials exist: show them with status badges + "Request Another" button

3. "Request Testimonial" button calls `POST /testimonials/request` with the customer's ID

4. Show the testimonial count as a badge/indicator in the customer profile summary area

5. On the customer list page (`/customers`), add a column or badge showing testimonial status:
- No testimonials → empty
- Pending request → amber dot
- Has approved testimonial → sage star icon

**Acceptance criteria:**
- Customer detail page shows all testimonials from that customer
- "Request Testimonial" button works and shows confirmation toast
- Empty state encourages requesting a testimonial
- Customer list has visual indicator of testimonial status
- Uses existing TestimonialCard component for display
```

---

### HIGH-10: Complete Testimonial i18n Coverage

```
Add all missing translation keys for the testimonials feature to both en.json and es.json.

**Files to modify:**
- `apps/web/src/locales/en.json` — add ~40 missing keys
- `apps/web/src/locales/es.json` — add corresponding Spanish translations
- `apps/web/src/app/(protected)/testimonials/page.tsx` — replace hardcoded strings with t() calls
- `apps/web/src/components/testimonial-card.tsx` — replace hardcoded strings with t() calls

**Currently only 1 key exists:** `"nav.testimonials": "Testimonials"`

**Add these keys to en.json:**
```json
{
  "testimonials.title": "Testimonials",
  "testimonials.tab.all": "All",
  "testimonials.tab.pending": "Pending",
  "testimonials.tab.approved": "Approved",
  "testimonials.tab.featured": "Featured",
  "testimonials.tab.rejected": "Rejected",
  "testimonials.action.approve": "Approve",
  "testimonials.action.reject": "Reject",
  "testimonials.action.feature": "Feature",
  "testimonials.action.unfeature": "Unfeature",
  "testimonials.action.delete": "Delete",
  "testimonials.action.edit": "Edit",
  "testimonials.action.request": "Request Testimonial",
  "testimonials.status.pending": "Pending",
  "testimonials.status.approved": "Approved",
  "testimonials.status.featured": "Featured",
  "testimonials.status.rejected": "Rejected",
  "testimonials.request.title": "Request Testimonial",
  "testimonials.request.selectCustomer": "Select a customer",
  "testimonials.request.searchPlaceholder": "Search by name or email...",
  "testimonials.request.preview": "Email Preview",
  "testimonials.request.send": "Send Request",
  "testimonials.request.cancel": "Cancel",
  "testimonials.request.success": "Testimonial request sent!",
  "testimonials.request.noEmail": "This customer has no email address",
  "testimonials.empty.title": "No testimonials yet",
  "testimonials.empty.description": "Request testimonials from your customers to build social proof",
  "testimonials.empty.pending": "No pending testimonials",
  "testimonials.empty.approved": "No approved testimonials",
  "testimonials.empty.featured": "No featured testimonials",
  "testimonials.empty.rejected": "No rejected testimonials",
  "testimonials.featured.count": "{{count}}/6 featured",
  "testimonials.approve.success": "Testimonial approved",
  "testimonials.reject.success": "Testimonial rejected",
  "testimonials.feature.success": "Testimonial featured",
  "testimonials.delete.success": "Testimonial deleted",
  "testimonials.delete.confirm": "Are you sure you want to delete this testimonial?",
  "testimonials.rating": "{{count}} stars",
  "testimonials.source.manual": "Manual",
  "testimonials.source.requested": "Requested",
  "testimonials.public.title": "What Our Clients Say",
  "testimonials.public.viewAll": "View all reviews",
  "testimonials.submit.title": "Share Your Experience",
  "testimonials.submit.ratingLabel": "How would you rate your experience?",
  "testimonials.submit.contentLabel": "Tell us about your experience",
  "testimonials.submit.contentPlaceholder": "What did you enjoy most? How was the service?",
  "testimonials.submit.submit": "Submit Review",
  "testimonials.submit.success": "Thank you! Your review has been submitted.",
  "testimonials.submit.alreadySubmitted": "You've already submitted a review. Thank you!"
}
```

**Add corresponding Spanish translations to es.json** (translate all values to Spanish).

**Then update the components:**
Replace all hardcoded strings in:
1. `testimonials/page.tsx` — tab labels, button text, modal text, toast messages, empty states
2. `testimonial-card.tsx` — action button labels, status badge text

Use the existing `useTranslation` hook: `const { t } = useTranslation();`

**Acceptance criteria:**
- All UI strings in testimonials use t() calls
- Both en.json and es.json have complete testimonial key coverage
- Switching language to Spanish shows all testimonial strings in Spanish
- No hardcoded English strings remain in testimonial components
```

---

## PHASE 2: MEDIUM-IMPACT IMPROVEMENTS

---

### MED-01: Campaign Cloning

```
Add a "Clone Campaign" button that duplicates an existing campaign with all its settings.

**Files to modify:**
- `apps/api/src/modules/campaign/campaign.service.ts` — add clone method
- `apps/api/src/modules/campaign/campaign.controller.ts` — add clone endpoint
- `apps/web/src/app/(protected)/campaigns/page.tsx` — add clone button to campaign rows
- `apps/web/src/app/(protected)/campaigns/[id]/page.tsx` — add clone button on detail page

**Backend:**
```typescript
async clone(businessId: string, campaignId: string): Promise<Campaign> {
  const original = await this.prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
  });
  if (!original) throw new NotFoundException();

  return this.prisma.campaign.create({
    data: {
      businessId,
      name: `${original.name} (Copy)`,
      status: 'DRAFT',
      filters: original.filters,
      templateId: original.templateId,
      channel: original.channel,
      isABTest: original.isABTest,
      variants: original.variants,
      throttlePerMinute: original.throttlePerMinute,
      // Don't copy: scheduledAt, sentAt, stats, recurrence, parentCampaignId
    },
  });
}
```

Endpoint: `POST /campaigns/:id/clone`

**Frontend:**
- Add "Clone" button (Copy icon from lucide-react) on campaign list rows and detail page
- After cloning, redirect to the new campaign in edit/draft mode
- Show toast: "Campaign cloned as draft"

**Tests:**
1. Clone creates new campaign with DRAFT status
2. Clone copies filters, variants, channel but not stats or schedule
3. Clone appends " (Copy)" to name
4. Clone fails for campaign not in same business (tenant isolation)

**Acceptance criteria:**
- One-click clone from list page and detail page
- Cloned campaign is DRAFT with all content settings preserved
- Schedule, stats, and send history are NOT copied
- User redirected to cloned campaign for editing
```

---

### MED-02: Campaign Test Send

```
Add a "Send Test" button that sends the campaign message to the logged-in staff member for preview.

**Files to modify:**
- `apps/api/src/modules/campaign/campaign.service.ts` — add testSend method
- `apps/api/src/modules/campaign/campaign.controller.ts` — add test send endpoint
- `apps/web/src/app/(protected)/campaigns/new/page.tsx` — add test send button in Review step

**Backend:**
```typescript
async testSend(businessId: string, campaignId: string, staffId: string) {
  const campaign = await this.prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
  });
  const staff = await this.prisma.staff.findFirst({
    where: { id: staffId, businessId },
    include: { user: true },
  });
  if (!campaign || !staff) throw new NotFoundException();

  // Send test via email (most reliable for previews)
  const variants = campaign.variants as any[];
  const messageContent = variants?.[0]?.content || '';
  const rendered = this.renderTemplate(messageContent, {
    customerName: 'Test Customer',
    businessName: business.name,
  });

  // Use notification service to send email
  await this.notificationService.sendEmail({
    to: staff.user.email,
    subject: `[TEST] Campaign Preview: ${campaign.name}`,
    body: `This is a test preview of your campaign.\n\n---\n\n${rendered}\n\n---\n\nThis message was sent to ${audience.length} customers.`,
  });

  return { sent: true, sentTo: staff.user.email };
}
```

Endpoint: `POST /campaigns/:id/test-send`

**Frontend:**
- In the Review step of campaign wizard, add "Send Test to Me" button
- Also available on campaign detail page for DRAFT/SCHEDULED campaigns
- Show toast: "Test sent to your-email@example.com"

**Acceptance criteria:**
- Test send delivers campaign preview to staff email
- Shows rendered message with sample merge variables
- Available in both wizard review step and detail page
- Only works for DRAFT and SCHEDULED campaigns (not already SENT)
```

---

### MED-03: Campaign Cost Estimation

```
Show estimated messaging cost before sending a campaign based on audience size and channel rates.

**Files to modify:**
- `apps/api/src/modules/campaign/campaign.service.ts` — add cost estimation
- `apps/web/src/app/(protected)/campaigns/new/page.tsx` — show estimate in Review step

**Backend:**
```typescript
async estimateCost(businessId: string, filters: any, channel: string) {
  const audience = await this.buildAudience(businessId, filters);
  const count = audience.length;

  // Rates from UsageService (already defined in the codebase)
  const rates: Record<string, number> = {
    SMS: 0.0079,      // per segment
    EMAIL: 0.00065,
    WHATSAPP: 0,       // free (included in WhatsApp plan)
    INSTAGRAM: 0,
    FACEBOOK: 0,
    WEB_CHAT: 0,
  };

  const rate = rates[channel] || 0;
  const estimatedCost = count * rate;

  return {
    audienceSize: count,
    channel,
    ratePerMessage: rate,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    currency: 'USD',
  };
}
```

Endpoint: `GET /campaigns/estimate-cost?filters=...&channel=...`

**Frontend:**
- In the Review step, show a cost card:
  "Estimated cost: $X.XX for {count} messages via {channel}"
- Show warning if cost > $10: "This campaign will cost more than $10"
- Free channels show: "No additional cost (included in plan)"

**Acceptance criteria:**
- Cost estimate shown in review step before sending
- Uses actual channel rates from the existing rate table
- Updates when audience or channel changes
- Clear display of free vs paid channels
```

---

### MED-04: Connect SavedSegment to Campaign Filter Builder

```
Verify and fix the SavedSegment integration in the campaign filter builder.

**Current state:**
`SavedSegmentService` exists at `apps/api/src/modules/campaign/saved-segment.service.ts` with full CRUD. The `CampaignFilterBuilder` component has Save/Load Segment buttons with test-ids (`save-segment-btn`, `load-segment-btn`). Tests exist in `campaign-filter-builder.test.tsx` (lines 175-253) that verify the buttons, modals, and API calls work. The backend endpoints are `GET/POST /campaigns/segments`.

**What needs verification:**
The frontend code and tests exist, but the feature may have regressions or be incomplete. Review the actual behavior:

**Files to review and fix:**
- `apps/web/src/components/campaign-filter-builder.tsx` — verify Save/Load Segment buttons work end-to-end
- `apps/api/src/modules/campaign/saved-segment.service.ts` — verify endpoints return correct format

**Specific checks:**
1. Does "Save as Segment" actually call `POST /campaigns/segments` with current filters? Test it.
2. Does "Load Segment" fetch from `GET /campaigns/segments` and populate the filter builder correctly?
3. Do loaded segments correctly deserialize back into filter rows?
4. Is there a "Delete Segment" option?
5. Does the segment dropdown show audience size preview?

**Improvements to add (if Save/Load already works):**
- Add segment audience size preview (call buildAudience with segment filters)
- Add "Delete" button on saved segments
- Add segment usage count (how many campaigns use this segment)
- Show last-used date on segments

**Acceptance criteria:**
- Save current filters as a named segment (verify working)
- Load a saved segment and populate the filter builder (verify working)
- Delete saved segments
- Segment list shows name and approximate audience size
- Run existing tests: `npx jest campaign-filter-builder.test.tsx` — all pass
```

---

### MED-05: Expand Automation Playbook Library

```
Add 5 new vertical-aware playbook templates to the automation system.

**Files to modify:**
- `apps/api/src/modules/automation/automation.service.ts` — add new playbook definitions

**New playbooks to add to the `ensurePlaybooks()` method:**

1. **Welcome New Customer** (all verticals)
   - Trigger: CUSTOMER_CREATED
   - Action: SEND_MESSAGE with welcome template
   - Delay: None (immediate)
   - Message: "Welcome to {{business}}! We're excited to have you. Book your first appointment: [link]"

2. **Post-Treatment Testimonial Request** (aesthetic vertical)
   - Trigger: STATUS_CHANGED (to COMPLETED, serviceKind: TREATMENT)
   - Delay: 3 days
   - Action: REQUEST_TESTIMONIAL
   - Note: Wire to the new REQUEST_TESTIMONIAL action type from HIGH-06

3. **Package Expiry Reminder** (wellness vertical)
   - Trigger: TIME_BASED (7 days before package expiry)
   - Action: SEND_MESSAGE
   - Message: "Hi {{name}}, your {{service}} package expires in 7 days. You have {{remaining}} sessions left. Book now!"

4. **Service Completed Survey** (dealership vertical)
   - Trigger: STATUS_CHANGED (kanban to READY_FOR_PICKUP)
   - Delay: 24 hours
   - Action: SEND_MESSAGE
   - Message: "Hi {{name}}, how was your experience at {{business}}? Reply with 1-5 to rate us."

5. **Birthday / Anniversary** (all verticals)
   - Trigger: TIME_BASED (customer birthday or first-visit anniversary)
   - Action: SEND_MESSAGE
   - Message: "Happy birthday {{name}}! Enjoy 15% off your next visit as our gift. Book now: [link]"

For each playbook, define:
- `name`, `description`, `trigger`, `filters`, `actions` (matching existing playbook format)
- `playbook: true` flag
- Pack awareness: only create wellness playbooks for wellness businesses, etc.

**Acceptance criteria:**
- 5 new playbooks created on first run (idempotent via name check)
- Playbooks are vertical-aware (only created for matching vertical pack)
- Each playbook has descriptive name, description, sample message
- PlaybookCard components render correctly for all new playbooks
```

---

### MED-06: Testimonial Dashboard Widget

```
Add a testimonials widget to the main dashboard page.

**Files to modify:**
- `apps/api/src/modules/testimonials/testimonials.service.ts` — add dashboard stats method
- `apps/api/src/modules/testimonials/testimonials.controller.ts` — add stats endpoint
- `apps/web/src/app/(protected)/dashboard/page.tsx` — add testimonials widget card

**Backend:**
```typescript
async getDashboardStats(businessId: string) {
  const [pending, approved, featured, total, avgRating] = await Promise.all([
    this.prisma.testimonial.count({ where: { businessId, status: 'PENDING' } }),
    this.prisma.testimonial.count({ where: { businessId, status: 'APPROVED' } }),
    this.prisma.testimonial.count({ where: { businessId, status: 'FEATURED' } }),
    this.prisma.testimonial.count({ where: { businessId } }),
    this.prisma.testimonial.aggregate({
      where: { businessId, status: { in: ['APPROVED', 'FEATURED'] }, rating: { not: null } },
      _avg: { rating: true },
    }),
  ]);
  return { pending, approved, featured, total, avgRating: avgRating._avg.rating || 0 };
}
```

Endpoint: `GET /testimonials/stats`

**Frontend widget:**
- Card matching dashboard design (rounded-2xl, shadow-soft)
- Title: "Testimonials" with Star icon
- Stats: Pending (amber), Featured (X/6), Avg Rating (star display)
- Quick action: "View Pending" link → navigates to testimonials page with PENDING tab
- If pending > 0, show amber notification dot

**Acceptance criteria:**
- Dashboard shows testimonial summary card
- Pending count shown with visual urgency (amber if > 0)
- Featured count shows X/6 progress
- Average rating displayed with stars
- Quick link to testimonials page
```

---

### MED-07: Centralize Testimonial Design Tokens

```
Move testimonial status styles from inline definitions in TestimonialCard to the centralized design-tokens.ts file.

**Files to modify:**
- `apps/web/src/lib/design-tokens.ts` — add TESTIMONIAL_STATUS_STYLES and helper
- `apps/web/src/components/testimonial-card.tsx` — import from design-tokens instead of inline

**In design-tokens.ts, add:**
```typescript
export const TESTIMONIAL_STATUS_STYLES: Record<string, { bg: string; text: string; border?: string; label: string }> = {
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  APPROVED: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Approved' },
  FEATURED: { bg: 'bg-lavender-50', text: 'text-lavender-900', border: 'border-lavender-200', label: 'Featured' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
};

export const TESTIMONIAL_SOURCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  MANUAL: { bg: 'bg-slate-50', text: 'text-slate-600', label: 'Manual' },
  REQUESTED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Requested' },
};

export function testimonialStatusBadgeClasses(status: string): string {
  const style = TESTIMONIAL_STATUS_STYLES[status];
  return style ? `${style.bg} ${style.text}` : 'bg-gray-50 text-gray-600';
}
```

**In testimonial-card.tsx:**
Replace the inline STATUS_BADGES object with imports from design-tokens.ts.

**Acceptance criteria:**
- Testimonial status styles defined in design-tokens.ts
- TestimonialCard imports from design-tokens
- Status and source badge helpers available for reuse
- No visual changes to existing UI
- Follows the same pattern as BOOKING_STATUS_STYLES, CONVERSATION_STATUS_STYLES, etc.
```

---

### MED-08: Testimonial Settings Page

```
Build a /settings/testimonials configuration page.

**Files to create:**
- `apps/web/src/app/(protected)/settings/testimonials/page.tsx` — settings page

**Files to modify:**
- `packages/db/prisma/schema.prisma` — add testimonialSettings JSON to Business model (or use existing packConfig)
- `apps/api/src/modules/testimonials/testimonials.service.ts` — add settings get/update
- `apps/api/src/modules/testimonials/testimonials.controller.ts` — add settings endpoints

**Settings to support:**

1. **Email template customization:**
   - Subject line (default: "We'd love your feedback!")
   - Body text (default: current hardcoded message)
   - CTA button text (default: "Share Your Experience")
   - Preview pane showing rendered email

2. **Auto-approve rules:**
   - Toggle: Auto-approve 5-star testimonials (default: off)
   - Toggle: Auto-approve from repeat customers (3+ bookings, default: off)

3. **Display preferences:**
   - Max featured testimonials (default: 6, range 1-12)
   - Show ratings on public page (default: yes)
   - Show author info on public page (default: yes)

4. **Request behavior:**
   - Auto-send follow-up reminder after X days (default: off, range: 3-14 days)
   - Maximum requests per customer (default: 1 per 90 days)

Store settings in `Business.packConfig` under a `testimonials` key:
```json
{
  "testimonials": {
    "emailSubject": "We'd love your feedback!",
    "emailBody": "...",
    "autoApprove5Star": false,
    "maxFeatured": 6,
    "showRatings": true,
    "reminderDays": 0,
    "maxRequestsPer90Days": 1
  }
}
```

**Frontend:**
Build the page following existing settings page patterns (e.g., /settings/channels). Sections with toggles, inputs, and a preview pane for the email template.

Add navigation: Add "Testimonials" to the settings sidebar nav.

**Acceptance criteria:**
- Settings page at /settings/testimonials with all 4 sections
- Email template preview updates live as user types
- Settings saved to Business.packConfig.testimonials
- Service respects settings (auto-approve, max featured, reminder days)
- Navigation added to settings sidebar
```

---

### MED-09: Testimonial Search, Sort, and Bulk Actions

```
Add search, sort, and bulk actions to the testimonials admin page.

**Files to modify:**
- `apps/web/src/app/(protected)/testimonials/page.tsx` — add search, sort, bulk select
- `apps/api/src/modules/testimonials/testimonials.service.ts` — add search/sort to findAll

**Backend:**
Update `findAll()` to support search and sort:
```typescript
async findAll(businessId: string, query: {
  status?: string;
  search?: string;
  sortBy?: 'createdAt' | 'rating' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  const where: any = { businessId };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { content: { contains: query.search, mode: 'insensitive' } },
      { company: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  // ... pagination and sorting
}
```

Add bulk action endpoint:
```typescript
@Post('testimonials/bulk')
async bulkAction(@BusinessId() businessId: string, @Body() dto: { ids: string[]; action: 'approve' | 'reject' | 'delete' }) {
  // Process bulk action
}
```

**Frontend:**
1. Search bar at the top (with lucide Search icon, data-search-input for / shortcut)
2. Sort dropdown: Newest first, Oldest first, Highest rated, Lowest rated
3. Checkbox on each TestimonialCard for multi-select
4. BulkActionBar (use existing component pattern) appears when items selected:
   - "Approve Selected", "Reject Selected", "Delete Selected"
   - Count indicator: "3 selected"
5. Featured count indicator: "3/6 featured" shown near the tabs

**Acceptance criteria:**
- Search filters testimonials by name, content, or company
- Sort by date or rating in both directions
- Multi-select with BulkActionBar for batch operations
- Featured count indicator always visible
- Search works across all status tabs
```

---

### MED-10: Automated Testimonial Follow-up Reminders

```
Automatically send a reminder email if a customer hasn't responded to a testimonial request within 5 days.

**Files to modify:**
- `apps/api/src/modules/testimonials/testimonials.service.ts` — add reminder logic
- `apps/api/src/modules/testimonials/testimonials.module.ts` — add cron schedule

**Implementation:**

1. Add a cron job that runs daily:
```typescript
@Cron(CronExpression.EVERY_DAY_AT_10AM)
async sendPendingReminders() {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const pendingRequests = await this.prisma.testimonial.findMany({
    where: {
      source: 'REQUESTED',
      submittedAt: null,        // Not yet submitted
      requestedAt: { lte: fiveDaysAgo },  // Requested 5+ days ago
      status: 'PENDING',
      reminderSentAt: null,     // Haven't sent reminder yet
    },
    include: { customer: true, business: true },
  });

  for (const testimonial of pendingRequests) {
    if (!testimonial.customer?.email) continue;

    // Enqueue reminder email
    await this.notificationQueue.add('testimonial-reminder', {
      email: testimonial.customer.email,
      customerName: testimonial.customer.name,
      businessName: testimonial.business.name,
      submissionToken: testimonial.submissionToken,
    });

    await this.prisma.testimonial.update({
      where: { id: testimonial.id },
      data: { reminderSentAt: new Date() },
    });
  }
}
```

2. Add `reminderSentAt` field to Testimonial model:
```prisma
model Testimonial {
  // ... existing fields ...
  reminderSentAt   DateTime?  // When follow-up reminder was sent
}
```

3. Create migration for the new field.

4. Make the reminder delay configurable via Business.packConfig.testimonials.reminderDays (from MED-08).

**Tests:**
1. Reminder sent for requests older than 5 days
2. Reminder NOT sent if already submitted
3. Reminder NOT sent if already reminded
4. Reminder NOT sent if customer has no email
5. Configurable delay respects business settings

**Acceptance criteria:**
- Daily cron sends reminders for unanswered requests
- Only one reminder per request
- Reminder includes submission link
- Configurable delay (default 5 days)
- Respects business testimonial settings
```

---

### MED-11: Public Testimonial Prominence Boost

```
Improve testimonial visibility on the public booking page.

**Files to modify:**
- `apps/web/src/app/book/[slug]/page.tsx` — enhance testimonials section

**Changes:**

1. **Move testimonials higher** — place them above the bottom of the page, ideally after the service list and before the booking form. Social proof should be visible before the customer commits.

2. **Add aggregate stats banner:**
```tsx
<div className="text-center mb-6">
  <div className="text-3xl font-serif font-bold text-slate-800">
    {avgRating.toFixed(1)} ★
  </div>
  <p className="text-sm text-slate-500">
    Based on {totalCount} reviews
  </p>
</div>
```

3. **Add "Read more" expand** — replace 150-char truncation with expandable cards:
```tsx
const [expanded, setExpanded] = useState<Record<string, boolean>>({});
// Show full content when expanded, truncated when not
{expanded[t.id] ? t.content : t.content.slice(0, 150) + '...'}
{t.content.length > 150 && (
  <button onClick={() => toggle(t.id)} className="text-sage-600 text-sm">
    {expanded[t.id] ? 'Show less' : 'Read more'}
  </button>
)}
```

4. **Star rating distribution** — show a mini bar chart:
```
5 ★ ████████████ 45
4 ★ ███████      28
3 ★ ███          12
2 ★ █             4
1 ★               1
```

5. **Visual distinction for FEATURED** — add a subtle "Top Review" badge or gold border on featured testimonials

6. **"Leave a Review" CTA** at the bottom of the testimonials section (links to submission portal if customer is logged in, or shows info about how to leave a review)

**Acceptance criteria:**
- Testimonials section moved to a more prominent position
- Aggregate rating and count shown
- Expandable testimonial content (no more hard truncation)
- Star distribution visualization
- Featured testimonials visually distinguished
- Mobile-responsive layout
```

---

### MED-12: Automation Conflict Detection

```
Warn when creating automation rules with overlapping triggers that could double-message customers.

**Files to modify:**
- `apps/api/src/modules/automation/automation.service.ts` — add conflict check
- `apps/web/src/app/(protected)/automations/new/page.tsx` — show conflict warnings

**Backend:**
```typescript
async checkConflicts(businessId: string, trigger: string, filters: any, excludeRuleId?: string) {
  const existingRules = await this.prisma.automationRule.findMany({
    where: {
      businessId,
      trigger,
      isActive: true,
      ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
    },
  });

  const conflicts = existingRules.filter(rule => {
    // Check if filters overlap (same status trigger, same service filter, etc.)
    return this.filtersOverlap(rule.filters as any, filters);
  });

  return conflicts.map(r => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    overlap: 'Same trigger with overlapping filters',
  }));
}
```

Endpoint: `GET /automations/check-conflicts?trigger=X&filters=Y`

**Frontend:**
- Call conflict check when user finishes configuring trigger+filters in the wizard
- Show amber warning banner if conflicts found:
  "⚠️ This rule may overlap with: [Rule Name]. Customers could receive duplicate messages. Safety caps will limit to 3/day, but consider adjusting filters."
- Non-blocking — user can proceed despite warning

**Acceptance criteria:**
- Conflict check runs on rule creation and edit
- Warning shown for overlapping triggers+filters
- Warning is non-blocking (informational only)
- Existing safety caps mentioned in warning text
```

---

### MED-13: Activity Log Export and Improved Pagination

```
Add CSV export and improved pagination to the automation activity log.

**Files to modify:**
- `apps/api/src/modules/automation/automation.service.ts` — add export endpoint, improve pagination
- `apps/api/src/modules/automation/automation.controller.ts` — add export route
- `apps/web/src/app/(protected)/automations/page.tsx` — add export button, improve pagination UI

**Backend:**
1. Increase default pagination from 20 to 50 items
2. Add total count to response:
```typescript
async getActivityLog(businessId: string, query: { page: number; pageSize: number; ruleId?: string; outcome?: string; from?: string; to?: string }) {
  const [data, total] = await Promise.all([
    this.prisma.automationLog.findMany({ /* ... */ }),
    this.prisma.automationLog.count({ where }),
  ]);
  return { data, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
}
```

3. Add CSV export endpoint:
```typescript
@Get('automations/activity/export')
async exportActivityLog(@BusinessId() businessId: string, @Query() query: any, @Res() res: Response) {
  const logs = await this.automationService.getActivityLog(businessId, { ...query, pageSize: 10000 });
  const csv = this.toCsv(logs.data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=automation-activity.csv');
  res.send(csv);
}
```

**Frontend:**
- Add "Export CSV" button (Download icon) in the activity log toolbar
- Show total count: "Showing 1-50 of 342 entries"
- Add proper pagination controls (Previous/Next + page numbers)
- Show page size selector (20/50/100)

**Acceptance criteria:**
- CSV export downloads all matching logs
- Pagination shows total count and page controls
- Page size selectable (20/50/100)
- Export respects current filters (rule, outcome, date range)
```
