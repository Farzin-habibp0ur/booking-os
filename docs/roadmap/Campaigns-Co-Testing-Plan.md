# Campaigns Co-Testing Plan

*Use this plan alongside Claude (Cowork) after each phase of implementation. You test in the browser, I verify in code and API.*

---

## How We Work Together

**Your role (browser):** Log in, navigate the UI, click buttons, fill forms, observe behavior, report what you see, share screenshots.

**My role (Cowork):** Read code diffs, run API calls via curl, check database state via Prisma queries, verify test output, confirm i18n keys, review logs.

**After each phase:**
1. You run through the test cases below in the browser
2. Share screenshots or describe what you see for anything that looks off
3. I'll cross-check against the code and API simultaneously
4. We mark each test case pass/fail together before moving to the next phase

**Environment:**
- Login: `https://businesscommandcentre.com` with `sarah@glowclinic.com` / `Bk0s!DemoSecure#2026`
- API base: `https://api.businesscommandcentre.com/api/v1`
- Or use your local dev: `http://localhost:3000` / `http://localhost:3001/api/v1`

---

## Phase 1: Fix Foundations

*Prompts 1.1, 1.2, 1.3 — Scheduling fix, Cancel, Scheduling UX*

### Test 1.1 — SCHEDULED Campaigns Actually Send

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Go to `/campaigns/new` | 4-step wizard loads (Audience, Message, Schedule, Review) | |
| 2 | Step 1: Leave default audience filters, click Next | Audience count shows a number > 0 | |
| 3 | Step 2: Pick WhatsApp channel, type "Hi {{name}}, test campaign" | Merge variable inserts correctly in preview | |
| 4 | Step 3: Select "Schedule for later", pick a time 2 minutes from now | DateTime picker accepts the value | |
| 5 | Step 4: Review screen shows all details, click Create | Campaign created, redirected to detail or list | |
| 6 | On the list page, find the new campaign | Status badge shows **SCHEDULED** with lavender styling | |
| 7 | Wait for the scheduled time to pass (~2 min) | Status transitions to **SENDING** then **SENT** | |
| 8 | Click into the campaign detail page | Stats show sent count > 0 | |

**What I'll verify:** The `processScheduledCampaigns()` cron exists in dispatch service with its own mutex. The `sendCampaign()` guard accepts both DRAFT and SCHEDULED.

### Test 1.2 — Cancel a Campaign

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Create a new campaign and schedule it 10 minutes from now | Status shows SCHEDULED | |
| 2 | Open the campaign detail page | **Cancel Campaign** button is visible (red text, XCircle icon) | |
| 3 | Click "Cancel Campaign" | Confirmation dialog appears: "Cancel this campaign? Messages already sent cannot be undone." | |
| 4 | Confirm the cancellation | Toast "Campaign cancelled", status changes to **CANCELLED** (red badge) | |
| 5 | Verify the Cancel button is now gone | Only Clone button remains for CANCELLED campaigns | |
| 6 | Create another campaign and send it immediately (Send Now) | Status goes to SENDING | |
| 7 | Quickly click Cancel while SENDING | Should succeed — returns `{ cancelled: true, sentCount, cancelledCount }` | |
| 8 | Try to cancel an already SENT campaign | Button should not be visible (only shows for SENDING/SCHEDULED) | |

**What I'll verify:** The `POST /campaigns/:id/cancel` endpoint exists. The race condition guard in `processCampaign()` re-checks status before marking SENT.

### Test 1.3 — Scheduling UX Polish

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Go to `/campaigns/new`, reach Step 3 (Schedule) | Schedule step loads with "Send immediately" / "Schedule for later" options | |
| 2 | Select "Schedule for later", pick a date 3 days out | Below the picker: "This campaign will send on {date} (in 3 days)" in slate-500 text | |
| 3 | Change the time to 20 minutes from now | Warning appears in amber: "Sending soon — make sure your message is ready." | |
| 4 | Go to `/campaigns` list page, find a SCHEDULED campaign | Formatted date appears below the SCHEDULED badge (e.g., "Tue Apr 7, 3:00 PM") | |
| 5 | Click into a SCHEDULED campaign's detail page | Lavender countdown banner at top: "Scheduled — Sends on {date} (in {time})" with Clock icon | |
| 6 | Check for Edit button on SCHEDULED campaign | Edit button visible (Pencil icon) next to Cancel button | |
| 7 | Click Edit | Navigates to `/campaigns/new?edit={id}` (page may not have full edit logic yet — that's OK, just verify navigation) | |

**What I'll verify:** Clock and Pencil icons are imported in `[id]/page.tsx`. Countdown calculation logic handles edge cases (past dates, same day).

---

## Phase 2: Smart A/B Testing & i18n

*Prompts 2.1, 2.2, 2.3, 2.4 — Auto-winner schema, backend, frontend, i18n extraction*

### Test 2.1 — A/B Auto-Winner Schema

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | (I verify) Check schema.prisma for new fields | `winnerMetric`, `testDurationMinutes`, `testAudiencePercent`, `testPhaseEndsAt`, `autoWinnerSelected` exist on Campaign model | |
| 2 | (I verify) Migration file exists | `add_ab_auto_winner_fields` migration present in `packages/db/prisma/migrations/` | |

### Test 2.2 + 2.3 — A/B Auto-Winner (Backend + Frontend)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Go to `/campaigns/new`, Step 2. Toggle on "A/B Test" | Variant A and B editors appear | |
| 2 | Look for "Auto-Winner Settings" section below variants | Toggle "Automatically pick the winning variant" appears (default: off) | |
| 3 | Turn on auto-winner | Three controls appear: Winner metric dropdown, Test duration dropdown, Test audience slider | |
| 4 | Set: Read Rate, 2 hours, 20% | Summary text: "We'll send to 20% of your audience first. After 2 hours, the best-performing variant will be sent to the remaining 80%." | |
| 5 | Complete the wizard and create the campaign | Campaign created with isABTest = true and auto-winner fields populated | |
| 6 | Send the campaign immediately | Detail page shows lavender banner: "A/B Test in Progress" with FlaskConical icon | |
| 7 | (I verify) Check the cron logic | `processABTestResults()` cron exists with its own mutex, queries eligible campaigns | |
| 8 | After test phase ends (or I simulate it) | Winner auto-selected, "Auto-selected winner" badge appears instead of "Winner" | |

**Edge cases to check together:**
- What happens if both variants perform identically? (Should fall back to highest absolute read count)
- Auto-winner disabled: does manual A/B still work exactly as before?

### Test 2.4 — i18n Extraction

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Open `/campaigns` list page | All visible text uses translated strings (no raw English hardcoded) | |
| 2 | Open `/campaigns/new` wizard, go through all 4 steps | Step labels, button text, filter labels, channel names — all translated | |
| 3 | Open `/campaigns/[id]` detail page | Stats labels, action buttons, status text — all use t() calls | |
| 4 | (I verify) Search for hardcoded strings in the 4 campaign files | Zero hardcoded English strings remain | |
| 5 | (I verify) Count i18n keys | en.json and es.json both have ~65+ `campaigns_` prefixed keys | |
| 6 | (Optional) Switch language to Spanish if your UI supports it | All campaign strings appear in Spanish | |

---

## Phase 3: Engagement & Revenue

*Prompts 3.1, 3.2, 3.3, 3.4 — Click tracking, dispatch integration, revenue, frontend*

### Test 3.1 + 3.2 — Click Tracking

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | (I verify) CampaignClick model in schema | Model exists with `id`, `campaignSendId`, `url`, `clickedAt`, `userAgent` | |
| 2 | (I verify) CampaignSend has `openedAt` field | Field exists as `DateTime?` | |
| 3 | (I verify) TrackingModule registered in app.module.ts | Import present | |
| 4 | Create and send a campaign with a URL in the message (e.g., "Visit https://businesscommandcentre.com") | Campaign sends successfully | |
| 5 | (I verify) Check a CampaignSend record's dispatched content | URLs are wrapped with tracking redirects (`/api/v1/t/{trackingId}`) | |
| 6 | (I verify for EMAIL) Check for tracking pixel | Open pixel appended: `<img src=".../api/v1/t/o/{pixelId}" ...>` | |
| 7 | Visit a tracking URL directly in your browser | Redirects (302) to the original URL | |
| 8 | (I verify) Check CampaignClick record was created | Record exists with correct `url`, `clickedAt`, `userAgent` | |

### Test 3.3 — Revenue Attribution

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Open a SENT campaign's detail page | Funnel shows expanded stages: Sent → Delivered → Opened → Read → Clicked → Booked | |
| 2 | Check for Revenue card in the stats grid | 5th card showing "$X" formatted revenue total | |
| 3 | (I verify) Revenue calculation | Uses `service.price` (NOT `booking.price`), sums across attributed bookings within 7-day window | |

### Test 3.4 — Frontend: Engagement + Revenue UI

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | On a SENT campaign detail page, look below the funnel | "Link Performance" section visible (if campaign had URLs) | |
| 2 | Link stats table shows | URL (truncated), Clicks, Unique Clicks, CTR% columns with sage header | |
| 3 | Go to `/campaigns` list page | View toggle visible at top right: "Table" / "Performance" | |
| 4 | Click "Performance" | Bar chart loads (Recharts) showing campaigns sorted by revenue, sage-colored bars | |
| 5 | Click "Table" | Returns to the standard campaign table | |

---

## Phase 4: Messaging Guardrails

*Prompts 4.1, 4.2 — Frequency cap + quiet hours backend and frontend*

### Test 4.1 + 4.2 — Frequency Cap

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Go to Settings page | "Campaign Preferences" section exists | |
| 2 | Toggle on "Limit campaign messages per customer" | Input for max messages (default 3) and dropdown "per week / per month" appear | |
| 3 | Set: max 1 message per week, Save | Toast confirms save | |
| 4 | (I verify) Check Business record | `campaignPreferences` JSON has `{ frequencyCap: { max: 1, period: 'week' } }` | |
| 5 | Send a campaign to all customers | Sends successfully | |
| 6 | Create a second campaign to the same audience | Step 4 (Review) shows amber warning: "X customers will be skipped (frequency cap reached)" | |
| 7 | Send the second campaign | Fewer sends created than the first campaign (capped customers excluded) | |

### Test 4.1 + 4.2 — Quiet Hours

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | In Settings > Campaign Preferences, toggle on "Set quiet hours" | Two time pickers appear (From/To) | |
| 2 | Set quiet hours to cover the current time (e.g., if it's 3 PM, set 2 PM–5 PM) | Save confirms | |
| 3 | Send a campaign immediately | Campaign goes to SENDING but messages don't dispatch | |
| 4 | (I verify) Check API logs | Log message: "Skipping campaign dispatch for {business} during quiet hours" | |
| 5 | Change quiet hours to exclude the current time | Campaign resumes dispatching on the next cron tick | |

---

## Phase 5: Content & Preview

*Prompts 5.1, 5.2 — Preview modal + visual email builder*

### Test 5.1 — Multi-Channel Preview Modal

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Go to `/campaigns/new`, Step 2 (Message) | "Preview" button visible (Eye icon) next to merge variable buttons | |
| 2 | Type a message with merge variables: "Hi {{name}}, your {{service}} at {{business}} is on {{date}} with {{staff}}" | Text entered correctly | |
| 3 | Click "Preview" | Modal opens with 3 device mockups side by side | |
| 4 | WhatsApp preview | Green header, white chat bubble, merge vars replaced with sample data ("Sarah", "Botox Treatment", etc.) | |
| 5 | SMS preview | iOS-style gray bubble with the message | |
| 6 | Email preview | Email client layout with From/Subject/Date header, message body below | |
| 7 | Close the modal (X button or click outside) | Modal closes cleanly | |
| 8 | Go to a DRAFT campaign's detail page | Preview button also available in the actions area | |

### Test 5.2 — Visual Email Builder

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | In `/campaigns/new` Step 2, select Email channel | Toggle appears: "Simple Message" / "Email Designer" | |
| 2 | Click "Email Designer" | Rich editor loads (Unlayer or fallback textarea with markdown) inside a rounded-2xl bordered container | |
| 3 | Compose an email with formatting (headings, images, buttons) | Editor works, content updates | |
| 4 | Switch back to "Simple Message" | Textarea reappears (content may change — verify no crash) | |
| 5 | Select SMS channel | "Email Designer" button becomes disabled (grayed out, cursor-not-allowed) | |
| 6 | Select Multi-Channel | "Email Designer" re-enables | |
| 7 | Create and send an Email campaign with the visual editor | Email dispatches with HTML content (not plain text) | |

---

## Phase 6: Campaign Calendar

*Prompt 6.1 — Calendar view*

### Test 6.1 — Campaign Calendar View

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Go to `/campaigns` list page | View toggle now has 3 options: "Table" / "Performance" / "Calendar" | |
| 2 | Click "Calendar" | Monthly calendar grid appears inside a white rounded-2xl shadow-soft card | |
| 3 | Check the grid | 7 columns (Sun-Sat), header shows month/year, prev/next arrows | |
| 4 | Find today's date | Highlighted with sage ring (ring-2 ring-sage-500) | |
| 5 | Find a date with campaigns | Campaign badges appear as colored pills (status-appropriate colors) | |
| 6 | Hover over a campaign badge | Subtle shadow appears (hover:shadow-sm transition) | |
| 7 | Click a campaign badge | Navigates to the campaign detail page | |
| 8 | Navigate to previous/next month | Calendar updates, campaigns reposition | |
| 9 | Find a date with 3+ campaigns | Shows 2 badges + "+1 more" pill | |
| 10 | Check weekend columns | Slightly different background (bg-slate-50/50) | |

---

## Cross-Cutting Verification (After All Phases)

These tests verify things that span multiple phases or are easy to miss.

### Design System Compliance

| # | Check | Expected |
|---|-------|----------|
| 1 | All new buttons use `rounded-xl` | No sharp-cornered buttons |
| 2 | All new cards use `rounded-2xl shadow-soft` | Consistent with rest of app |
| 3 | AI/intelligent features (A/B test banner, auto-winner) use lavender palette | Not sage or gray |
| 4 | Warning states use amber palette | Not red (red = destructive only) |
| 5 | Cancel/destructive actions use red palette | Consistent with cancel button |
| 6 | Status badge colors unchanged | DRAFT=slate, SCHEDULED=lavender, SENDING=amber, SENT=sage, CANCELLED=red |
| 7 | Font usage: metrics and page titles use `font-serif` (Playfair Display) | Revenue number, page header |
| 8 | All inputs use `bg-slate-50 border-transparent focus:ring-sage-500 rounded-xl` | Consistent with rest of app |

### Data Integrity

| # | Check | How |
|---|-------|-----|
| 1 | Cancelled sends don't reappear | Cancel a campaign, wait 5 min, refresh — stays CANCELLED |
| 2 | Frequency cap counts are accurate | Count CampaignSend records vs. cap, verify skipped = total - capped |
| 3 | Revenue attribution window is 7 days | Create booking 8 days after campaign — should NOT count |
| 4 | Tracking URLs don't break message content | Send campaign with URL, receive message, URL still works |
| 5 | A/B variant distribution is balanced | For 100 sends with 2 variants, each should get ~50 (Fisher-Yates) |

### Multi-Tenancy (Critical)

| # | Check | How |
|---|-------|-----|
| 1 | Campaign data is tenant-isolated | (I verify) Every query filters by businessId |
| 2 | Tracking endpoints don't leak data | Click tracking URL → only creates record, no data in response |
| 3 | Campaign preferences are per-business | Setting frequency cap on Glow Clinic doesn't affect other businesses |
| 4 | Performance endpoint only returns own campaigns | (I verify) GET /campaigns/performance filters by businessId |

### Error Handling

| # | Test | Expected |
|---|------|----------|
| 1 | Try to cancel a DRAFT campaign via API (curl) | Returns 400: "Only sending or scheduled campaigns can be cancelled" |
| 2 | Try to send an already SENT campaign | Returns 400 (guard rejects) |
| 3 | Visit an invalid tracking URL (`/api/v1/t/garbage`) | Returns 400 or 404, doesn't crash |
| 4 | Create campaign with testAudiencePercent = 0 | Should be rejected by DTO validation |
| 5 | Schedule a campaign in the past | Should either reject or send immediately (verify which) |

### Performance

| # | Check | How |
|---|-------|-----|
| 1 | Campaign list loads quickly with 50+ campaigns | No visible spinner longer than 2s |
| 2 | Calendar view renders without lag | Month navigation is instant |
| 3 | Funnel stats don't slow down detail page | Stats load within 1-2s for campaigns with 1000+ sends |
| 4 | Link stats table handles 20+ unique URLs | Table renders without overflow issues |

---

## Phase-by-Phase Checklist Summary

Use this as a quick reference during testing:

| Phase | Feature | UI Test | API Test | Code Review | Tests Pass |
|-------|---------|---------|----------|-------------|------------|
| 1.1 | Scheduling fix | Schedule → wait → sends | Cron processes SCHEDULED | ✓ New cron method | `npm test` |
| 1.2 | Cancel campaign | Cancel button works | POST /cancel returns data | ✓ Race condition guard | `npm test` |
| 1.3 | Scheduling UX | Countdown, dates, Edit btn | N/A | ✓ Icons imported | `npm test` |
| 2.1 | A/B schema | N/A | N/A | ✓ Migration exists | `npm test` |
| 2.2 | A/B backend | N/A | Auto-winner cron works | ✓ rolloutWinner logic | `npm test` |
| 2.3 | A/B frontend | Auto-winner controls | DTO accepts new fields | ✓ FlaskConical imported | `npm test` |
| 2.4 | i18n | All strings translated | N/A | ✓ No hardcoded strings | `npm test` |
| 3.1 | Click schema | N/A | N/A | ✓ CampaignClick model | `npm test` |
| 3.2 | Tracking dispatch | Click a tracked URL | 302 redirect works | ✓ TrackingService injected | `npm test` |
| 3.3 | Revenue | Revenue card shows | GET link-stats, performance | ✓ service.price used | `npm test` |
| 3.4 | Engagement UI | Funnel, link table, chart | N/A | ✓ Recharts imported | `npm test` |
| 4.1 | Guardrails back | Skipped count in review | PATCH campaign-preferences | ✓ quiet hours check | `npm test` |
| 4.2 | Guardrails UI | Settings toggles | N/A | ✓ AlertTriangle imported | `npm test` |
| 5.1 | Preview modal | 3 device mockups | N/A | ✓ New component file | `npm test` |
| 5.2 | Email builder | Rich editor loads | HTML email dispatches | ✓ Unlayer or fallback | `npm test` |
| 6.1 | Calendar | Monthly grid, badges | N/A | ✓ No external lib | `npm test` |

---

## How to Start

1. **Implement Phase 1** using the 3 prompts (1.1, 1.2, 1.3) in Claude Code
2. Come back here and say "Phase 1 is deployed, let's test"
3. I'll run code verification while you go through the UI test cases above
4. We mark everything pass/fail, fix any issues, then move to Phase 2
5. Repeat until all 6 phases are verified

If any test fails, share a screenshot or describe what you see. I'll read the relevant code and help diagnose the issue before you continue.
