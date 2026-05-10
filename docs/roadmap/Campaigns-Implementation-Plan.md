# BookingOS — Campaigns Implementation Plan & Claude Code Prompts

*A complete series of Claude Code prompts to implement the Campaigns UX Specification across 6 phases*

*April 2026 | Confidential*

---

## Table of Contents

1. [How to Use This Document](#1-how-to-use-this-document)
2. [Pre-Implementation Checklist](#2-pre-implementation-checklist)
3. [Phase 1: Fix Foundations](#3-phase-1-fix-foundations)
4. [Phase 2: Smart A/B Testing & i18n](#4-phase-2-smart-ab-testing--i18n)
5. [Phase 3: Engagement & Revenue](#5-phase-3-engagement--revenue)
6. [Phase 4: Messaging Guardrails](#6-phase-4-messaging-guardrails)
7. [Phase 5: Content & Preview](#7-phase-5-content--preview)
8. [Phase 6: Campaign Calendar](#8-phase-6-campaign-calendar)
9. [Post-Implementation Verification](#9-post-implementation-verification)
10. [Quick Reference](#10-quick-reference)

---

## 1. How to Use This Document

This document contains a complete series of Claude Code prompts to implement the Campaigns UX Specification. Each prompt is designed to be copied and pasted directly into your terminal.

**Workflow per prompt:**

- Copy the prompt text (shown in the fenced code block) and paste it into your Claude Code terminal session.
- Claude Code will implement the changes described. Review the output and resolve any issues before moving to the next prompt.
- Each prompt builds on the previous one. Run them in order within each phase.
- After each phase, verify the changes work end-to-end before starting the next phase.
- Every prompt includes explicit instructions for tests, lint checks, and formatting — Claude Code will run the Pre-Commit Checklist automatically.

> **Important:** Each prompt references exact file paths, method names, and line patterns from the current codebase (as of April 2026). If you refactor between phases, file paths may shift — Claude Code will adapt.

> **Convention:** Prompts are written to produce complete, tested, lint-clean commits. Do not skip the test/lint/format steps.

---

## 2. Pre-Implementation Checklist

Before starting Phase 1, ensure your development environment is ready:

| Check | Command | Expected |
|-------|---------|----------|
| Dependencies installed | `npm install` | No errors |
| Database running | `npx prisma db push --schema=packages/db/prisma/schema.prisma` | Applied |
| API starts | `cd apps/api && npm run start:dev` | Listening on port 3001 |
| Web starts | `cd apps/web && npm run dev` | Listening on port 3000 |
| Tests pass | `npm test` | All suites pass |
| Lint clean | `npm run lint` | No errors |

---

## 3. Phase 1: Fix Foundations

Phase 1 fixes two critical bugs: scheduling is broken (SCHEDULED campaigns never transition to SENDING) and there is no way to cancel a campaign. These are blocking issues that undermine user trust.

| Prompt | Description | Files Modified |
|--------|-------------|----------------|
| 1.1 | Fix SCHEDULED campaign processing | campaign-dispatch.service.ts, campaign.service.ts, campaign-dispatch.service.spec.ts, campaign.service.spec.ts |
| 1.2 | Add Cancel Campaign endpoint + UI | campaign.service.ts, campaign.controller.ts, campaigns/[id]/page.tsx, campaign.service.spec.ts, campaign.controller.spec.ts (new: if absent) |
| 1.3 | Scheduling UX improvements | campaigns/new/page.tsx, campaigns/page.tsx, campaigns/[id]/page.tsx |

### Prompt 1.1 — Fix SCHEDULED Campaign Processing

This prompt adds a new cron method to automatically transition SCHEDULED campaigns to SENDING when their scheduled time arrives.

```
In the BookingOS campaigns module, SCHEDULED campaigns never actually send. The dispatch cron at apps/api/src/modules/campaign/campaign-dispatch.service.ts only queries for status: 'SENDING' (line 34-36) and has no logic to process SCHEDULED campaigns.

Fix this by doing the following:

1. In apps/api/src/modules/campaign/campaign-dispatch.service.ts:
   - Add a new @Cron(CronExpression.EVERY_MINUTE) method called processScheduledCampaigns().
   - This method should query for campaigns where status = 'SCHEDULED' AND scheduledAt <= new Date().
   - For each matching campaign, call this.campaignService.sendCampaign(campaign.businessId, campaign.id).
   - Add a mutex guard (similar to the existing 'this.processing' pattern) using a separate 'this.processingScheduled' flag so it doesn't conflict with the existing processSendingCampaigns() mutex.
   - Wrap in try/catch and log errors.

2. In apps/api/src/modules/campaign/campaign.service.ts:
   - Change the sendCampaign() method guard on line 330 from:
     if (campaign.status !== 'DRAFT')
     to:
     if (!['DRAFT', 'SCHEDULED'].includes(campaign.status))
   - This allows the cron to trigger sends for SCHEDULED campaigns.

3. In apps/api/src/modules/campaign/campaign.service.ts:
   - Change the update() method guard on line 101 from:
     if (campaign.status !== 'DRAFT')
     to:
     if (!['DRAFT', 'SCHEDULED'].includes(campaign.status))
   - This allows owners to edit scheduled campaigns before they fire.

4. Write tests:
   - In campaign-dispatch.service.spec.ts: Test that processScheduledCampaigns() finds campaigns with status SCHEDULED and scheduledAt in the past, and calls sendCampaign for each. Test that it does NOT process campaigns with scheduledAt in the future.
   - In campaign.service.spec.ts: Update the sendCampaign test to verify it accepts both DRAFT and SCHEDULED status. Add a test that SENDING/SENT/CANCELLED still throw BadRequestException.
   - In campaign.service.spec.ts: Update the update test to verify it accepts both DRAFT and SCHEDULED status.

5. Run the Pre-Commit Checklist: npm run format && npm run format:check && npm run lint && npm test

Design note: The existing processSendingCampaigns cron handles the batch dispatch once a campaign is in SENDING. This new cron simply promotes SCHEDULED -> SENDING at the right time, then the existing cron takes over for actual message delivery.
```

### Prompt 1.2 — Add Cancel Campaign

This prompt adds the ability to cancel a SENDING or SCHEDULED campaign, stopping undelivered messages.

```
In BookingOS campaigns, there is no way to cancel a campaign once it starts sending. Add a cancel campaign feature:

1. In apps/api/src/modules/campaign/campaign.service.ts, add a new method:
   async cancelCampaign(businessId: string, id: string) {
     - Call this.findById(businessId, id) to get the campaign.
     - Guard: if campaign.status is not 'SENDING' and not 'SCHEDULED', throw BadRequestException('Only sending or scheduled campaigns can be cancelled').
     - Count how many CampaignSend records for this campaign have status 'PENDING'.
     - Update all PENDING CampaignSend records to status 'CANCELLED' using updateMany: prisma.campaignSend.updateMany({ where: { campaignId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } }).
     - Update the campaign status to 'CANCELLED': prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } }).
     - Count how many CampaignSend records have status 'SENT'.
     - Return { cancelled: true, sentCount, cancelledCount }.
   }

2. In apps/api/src/modules/campaign/campaign.controller.ts, add a new endpoint:
   @Post(':id/cancel')
   @Roles('ADMIN')
   cancel(@BusinessId() businessId: string, @Param('id') id: string) {
     return this.campaignService.cancelCampaign(businessId, id);
   }
   Place this BEFORE the existing :id/send endpoint (around line 118).

3. In apps/api/src/modules/campaign/campaign-dispatch.service.ts:
   - In the processCampaign() method, after querying pendingSends and before the "if (pendingSends.length === 0)" block (around line 55), add a re-check:
     const freshCampaign = await this.prisma.campaign.findUnique({ where: { id: campaign.id }, select: { status: true } });
     if (freshCampaign?.status === 'CANCELLED') return;
   - This prevents the race condition where the cron fetches a SENDING campaign, but cancel runs between the fetch and processing.
   - Also, in the "pendingSends.length === 0" block (line 55-66), before marking the campaign as SENT, add the same re-check:
     const currentStatus = await this.prisma.campaign.findUnique({ where: { id: campaign.id }, select: { status: true } });
     if (currentStatus?.status === 'CANCELLED') return;

4. In apps/web/src/app/(protected)/campaigns/[id]/page.tsx:
   - Add a handleCancel function that:
     a. Shows a confirmation dialog with the message: "Cancel this campaign? Messages already sent cannot be undone."
     b. Calls api.post(`/campaigns/${id}/cancel`)
     c. Shows a toast "Campaign cancelled" on success
     d. Refreshes the campaign data
   - Add a Cancel Campaign button visible when campaign.status === 'SENDING' || campaign.status === 'SCHEDULED':
     <button onClick={handleCancel} className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
       <XCircle size={14} /> Cancel Campaign
     </button>
   - Import XCircle from lucide-react (add to the existing import on line 7).
   - Place this button in the actions section (around line 192), after the DRAFT-only buttons block and before the Clone button.

5. Write tests:
   - In campaign.service.spec.ts: Test cancelCampaign() with a SENDING campaign (should succeed, return correct counts). Test with DRAFT campaign (should throw). Test with SENT campaign (should throw).
   - Test the controller endpoint routes correctly.

6. Run: npm run format && npm run format:check && npm run lint && npm test
```

### Prompt 1.3 — Scheduling UX Polish

This prompt adds visual scheduling improvements: countdown timers, schedule date display in the list, and edit/cancel buttons on the detail page.

```
Improve the scheduling UX across the campaigns frontend in BookingOS. All files are in apps/web/src/app/(protected)/campaigns/.

1. In campaigns/new/page.tsx (the wizard):
   - In Step 3 (Schedule), below the existing DateTime picker for scheduledAt, add a live countdown preview.
   - When scheduleType === 'later' and scheduledAt is set, show a small text below the picker:
     "This campaign will send on {formattedDate} (in {relativeTime})"
   - Use a simple relative time calculation (days/hours/minutes from now).
   - If the scheduled time is less than 30 minutes from now, show a warning in amber:
     "Sending soon — make sure your message is ready."
   - Style: text-sm text-slate-500 for normal, text-sm text-amber-600 for the warning.

2. In campaigns/page.tsx (the list page):
   - For campaigns with status SCHEDULED, show the formatted scheduledAt date underneath the status badge in the table.
   - Add a line below the badge: <span className="text-xs text-slate-400 block">{new Date(c.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>

3. In campaigns/[id]/page.tsx (the detail page):
   - For SCHEDULED campaigns, show a countdown at the top of the page (below the title, above the stats):
     <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-4 mb-6 flex items-center gap-3">
       <Clock size={20} className="text-lavender-600" />
       <div>
         <span className="text-sm font-medium text-lavender-900">Scheduled</span>
         <span className="text-sm text-lavender-700 ml-2">Sends on {formattedDate} (in {relativeTime})</span>
       </div>
     </div>
   - Make sure Clock is already imported from lucide-react (it is not currently imported in this file — add it).
   - Add an Edit button for SCHEDULED campaigns (navigates to campaigns/new?edit={id} — you do NOT need to implement the edit page logic in this prompt, just add the button):
     <button onClick={() => router.push(`/campaigns/new?edit=${id}`)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
       <Pencil size={14} /> Edit
     </button>
   - Import Pencil from lucide-react.
   - Place Edit button next to the Cancel button for SCHEDULED campaigns.

4. Run: npm run format && npm run format:check && npm run lint && npm test

Design principles: Use lavender palette for scheduling UI elements (consistent with SCHEDULED badge). Keep countdown text subtle — not a giant timer, just informational text. The warning for <30 min uses amber to draw attention without alarming.
```

---

## 4. Phase 2: Smart A/B Testing & i18n

Phase 2 adds auto-winner selection for A/B tests and extracts all hardcoded strings into the i18n system. This is estimated at 1 sprint.

| Prompt | Description | Files Modified |
|--------|-------------|----------------|
| 2.1 | Add A/B auto-winner database fields | schema.prisma, migration, generate client |
| 2.2 | Backend auto-winner cron + rollout logic | campaign-dispatch.service.ts, campaign.service.ts + specs |
| 2.3 | Frontend A/B auto-winner wizard UX | campaigns/new/page.tsx, campaigns/[id]/page.tsx |
| 2.4 | Extract all campaign strings to i18n | en.json, es.json, all 4 campaign frontend files |

### Prompt 2.1 — A/B Auto-Winner Schema

```
Add new database fields to the Campaign model in BookingOS to support automatic A/B test winner selection.

In packages/db/prisma/schema.prisma, find the Campaign model (around line 704). Add these fields after the existing winnerSelectedAt field (line 721):

  winnerMetric         String?    // READ_RATE or BOOKING_RATE
  testDurationMinutes  Int?       // How long to run test phase (e.g. 120, 360, 720, 1440)
  testAudiencePercent  Int?       @default(20) // % of audience in test phase (10-50)
  testPhaseEndsAt      DateTime?  // When the test phase window closes
  autoWinnerSelected   Boolean    @default(false) // Whether system auto-picked the winner

Then create a migration:
  npx prisma migrate dev --name add_ab_auto_winner_fields --schema=packages/db/prisma/schema.prisma

Then generate the client:
  npx prisma generate --schema=packages/db/prisma/schema.prisma

Run: npm run format && npm run format:check && npm run lint && npm test
```

### Prompt 2.2 — A/B Auto-Winner Backend Logic

```
Implement the backend logic for automatic A/B test winner selection in BookingOS campaigns.

1. In apps/api/src/modules/campaign/campaign.service.ts:
   a. Update sendCampaign() method: When campaign.isABTest is true AND campaign.winnerMetric is set (meaning auto-winner is enabled), calculate testPhaseEndsAt from now + testDurationMinutes. Update the campaign with testPhaseEndsAt. Then, only create CampaignSend records for the testAudiencePercent portion of the audience. Store the full audience customer IDs so the remaining can be used for rollout later.

   Implementation detail: After calling dispatchService.prepareSendsWithVariants(), the sends are already created. For auto-winner mode, the prepareSendsWithVariants should only receive the test portion of customers. Add a new method prepareSendsForTestPhase(campaignId, businessId, filters, variants, testPercent) that:
   - Fetches all matching customers
   - Takes only the first testPercent% (shuffled)
   - Creates CampaignSend records for just those customers
   - Returns { total, testCustomerIds, allCustomerIds }

   b. Add a new method rolloutWinner(businessId: string, campaignId: string, winnerVariantId: string):
   - Fetch all CampaignSend records for this campaign to get the test customer IDs
   - Get the full audience using buildAudienceWhere
   - Filter out customers who already received test sends
   - Create new CampaignSend records for remaining customers with variantId = winnerVariantId and status = PENDING
   - Set campaign status back to SENDING so the dispatch cron picks it up again

2. In apps/api/src/modules/campaign/campaign-dispatch.service.ts:
   a. Add a new @Cron(CronExpression.EVERY_MINUTE) method: processABTestResults().
   - Query campaigns where: status = 'SENT', isABTest = true, autoWinnerSelected = false, testPhaseEndsAt is not null AND testPhaseEndsAt <= now(), winnerVariantId is null.
   - For each campaign:
     - Fetch variant stats using campaignService.getVariantStats()
     - Determine winner based on winnerMetric:
       - READ_RATE: variant with highest read/sent ratio
       - BOOKING_RATE: variant with highest bookings/sent ratio
     - If the best variant has at least 5% higher rate than the next best, auto-select it
     - If inconclusive (less than 5% difference), pick the one with highest absolute read count as fallback
     - Call campaignService.selectWinner(businessId, campaignId, winnerVariantId)
     - Set autoWinnerSelected = true on the campaign
     - Call campaignService.rolloutWinner(businessId, campaignId, winnerVariantId)
   - Use a separate mutex flag this.processingABTests to avoid concurrent runs.

3. Update the prepareSendsWithVariants method in campaign-dispatch.service.ts:
   - Add an optional parameter testPercent?: number
   - When testPercent is provided, only use the first testPercent% of the shuffled customers array
   - Return { total, allCustomerCount } so the caller knows the full audience size

4. Write tests:
   - Test processABTestResults cron picks up eligible campaigns
   - Test that it correctly selects the variant with higher READ_RATE
   - Test that rolloutWinner creates sends for remaining (non-test) customers
   - Test the inconclusive fallback (picks highest absolute read count)
   - Test it skips campaigns where testPhaseEndsAt is in the future

5. Run: npm run format && npm run format:check && npm run lint && npm test
```

### Prompt 2.3 — A/B Auto-Winner Frontend

```
Add the auto-winner A/B testing UX to the BookingOS campaigns frontend.

1. In apps/web/src/app/(protected)/campaigns/new/page.tsx:
   - In Step 2 (Message), when isABTest is true, add a new section below the variant editors titled "Auto-Winner Settings" with a toggle:
     - "Automatically pick the winning variant" toggle (default: off). When on, show:
       a. Dropdown: "Winner metric" with options: "Read Rate" and "Booking Rate". State variable: winnerMetric.
       b. Dropdown: "Test duration" with options: "2 hours" (120), "6 hours" (360), "12 hours" (720), "24 hours" (1440). State variable: testDurationMinutes.
       c. Slider or number input: "Test audience" with range 10-50%, default 20%. State variable: testAudiencePercent.
     - Below the controls, show a summary: "We'll send to {testAudiencePercent}% of your audience first. After {testDuration}, the best-performing variant will be sent to the remaining {100 - testAudiencePercent}%."
   - Add state variables for these: winnerMetric, testDurationMinutes, testAudiencePercent, autoWinnerEnabled.
   - Pass these new fields in the campaign creation API call (the POST /campaigns body) alongside existing fields: winnerMetric, testDurationMinutes, testAudiencePercent.
   - Style: Use a bg-white rounded-2xl shadow-soft p-5 card, same as the existing A/B variant cards. Toggle should use sage colors.

2. In apps/web/src/app/(protected)/campaigns/[id]/page.tsx:
   - When campaign.isABTest && campaign.testPhaseEndsAt && !campaign.winnerVariantId:
     Show a test phase status banner at the top:
     <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-4 mb-6">
       <div className="flex items-center gap-2">
         <FlaskConical size={18} className="text-lavender-600" />
         <span className="text-sm font-medium text-lavender-900">A/B Test in Progress</span>
       </div>
       <p className="text-sm text-lavender-700 mt-1">Test phase ends {relativeTimeToTestPhaseEnds}. Winner will be auto-selected based on {winnerMetric}.</p>
     </div>
   - Import FlaskConical from lucide-react (it's already imported in new/page.tsx but not in [id]/page.tsx).
   - When campaign.autoWinnerSelected is true, show "Auto-selected winner" badge next to the winner variant instead of "Winner".

3. In the CreateCampaignDto (apps/api/src/common/dto/ — find the correct file): add optional fields for winnerMetric, testDurationMinutes, testAudiencePercent. Add class-validator decorators: @IsOptional(), @IsString() for winnerMetric, @IsInt() for the numbers.

4. In apps/api/src/modules/campaign/campaign.service.ts create() method: pass through the new fields when creating the campaign.

5. Run: npm run format && npm run format:check && npm run lint && npm test

Design: The auto-winner toggle should feel like an optional power feature. When off, A/B testing works exactly as before (manual winner selection). The lavender palette for the test-in-progress banner is consistent with AI/intelligent features.
```

### Prompt 2.4 — Campaign i18n Extraction

```
Extract all hardcoded English strings from the BookingOS campaigns pages into the i18n system. Currently only 1 campaign-related key exists in the translation files (the nav label "campaigns": "Campaigns").

The i18n system uses a useI18n hook. Import it with: import { useI18n } from '@/lib/i18n'; and use it as: const { t } = useI18n(); then replace strings with t('key'). The t() function supports {{variable}} interpolation: t('key', { count: 5 }).

1. In apps/web/src/locales/en.json, add a "campaigns" section with all the following keys (nest under the root object alongside existing keys). Use a "campaigns_" prefix for all keys:
   - campaigns_title: "Campaigns"
   - campaigns_create: "Create Campaign"
   - campaigns_empty_title: "No campaigns yet"
   - campaigns_empty_desc: "Create your first campaign to reach your customers"
   - campaigns_name: "Campaign Name"
   - campaigns_status: "Status"
   - campaigns_scheduled: "Scheduled"
   - campaigns_sent: "Sent"
   - campaigns_created: "Created"
   - campaigns_clone: "Clone"
   - campaigns_delete: "Delete"
   - campaigns_send_now: "Send Now"
   - campaigns_cancel: "Cancel Campaign"
   - campaigns_edit: "Edit"
   - campaigns_back: "Back to Campaigns"
   - campaigns_stop_recurrence: "Stop Recurrence"
   - campaigns_step_audience: "Audience"
   - campaigns_step_message: "Message"
   - campaigns_step_schedule: "Schedule"
   - campaigns_step_review: "Review"
   - campaigns_filter_tags: "Tags"
   - campaigns_filter_created_after: "Created After"
   - campaigns_filter_created_before: "Created Before"
   - campaigns_filter_last_visit: "Last Visit (days ago)"
   - campaigns_filter_booking_count_min: "Min Bookings"
   - campaigns_filter_booking_count_max: "Max Bookings"
   - campaigns_filter_no_upcoming: "No Upcoming Booking"
   - campaigns_filter_spent_more: "Spent More Than"
   - campaigns_filter_spent_less: "Spent Less Than"
   - campaigns_filter_exclude_dnd: "Exclude Do Not Message"
   - campaigns_audience_count: "{{count}} customers match"
   - campaigns_save_segment: "Save Segment"
   - campaigns_load_segment: "Load Segment"
   - campaigns_channel_whatsapp: "WhatsApp"
   - campaigns_channel_sms: "SMS"
   - campaigns_channel_email: "Email"
   - campaigns_channel_multi: "Multi-Channel"
   - campaigns_schedule_now: "Send immediately"
   - campaigns_schedule_later: "Schedule for later"
   - campaigns_throttle: "Messages per minute"
   - campaigns_recurrence: "Repeat"
   - campaigns_recurrence_none: "Don't repeat"
   - campaigns_recurrence_weekly: "Weekly"
   - campaigns_recurrence_biweekly: "Every 2 weeks"
   - campaigns_recurrence_monthly: "Monthly"
   - campaigns_ab_test: "A/B Test"
   - campaigns_ab_variant: "Variant"
   - campaigns_ab_add_variant: "Add Variant"
   - campaigns_ab_select_winner: "Select Winner"
   - campaigns_ab_winner: "Winner"
   - campaigns_stat_sent: "Sent"
   - campaigns_stat_delivered: "Delivered"
   - campaigns_stat_read: "Read"
   - campaigns_stat_bookings: "Bookings"
   - campaigns_funnel_title: "Conversion Funnel"
   - campaigns_channel_breakdown: "Channel Breakdown"
   - campaigns_cost_estimate: "Estimated Cost"
   - campaigns_cost_free: "No additional cost (included in plan)"
   - campaigns_merge_customer: "Customer Name"
   - campaigns_merge_service: "Service Name"
   - campaigns_merge_business: "Business Name"
   - campaigns_merge_date: "Next Booking Date"
   - campaigns_merge_staff: "Staff Name"
   - campaigns_confirm_delete: "Delete this campaign?"
   - campaigns_confirm_cancel: "Cancel this campaign? Messages already sent cannot be undone."
   - campaigns_confirm_stop_recurrence: "Stop recurring schedule for this campaign?"
   - campaigns_schedule_warning: "Sending soon — make sure your message is ready."
   - campaigns_creating: "Creating campaign..."
   - campaigns_review_title: "Review & Send"
   (approximately 65 keys total)

2. In apps/web/src/locales/es.json, add the same keys with Spanish translations. Key translations:
   - campaigns_title: "Campañas"
   - campaigns_create: "Crear Campaña"
   - campaigns_empty_title: "Aún no hay campañas"
   - campaigns_empty_desc: "Crea tu primera campaña para llegar a tus clientes"
   - campaigns_send_now: "Enviar Ahora"
   - campaigns_cancel: "Cancelar Campaña"
   - (translate all 65 keys to Spanish)

3. In all 4 campaign frontend files, add the useI18n import and replace hardcoded strings with t() calls:
   - apps/web/src/app/(protected)/campaigns/page.tsx
   - apps/web/src/app/(protected)/campaigns/new/page.tsx
   - apps/web/src/app/(protected)/campaigns/[id]/page.tsx
   - apps/web/src/components/campaign-filter-builder.tsx

4. Run: npm run format && npm run format:check && npm run lint && npm test

Important: Do NOT remove any existing keys from en.json or es.json. Only add new keys. The existing "campaigns" key (line 66 of en.json) maps to the nav label — keep it and add the new keys alongside it with the campaigns_ prefix.
```

---

## 5. Phase 3: Engagement & Revenue

Phase 3 adds click/open tracking and revenue attribution. This is estimated at 2 sprints due to the new database model and tracking infrastructure.

| Prompt | Description | Files Modified |
|--------|-------------|----------------|
| 3.1 | Click tracking schema + tracking service | schema.prisma, migration, new tracking module |
| 3.2 | Tracking integration into dispatch | campaign-dispatch.service.ts, tracking.service.ts |
| 3.3 | Revenue attribution in funnel stats | campaign.service.ts, campaign.controller.ts + specs |
| 3.4 | Frontend: expanded funnel + revenue + link stats | campaigns/[id]/page.tsx, campaigns/page.tsx |

### Prompt 3.1 — Click Tracking Schema + Module

```
Add click and open tracking infrastructure to BookingOS campaigns.

1. In packages/db/prisma/schema.prisma, add a new model after CampaignSend (around line 753):

model CampaignClick {
  id             String   @id @default(cuid())
  campaignSendId String
  url            String
  clickedAt      DateTime @default(now())
  userAgent      String?

  campaignSend CampaignSend @relation(fields: [campaignSendId], references: [id])

  @@index([campaignSendId])
  @@map("campaign_clicks")
}

2. Add to the CampaignSend model (around line 738):
   - Add field: openedAt DateTime?
   - Add relation: clicks CampaignClick[]

3. Run migration:
   npx prisma migrate dev --name add_campaign_click_tracking --schema=packages/db/prisma/schema.prisma
   npx prisma generate --schema=packages/db/prisma/schema.prisma

4. Create a new NestJS module: apps/api/src/modules/tracking/
   - tracking.module.ts: imports nothing special, provides TrackingService, exports it. Register TrackingController.
   - tracking.controller.ts:
     @Controller('t')
     export class TrackingController {
       @Get(':trackingId')
       async track(@Param('trackingId') trackingId: string, @Headers('user-agent') userAgent: string, @Res() res: Response) {
         const result = await this.trackingService.recordClick(trackingId, userAgent);
         return res.redirect(302, result.url);
       }

       @Get('o/:pixelId')
       async trackOpen(@Param('pixelId') pixelId: string, @Res() res: Response) {
         await this.trackingService.recordOpen(pixelId);
         // Return 1x1 transparent GIF
         const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
         res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
         return res.send(pixel);
       }
     }
   - tracking.service.ts:
     - generateTrackingUrl(campaignSendId: string, originalUrl: string, baseUrl: string): string
       Creates a tracking ID (cuid or UUID), stores the mapping in database, returns the redirect URL.
       The mapping should be stored: create a simple key-value using CampaignClick with a unique trackingId.
       Actually, simpler approach: encode campaignSendId + URL into the trackingId (base64url of JSON), so no pre-registration is needed.
       trackingId = Buffer.from(JSON.stringify({ s: campaignSendId, u: originalUrl })).toString('base64url')
       Return: {baseUrl}/api/v1/t/{trackingId}
     - recordClick(trackingId: string, userAgent?: string): { url: string }
       Decode trackingId, create CampaignClick record, return original URL.
     - recordOpen(pixelId: string): void
       pixelId = base64url-encoded campaignSendId. Update CampaignSend.openedAt = new Date() if not already set.
     - generateTrackingPixel(campaignSendId: string, baseUrl: string): string
       Returns HTML img tag: <img src="{baseUrl}/api/v1/t/o/{pixelId}" width="1" height="1" style="display:none" />
     - wrapUrlsInContent(content: string, campaignSendId: string, baseUrl: string): string
       Find all URLs in content (regex for https?://...) and replace with tracking URLs.

5. Register the TrackingModule in apps/api/src/app.module.ts.

6. Write tests for TrackingService: test URL wrapping, test click recording creates CampaignClick, test open recording sets openedAt.

7. Run: npm run format && npm run format:check && npm run lint && npm test

Note: The tracking endpoints (/t/:trackingId and /t/o/:pixelId) are public — no auth guards. They need to work when clicked from any email client or messaging app. Add rate limiting: @Throttle({ default: { ttl: 60000, limit: 100 } }).

Update CLAUDE.md: increment the module count from 80 to 81.
```

### Prompt 3.2 — Tracking Integration into Dispatch

```
Integrate click/open tracking into the BookingOS campaign dispatch pipeline.

1. In apps/api/src/modules/campaign/campaign.module.ts:
   - Import TrackingModule and add to imports array.

2. In apps/api/src/modules/campaign/campaign-dispatch.service.ts:
   - Inject TrackingService in the constructor.
   - In the processCampaign() method, after rendering the message content with renderTemplate() (around line 118-124):
     a. Wrap URLs in the message content for click tracking:
        const trackedContent = this.trackingService.wrapUrlsInContent(messageContent, send.id, process.env.API_URL || 'https://api.businesscommandcentre.com');
     b. For EMAIL channel only, append the open tracking pixel:
        const finalContent = channel === 'EMAIL'
          ? trackedContent + this.trackingService.generateTrackingPixel(send.id, process.env.API_URL || 'https://api.businesscommandcentre.com')
          : trackedContent;
     c. Use finalContent instead of messageContent when enqueuing to the notification queue.

3. Write tests:
   - In campaign-dispatch.service.spec.ts: Mock TrackingService. Test that wrapUrlsInContent is called for every send. Test that generateTrackingPixel is only called for EMAIL channel sends.

4. Run: npm run format && npm run format:check && npm run lint && npm test
```

### Prompt 3.3 — Revenue Attribution

```
Add revenue attribution and link performance stats to BookingOS campaign analytics.

1. In apps/api/src/modules/campaign/campaign.service.ts:
   a. Update getFunnelStats() method (around line 475):
      - After counting booked (line 509-518), also sum booking revenue. IMPORTANT: The Booking model does NOT have a price field — price is on the Service model (service.price). To get revenue, fetch the attributed bookings with their service relation and sum the service prices:
        const attributedBookings = campaign.sentAt && sevenDaysAfterSend
          ? await this.prisma.booking.findMany({
              where: { businessId, customerId: { in: customerIds }, createdAt: { gte: campaign.sentAt, lte: sevenDaysAfterSend } },
              include: { service: { select: { price: true } } },
            })
          : [];
        const revenueTotal = attributedBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);
      - Add to the return: revenueTotal
      - Add two new stages at the end of the stages array:
        Check if CampaignSend model has openedAt:
        { label: 'Opened', count: openedCount, percentage: ... } (between Delivered and Read)
        { label: 'Clicked', count: clickedCount, percentage: ... } (between Opened/Read and Booked)
      - Query openedCount: count CampaignSend where campaignId AND openedAt is not null
      - Query clickedCount: count distinct CampaignClick.campaignSendId where the CampaignSend.campaignId matches

   b. Add new method getLinkStats(businessId: string, campaignId: string):
      - Verify campaign belongs to business
      - Query CampaignClick records grouped by url
      - Return: array of { url, totalClicks, uniqueClicks (distinct campaignSendId), ctr (uniqueClicks / totalSent * 100) }

   c. Add new method getPerformanceSummary(businessId: string):
      - Query all SENT campaigns for this business
      - For each, get: sentCount, revenue (from attributed bookings), cost (from stats JSON if present)
      - Return array sorted by revenue descending

2. In apps/api/src/modules/campaign/campaign.controller.ts:
   - Add GET ':id/link-stats' endpoint calling getLinkStats
   - Add GET 'performance' endpoint (static route, place BEFORE :id routes) calling getPerformanceSummary

3. Write tests covering:
   - getFunnelStats returns revenueTotal
   - getLinkStats groups clicks by URL correctly
   - getPerformanceSummary returns campaigns sorted by revenue

4. Run: npm run format && npm run format:check && npm run lint && npm test
```

### Prompt 3.4 — Frontend: Engagement + Revenue UI

```
Update the BookingOS campaigns frontend to display engagement tracking and revenue data.

1. In apps/web/src/app/(protected)/campaigns/[id]/page.tsx:
   a. Update the stats grid from 4 cards to 5:
      - Current: Sent, Delivered, Read, Bookings
      - New: Sent, Delivered, Read, Bookings, Revenue
      - The Revenue card should display the currency-formatted total:
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">{t('campaigns_stat_revenue')}</p>
          <p className="text-2xl font-serif font-bold text-sage-600 mt-1">${funnelStats?.revenueTotal?.toLocaleString() || '0'}</p>
        </div>

   b. Update the funnel visualization:
      - The existing funnel shows 4 stages (Sent, Delivered, Read, Booked).
      - Now it should show all stages returned from the API (which may include Opened and Clicked).
      - The funnel already renders from funnelStats.stages array, so this should work automatically as long as the frontend iterates over all stages.

   c. Add a new "Link Performance" section below the funnel (only visible when link stats exist):
      - Fetch link stats: api.get(`/campaigns/${id}/link-stats`).then(setLinkStats)
      - Display as a table with columns: URL (truncated to 40 chars), Clicks, Unique Clicks, CTR%
      - Style: bg-white rounded-2xl shadow-soft overflow-hidden, table with sage header row.
      - Only show this section if linkStats?.length > 0.

   d. Add linkStats state variable and fetch in useEffect alongside other stats.

2. In apps/web/src/app/(protected)/campaigns/page.tsx:
   a. Add a view toggle at the top right: "Table" / "Performance" buttons.
   - State: const [view, setView] = useState<'table' | 'performance'>('table');
   - Table view: existing table (no changes).
   - Performance view: fetch api.get('/campaigns/performance'), show a bar chart using Recharts (already a project dependency):
     import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
     Show horizontal bars with campaign name on Y-axis and revenue on X-axis.
     Each bar should be filled with sage-500 (#8AA694).
   - The toggle buttons style: active = bg-sage-600 text-white rounded-lg px-3 py-1.5, inactive = text-slate-500 hover:bg-slate-100 rounded-lg px-3 py-1.5.

3. Add i18n keys for new strings:
   - campaigns_stat_revenue: "Revenue" / "Ingresos"
   - campaigns_link_performance: "Link Performance" / "Rendimiento de Enlaces"
   - campaigns_link_url: "URL"
   - campaigns_link_clicks: "Clicks"
   - campaigns_link_unique: "Unique Clicks" / "Clics Únicos"
   - campaigns_link_ctr: "CTR%"
   - campaigns_view_table: "Table" / "Tabla"
   - campaigns_view_performance: "Performance" / "Rendimiento"
   Add to both en.json and es.json.

4. Run: npm run format && npm run format:check && npm run lint && npm test
```

---

## 6. Phase 4: Messaging Guardrails

Phase 4 adds frequency caps and quiet hours to protect customers from over-messaging. Estimated at 1 sprint.

### Prompt 4.1 — Campaign Preferences Schema + Backend

```
Add messaging guardrails (frequency cap + quiet hours) to BookingOS campaigns.

1. In packages/db/prisma/schema.prisma:
   - Add to the Business model: campaignPreferences Json? (add after the existing policySettings field)
   - The JSON shape will be: { frequencyCap: { max: number, period: 'week' | 'month' }, quietHours: { start: string, end: string, timezone: string } }
   - Run migration: npx prisma migrate dev --name add_campaign_preferences --schema=packages/db/prisma/schema.prisma
   - Generate client: npx prisma generate --schema=packages/db/prisma/schema.prisma

2. In apps/api/src/modules/campaign/campaign.service.ts:
   a. Add method getFrequencyCapExclusions(businessId: string, customerIds: string[]): Promise<string[]>
      - Fetch business.campaignPreferences
      - If no frequencyCap is set, return empty array (no exclusions)
      - For each customer in customerIds, count CampaignSend records with status in ['SENT','DELIVERED','READ'] created within the cap period (last 7 days for 'week', last 30 days for 'month')
      - Return the IDs of customers who have already reached the cap

   b. Update previewAudience() to also return skippedCount:
      - After building the audience, call getFrequencyCapExclusions
      - Return { count: totalMatching, skippedCount: cappedCustomers.length, effectiveCount: totalMatching - cappedCustomers.length, samples }

   c. Update sendCampaign() to exclude frequency-capped customers:
      - Before creating CampaignSend records, call getFrequencyCapExclusions to remove capped customers from the send list

3. In apps/api/src/modules/campaign/campaign-dispatch.service.ts:
   a. In processCampaign(), before sending each batch:
      - Fetch the business's campaignPreferences
      - If quietHours is set, check if current time (in the business's timezone) is within quiet hours
      - If in quiet hours, skip this batch (return early, the cron will try again next minute)
      - Log: "Skipping campaign dispatch for {businessName} during quiet hours"

4. Add a settings endpoint for campaign preferences:
   - In apps/api/src/modules/business/business.controller.ts (or wherever business settings are managed):
     @Patch('campaign-preferences')
     @Roles('ADMIN')
     updateCampaignPreferences(@BusinessId() businessId: string, @Body() body: any) {
       return this.businessService.updateCampaignPreferences(businessId, body);
     }
   - In business.service.ts: add the updateCampaignPreferences method that validates and saves the JSON.

5. Write tests:
   - Test getFrequencyCapExclusions correctly counts recent sends per customer
   - Test that previewAudience returns skippedCount
   - Test quiet hours check: in quiet hours -> skip, outside -> proceed

6. Run: npm run format && npm run format:check && npm run lint && npm test
```

### Prompt 4.2 — Guardrails Frontend

```
Add the campaign guardrails UI to BookingOS.

1. In apps/web/src/app/(protected)/settings/page.tsx (or the appropriate settings page):
   - Add a new "Campaign Preferences" section with:
     a. Frequency Cap:
        - Toggle: "Limit campaign messages per customer" (default off)
        - When on: number input "Max messages" (default 3) + dropdown "per week / per month"
        - Style: bg-white rounded-2xl shadow-soft p-5 card, inputs use bg-slate-50 border-transparent focus:ring-sage-500 rounded-xl
     b. Quiet Hours:
        - Toggle: "Set quiet hours (no campaign sends)" (default off)
        - When on: two time pickers "From" and "To" (e.g., 9:00 PM to 8:00 AM)
        - Style: same card pattern
   - Save button calls PATCH /business/campaign-preferences with the JSON payload.

2. In apps/web/src/app/(protected)/campaigns/new/page.tsx:
   - In Step 4 (Review), after the cost estimate section:
     - If the audience preview returned a skippedCount > 0, show a warning banner:
       <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
         <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
         <p className="text-sm text-amber-700">{skippedCount} customers will be skipped (frequency cap reached). Effective audience: {effectiveCount}.</p>
       </div>
     - Import AlertTriangle from lucide-react.

3. Add i18n keys:
   - campaigns_frequency_cap: "Frequency Cap" / "Límite de Frecuencia"
   - campaigns_quiet_hours: "Quiet Hours" / "Horario de Silencio"
   - campaigns_cap_warning: "{{count}} customers will be skipped (frequency cap reached)" / "{{count}} clientes serán omitidos (límite de frecuencia alcanzado)"
   - campaigns_cap_toggle: "Limit campaign messages per customer" / "Limitar mensajes de campaña por cliente"
   - campaigns_quiet_toggle: "Set quiet hours" / "Establecer horario de silencio"
   - campaigns_quiet_from: "From" / "Desde"
   - campaigns_quiet_to: "To" / "Hasta"
   - campaigns_per_week: "per week" / "por semana"
   - campaigns_per_month: "per month" / "por mes"
   Add to both en.json and es.json.

4. Run: npm run format && npm run format:check && npm run lint && npm test
```

---

## 7. Phase 5: Content & Preview

Phase 5 adds the visual email builder and multi-channel preview modal. This is the largest phase, estimated at 3 sprints.

### Prompt 5.1 — Multi-Channel Preview Modal

```
Add a multi-channel preview modal to the BookingOS campaigns wizard.

1. Create a new component: apps/web/src/components/campaign-preview-modal.tsx
   - Props: isOpen: boolean, onClose: () => void, content: string, channel: string, businessName: string
   - The modal shows three device mockups side by side in a responsive grid (stacks on mobile):

   a. WhatsApp Preview:
      - Green header bar with business name
      - Chat bubble with the message content (white bg, rounded-xl, shadow-sm)
      - Gray background (#ECE5DD)
      - Timestamp at bottom of bubble

   b. SMS Preview:
      - iOS-style message bubble (blue bg for sent, gray for received)
      - Show as gray/received bubble with the message content
      - Light gray background

   c. Email Preview:
      - Email client mockup with From/Subject/Date header
      - Message body below the header
      - White background with border

   - Each preview fills merge variables with sample data: "Sarah", "Botox Treatment", businessName, "Mon Apr 14, 10:00 AM", "Dr. Smith"
   - Style: Modal overlay with bg-black/50, content card max-w-5xl bg-white rounded-2xl shadow-soft p-6
   - Close button (X) in top right

2. In apps/web/src/app/(protected)/campaigns/new/page.tsx:
   - In Step 2 (Message), add a "Preview" button next to the merge variable buttons:
     <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
       <Eye size={14} /> Preview
     </button>
   - Import Eye from lucide-react.
   - Add state: const [showPreview, setShowPreview] = useState(false);
   - Render the preview modal: <CampaignPreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} content={activeVariantContent} channel={channel} businessName="Your Business" />

3. In apps/web/src/app/(protected)/campaigns/[id]/page.tsx:
   - Add a Preview button for DRAFT and SCHEDULED campaigns in the actions area.

4. Write a basic component test for campaign-preview-modal.tsx.

5. Run: npm run format && npm run format:check && npm run lint && npm test

Design: The preview mockups should look like actual device screens. Use subtle shadows and rounded corners. The WhatsApp mockup should use WhatsApp's actual chat bubble colors. Keep the preview read-only — no editing from the preview modal.
```

### Prompt 5.2 — Visual Email Builder

This is the most complex prompt in the series. It integrates an email editor library for rich email composition.

```
Add a visual email builder to the BookingOS campaigns wizard for Email and Multi-channel campaigns.

1. Install the email editor dependency in the web app:
   cd apps/web && npm install react-email-editor @types/react-email-editor --save

2. Create apps/web/src/components/campaign-email-editor.tsx:
   - Wrapper component around react-email-editor (Unlayer)
   - Props: initialDesign?: object, onChange: (html: string, design: object) => void
   - On mount, load the editor with the initial design (if editing) or a blank template
   - On every change, call onChange with the exported HTML and the design JSON
   - The design JSON is saved alongside the campaign variant content (so it can be re-edited later)
   - Style the editor container: rounded-2xl overflow-hidden border border-slate-200, height 500px

3. In apps/web/src/app/(protected)/campaigns/new/page.tsx:
   - In Step 2 (Message), add a toggle between "Simple Message" and "Email Designer":
     <div className="flex gap-2 mb-4">
       <button onClick={() => setEditorMode('simple')} className={cn('px-3 py-1.5 text-sm rounded-lg', editorMode === 'simple' ? 'bg-sage-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
         Simple Message
       </button>
       <button onClick={() => setEditorMode('visual')} disabled={channel !== 'EMAIL' && channel !== 'MULTI'} className={cn('px-3 py-1.5 text-sm rounded-lg', editorMode === 'visual' ? 'bg-sage-600 text-white' : 'text-slate-500 hover:bg-slate-100', channel !== 'EMAIL' && channel !== 'MULTI' && 'opacity-50 cursor-not-allowed')}>
         Email Designer
       </button>
     </div>
   - When editorMode === 'visual', render CampaignEmailEditor instead of the textarea
   - The visual editor is only available when channel is EMAIL or MULTI
   - State: const [editorMode, setEditorMode] = useState<'simple' | 'visual'>('simple');
   - When switching to visual mode for the first time and channel is EMAIL, auto-switch to visual
   - Store the design JSON in variant.design (alongside variant.content which stores the HTML)

4. In the campaign creation/update API calls, include the design JSON in the variants array.

5. In apps/api/src/modules/campaign/campaign-dispatch.service.ts:
   - When dispatching EMAIL channel sends, if the variant has HTML content (starts with '<'), use it directly as the email body rather than wrapping in plain text.

6. Write tests:
   - Test CampaignEmailEditor component renders (mock react-email-editor)
   - Test the toggle shows/hides correctly based on channel

7. Run: npm run format && npm run format:check && npm run lint && npm test

Note: If react-email-editor is too heavy or causes issues, a fallback approach is to use a textarea with markdown support and convert to HTML at send time. The prompt works either way — Claude Code should handle dependency issues gracefully.
```

---

## 8. Phase 6: Campaign Calendar

Phase 6 adds a calendar view of campaigns. This is estimated at 1 sprint.

### Prompt 6.1 — Campaign Calendar View

```
Add a calendar view to the BookingOS campaigns list page.

1. In apps/web/src/app/(protected)/campaigns/page.tsx:
   - Add a third view option to the existing view toggle: "Table" / "Performance" / "Calendar"
   - Calendar view shows a monthly grid with campaigns placed on their scheduled or sent dates.

   Implementation:
   a. Create a simple monthly calendar grid component inline (no external calendar library needed):
      - Header: month/year with previous/next month arrows
      - Grid: 7 columns (Sun-Sat), 5-6 rows
      - Each day cell shows campaign badges (max 2 visible + "+N more" pill if overflow)
      - Campaign badges show: name (truncated), channel icon, and a colored dot for status
      - Badge colors: DRAFT = slate, SCHEDULED = lavender, SENDING = amber, SENT = sage, CANCELLED = red (matching existing statusColors)

   b. Click a campaign badge to navigate to the campaign detail page (router.push).

   c. Data: use the existing campaigns list data. Place each campaign on:
      - scheduledAt date if status is SCHEDULED
      - sentAt date if status is SENT or SENDING
      - createdAt date if status is DRAFT
      - Use the campaign's scheduledAt || sentAt || createdAt to determine placement

   d. Style:
      - Calendar grid: bg-white rounded-2xl shadow-soft overflow-hidden
      - Day cells: min-h-24, border-r border-b border-slate-100
      - Today's date: ring-2 ring-sage-500 rounded
      - Weekend columns: bg-slate-50/50
      - Campaign badges: text-xs px-2 py-1 rounded-lg truncate, max-width 100%, cursor-pointer hover:shadow-sm transition

2. Add i18n keys:
   - campaigns_view_calendar: "Calendar" / "Calendario"
   - campaigns_calendar_today: "Today" / "Hoy"
   - campaigns_calendar_more: "+{{count}} more" / "+{{count}} más"
   Add to both en.json and es.json.

3. Run: npm run format && npm run format:check && npm run lint && npm test

Design: The calendar should feel lightweight and informational — not a full-featured calendar app. It's a visual way to see campaign density over time and avoid clustering too many sends in one week. Match the existing BookingOS design: rounded-2xl cards, sage/lavender palette, shadow-soft.
```

---

## 9. Post-Implementation Verification

After completing all phases, run this final verification prompt:

```
Run a complete verification of the BookingOS campaigns implementation:

1. Pre-Commit Checklist:
   npm run format
   npm run format:check
   npm run lint
   npm test

2. Verify all new database models exist:
   - CampaignClick model in schema.prisma
   - Campaign model has new fields: winnerMetric, testDurationMinutes, testAudiencePercent, testPhaseEndsAt, autoWinnerSelected
   - CampaignSend has openedAt field
   - Business has campaignPreferences field

3. Verify all new endpoints respond:
   - POST /campaigns/:id/cancel (returns 200 for SENDING campaigns)
   - GET /campaigns/:id/link-stats (returns array)
   - GET /campaigns/performance (returns array)
   - GET /t/:trackingId (returns 302 redirect)

4. Verify frontend pages render without errors:
   - /campaigns (list with Table/Performance/Calendar views)
   - /campaigns/new (wizard with A/B auto-winner controls, preview modal, email designer toggle)
   - /campaigns/:id (detail with revenue card, link stats, cancel button, scheduled countdown)

5. Verify i18n:
   - All campaign strings use t() calls
   - en.json and es.json both have all campaigns_ prefixed keys
   - No hardcoded English strings remain in the 4 campaign frontend files

6. Run the self-review loop skill and security-review skill as per CLAUDE.md requirements.

7. Count and report: total new endpoints, total new i18n keys, total new database fields, total new/modified test files.
```

---

## 10. Quick Reference

### 10.1 File Path Reference

| Component | File Path |
|-----------|-----------|
| Campaign Service | `apps/api/src/modules/campaign/campaign.service.ts` |
| Campaign Controller | `apps/api/src/modules/campaign/campaign.controller.ts` |
| Campaign Dispatch Service | `apps/api/src/modules/campaign/campaign-dispatch.service.ts` |
| Campaign Module | `apps/api/src/modules/campaign/campaign.module.ts` |
| Saved Segment Service | `apps/api/src/modules/campaign/saved-segment.service.ts` |
| Prisma Schema | `packages/db/prisma/schema.prisma` |
| Campaign List Page | `apps/web/src/app/(protected)/campaigns/page.tsx` |
| New Campaign Wizard | `apps/web/src/app/(protected)/campaigns/new/page.tsx` |
| Campaign Detail Page | `apps/web/src/app/(protected)/campaigns/[id]/page.tsx` |
| Filter Builder Component | `apps/web/src/components/campaign-filter-builder.tsx` |
| English Translations | `apps/web/src/locales/en.json` |
| Spanish Translations | `apps/web/src/locales/es.json` |
| App Module (register new modules) | `apps/api/src/app.module.ts` |
| DTOs | `apps/api/src/common/dto/` |
| Design Tokens | `apps/web/src/lib/design-tokens.ts` |

### 10.2 Existing Status Colors (do not change)

| Status | Tailwind Classes |
|--------|-----------------|
| DRAFT | `bg-slate-100 text-slate-600` |
| SCHEDULED | `bg-lavender-100 text-lavender-700` |
| SENDING | `bg-amber-100 text-amber-700` |
| SENT | `bg-sage-100 text-sage-700` |
| CANCELLED | `bg-red-100 text-red-700` |

### 10.3 Existing Merge Variables (5)

| Variable | Resolves To |
|----------|-------------|
| `{{name}}` | Customer name |
| `{{service}}` | Last booked service name |
| `{{business}}` | Business name |
| `{{date}}` | Last booking date (misleadingly named nextBookingDate in dispatch code) |
| `{{staff}}` | Last booking staff member name |

### 10.4 Phase Summary

| Phase | Prompts | Sprint Est. | Key Deliverable |
|-------|---------|-------------|-----------------|
| 1: Fix Foundations | 1.1, 1.2, 1.3 | 1 sprint | SCHEDULED campaigns work + Cancel feature |
| 2: Smart Testing + i18n | 2.1, 2.2, 2.3, 2.4 | 1 sprint | Auto A/B winner + full i18n |
| 3: Engagement + Revenue | 3.1, 3.2, 3.3, 3.4 | 2 sprints | Click tracking + revenue attribution |
| 4: Guardrails | 4.1, 4.2 | 1 sprint | Frequency cap + quiet hours |
| 5: Content + Preview | 5.1, 5.2 | 3 sprints | Preview modal + email builder |
| 6: Calendar | 6.1 | 1 sprint | Campaign calendar view |

Total: 13 prompts across 6 phases. Estimated 9 sprints.
