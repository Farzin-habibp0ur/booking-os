# Booking Attribution — Definition & Contract

> **Purpose:** Defines exactly how Business Command Centre attributes bookings during the AI Front Desk pilot. This document is the contract: it names the seven attribution reasons, the priority order they're evaluated in, the void scenarios, the baseline capture, and the dashboard methodology that the clinic and BCC both see.
>
> **Audience:** Product, engineering, founder (selling and onboarding), and the clinic's owner-operator. Every screen labelled "captured" or "would have been missed" derives from this contract.
>
> **Last updated:** 2026-05-09 (post AI Front Desk wedge pivot — implementation lives in `apps/api/src/modules/front-desk/front-desk-attribution.service.ts`)

---

## Why this document exists

The pilot's only ROI screen is the two-metric dashboard. Two cards:

1. **Bookings captured** — every booking that flowed through BCC during the period.
2. **Bookings that would have been missed without BCC** — the subset where, without our involvement, the clinic would not have booked the appointment.

Card 2 is the wedge proof. To make that proof defensible, we need a contract that is:

- **Literal** — the seven reason strings are the seven reason strings, no synonyms.
- **Priority-ordered** — first match wins. No double-counting.
- **Visible to both sides** — the clinic and BCC see the same numbers.
- **Conservative** — if there's ambiguity, the booking is `ORGANIC`. We undersell.

Cross-references: [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) (overview), [`docs/PILOT-OPS.md`](PILOT-OPS.md) (concierge playbook), [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) (12-minute demo flow), `BCC-PIVOT-MASTER-PLAN.md` v3 Locked decisions reference.

---

## The seven attribution reasons (verbatim)

These exact strings live in the `attributionReason` column of `FrontDeskAttribution`. Use them literally — do not localize, translate, or paraphrase in code.

| Priority | Reason                 | Match condition                                                                                                                                                                                        |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | `WAITLIST_MATCH`       | The booking has a corresponding `WaitlistEntry.bookingId` pointer back to it. The waitlist agent matched the cancelled slot and the customer accepted.                                                 |
| 2        | `AI_BOOKING`           | `Booking.source = 'AI'`. The booking was created by the AI booking assistant directly (typically multi-turn flow inside a conversation).                                                               |
| 3        | `QUOTE_FOLLOWUP`       | The booking traces back to a `QuoteFollowupAgent` action card (the booking metadata or the waitlist link references the action card the agent generated for an expired/pending quote).                 |
| 4        | `CONSULT_FOLLOWUP`     | The booking is a TREATMENT service within 14 days of a CONSULT booking for the same customer where the consult had no scheduled treatment at the time it completed.                                    |
| 5        | `AFTER_HOURS_AI`       | The originating inbound channel message arrived **outside** `Business.businessHours` AND an AI draft was created for the conversation before staff replied.                                            |
| 6        | `UNANSWERED_THRESHOLD` | The originating inbound channel message went **unanswered for >15 minutes** (first inbound vs first staff reply, on the conversation) before an AI draft was created.                                  |
| 7        | `ORGANIC`              | None of the above. Captured but not "would have been missed." Examples: walk-in, repeat customer texts during business hours and gets an immediate human reply, prior referral with no AI involvement. |

**First match wins.** Evaluate priority 1 → 7 in order. Stop at the first match.

### Why this priority order

1. `WAITLIST_MATCH` is the most concrete: the waitlist entry has a direct booking pointer. No ambiguity.
2. `AI_BOOKING` is the next most concrete: the booking source is literally `AI` in the database.
3. `QUOTE_FOLLOWUP` traces to a specific action card we generated.
4. `CONSULT_FOLLOWUP` is a 14-day windowed match — we want it ahead of `AFTER_HOURS_AI` because consult-to-treatment conversion is the highest-value attribution we can prove.
5. `AFTER_HOURS_AI` and `UNANSWERED_THRESHOLD` are conversation-level "we caught the message you would have missed" attributions. After-hours is more concrete (window-based) than the 15-minute threshold, so it wins.
6. `ORGANIC` is the final fallback. Captured, not would-have-been-missed.

---

## `wouldHaveBeenMissed` derivation

```ts
wouldHaveBeenMissed = (attributionReason !== 'ORGANIC') && (voidedAt IS NULL)
```

Persisted as a boolean column on `FrontDeskAttribution` so the dashboard reads cheaply (no join, no recomputation). When the row is created we set it; when the booking is voided we clear it.

---

## Void scenarios

When a booking is cancelled or no-shows, the attribution is voided so the dashboard reflects reality.

- Booking transitions to `CANCELLED` → set `FrontDeskAttribution.voidedAt = now`, `wouldHaveBeenMissed = false`. The row stays — we keep the trail for audit and analytics — but the dashboard counts it as voided.
- Booking transitions to `NO_SHOW` → same as cancellation.
- Booking gets refunded but stays `COMPLETED` → **no void**. The clinic delivered the service; this is a refund question, not an attribution question.

Implementation: `FrontDeskAttributionService.voidForBooking(bookingId)` — called from the booking status update path. See `apps/api/src/modules/front-desk/front-desk-attribution.service.ts`.

---

## Fresh attribution rules (60-day reset)

A customer's attribution is considered **fresh** (eligible for a new attribution row) when:

- The customer has **no** prior `FrontDeskAttribution` row, OR
- The customer's most recent prior attribution row was **voided** (`voidedAt IS NOT NULL`), OR
- The booking date is **60 or more days** after the customer's most recent un-voided attribution.

Otherwise, the booking is treated as a follow-on appointment from the same wedge moment and does **not** get a new attribution row. We don't double-attribute the same customer for repeat bookings stemming from a single AI interaction.

This rule prevents the dashboard from inflating "would have been missed" numbers by counting the second, third, fourth treatment in a series that all stemmed from one captured Instagram DM.

---

## Baseline capture

Before the pilot starts, the founder captures the clinic's pre-pilot baseline during the concierge call.

- `Business.baselineMonthlyBookings` — typical bookings per month (the clinic's number, written down)
- `Business.baselineMonthlyRevenue` — typical revenue per month
- `Business.baselineCapturedAt` — when we captured it
- `Business.baselineSource = 'concierge_call'` — default; we don't infer baselines from API logs

Why baseline matters:

- It anchors the success scorecard's "≥5 platform bookings (or ≥ baseline ÷ 12 if baseline is small)" check (see [`docs/PILOT-OPS.md`](PILOT-OPS.md)).
- It contextualizes the dashboard for the clinic. "23 bookings captured this month" means more when they know they were doing 60/month before.
- It gives BCC a real number to defend during the continuation conversation.

The clinic owns the baseline. We do not negotiate it. If the owner says 60, we write 60. The honesty is the asset.

---

## Dashboard methodology

The two-metric dashboard reads from `FrontDeskAttribution` rows where `bookingId IS NOT NULL`. Legacy rows from the deployment-era AI-draft attribution writers (rows where `bookingId IS NULL`) are **excluded** — they were attributed at the wrong point and Phase 4 of the pivot moved attribution to the booking-creation hook.

### Card 1: Bookings captured

```
captured.count    = COUNT(rows where voidedAt IS NULL and createdAt in window)
captured.revenue  = SUM(revenueAtBooking) for those rows
```

Revenue dollar = **total paid** for the booking: service price + add-ons + tip. Snapshotted at booking creation time as `revenueAtBooking` (a Decimal column). Subsequent service-price changes don't retroactively change the dashboard number.

### Card 2: Would have been missed

```
wouldHaveBeenMissed.count   = COUNT(rows where wouldHaveBeenMissed = true and voidedAt IS NULL)
wouldHaveBeenMissed.revenue = SUM(revenueAtBooking) for those rows
wouldHaveBeenMissed.byReason = {
  WAITLIST_MATCH: { count, revenue },
  AI_BOOKING: { count, revenue },
  QUOTE_FOLLOWUP: { count, revenue },
  CONSULT_FOLLOWUP: { count, revenue },
  AFTER_HOURS_AI: { count, revenue },
  UNANSWERED_THRESHOLD: { count, revenue },
  ORGANIC: not shown (never appears in this card)
}
```

The byReason breakdown is shown in a tooltip / methodology drawer for transparency.

### Visibility

Both the clinic and BCC see the same dashboard. There is no internal-only version. Trust depends on this. If we ever wanted an internal-only metric, we'd build a separate page with a `SUPER_ADMIN`-gated route — we'd never show the clinic a different number for the same name.

### Refresh cadence

Real-time on row insert / void. The dashboard is read from a tenant-isolated query against `FrontDeskAttribution` filtered by `businessId` and a date window (default last 30 days, configurable).

---

## Decision: do NOT add `WAITLIST` to `BookingSource`

We considered adding a `WAITLIST` value to the `BookingSource` enum so waitlist matches were visible at the booking level. We chose not to. Reasons:

- The relationship is already representable through `WaitlistEntry.bookingId IS NOT NULL`.
- Adding `WAITLIST` would force a migration and a downstream UI change for a derivable signal.
- `BookingSource` is a "how did this booking enter the system" field. `WAITLIST_MATCH` is a "why did we attribute this booking" reason. They're different concerns.

Implementation derives waitlist matches from `WaitlistEntry.bookingId IS NOT NULL` at attribution time. See `FrontDeskAttributionService.createForBooking()`.

---

## Decision: existing `FrontDeskAttribution` columns become legacy

The deployment shipped a `FrontDeskAttribution` model with `source` (e.g. `'AI_DRAFT'`), `status` (`OPEN/BOOKED/WON/LOST`), `reason`, and `estimatedValue`. These are kept for backward-compat as legacy / funnel-view fields and are **not read by the v3 dashboard**.

Phase 1 of the pivot added the v3 fields alongside: `attributionReason`, `wouldHaveBeenMissed`, `voidedAt`, `revenueAtBooking`. The dashboard reads only those.

Existing AI-draft-era attribution rows (which were written from the outbound service on draft creation, not booking creation) do not have the new v3 fields populated. They're effectively orphaned but harmless — the dashboard query filters them out via `bookingId IS NOT NULL`.

The legacy outbound-attribution writers in `apps/api/src/modules/outbound/outbound.service.ts` are commented out (Phase 4) for safe rollback. They will be removed in a future cleanup release.

---

## Pre-pilot baseline rationale

Some clinics will ask: "Why do you need our baseline? Can't you just read it from your system?"

We can't, and we shouldn't. Reasons:

- Until BCC is the system of record for inbound messages, we have no way to know what the clinic was capturing before. The first month's data inside BCC is **not** the pre-BCC baseline — it includes our impact.
- A baseline written down by the owner during the concierge call is **the owner's number**. They believe it. We don't argue with it. That trust is the foundation of the continuation conversation.
- A wrong baseline (high or low) doesn't materially break the contract. The dashboard still reports captured + would-have-been-missed honestly. The baseline is just the comparison anchor for the scorecard.
- Capturing the baseline is also a forcing function — it confirms the owner cares enough to know the number. If they shrug, we have a discovery problem, not a product problem.

---

## Implementation cross-reference

| File                                                                | Responsibility                                                                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/schema.prisma`                                  | `FrontDeskAttribution` model with the v3 columns: `attributionReason`, `wouldHaveBeenMissed`, `voidedAt`, `revenueAtBooking`, `bookingId @unique`. `Business.baseline*`, `businessHours`. |
| `apps/api/src/modules/front-desk/front-desk-attribution.service.ts` | `createForBooking(booking, conversation?)` — priority-ordered reason determination. `voidForBooking(bookingId)`. `getSummary(businessId, days)` — dashboard read.                         |
| `apps/api/src/modules/booking/booking.service.ts`                   | `createBooking()` calls `createForBooking()` inside the same `prisma.$transaction`. Status transitions to `CANCELLED` / `NO_SHOW` call `voidForBooking()`.                                |
| `apps/web/src/app/(protected)/ai/components/ai-value-kpis.tsx`      | The two-metric dashboard component. Renders Card 1 (large) + Card 2 (sub-callout) + methodology tooltip + optional baseline comparison.                                                   |
| `apps/api/src/modules/outbound/outbound.service.ts` lines ~82, ~212 | LEGACY: deployment-era attribution writers, commented out. Slated for removal in next cleanup release.                                                                                    |

---

## What this contract does NOT cover

- **Manual staff override of attribution** — Not supported. Attribution is determined by the priority logic at booking-creation time. If the clinic disputes a specific row, they raise it with BCC support and we can void or annotate manually, but there is no per-row "change reason to X" UI.
- **Cross-clinic attribution** — Not applicable. Multi-tenant isolation means each business has its own `FrontDeskAttribution` rows. We never show one clinic another clinic's data.
- **Channel-level attribution** — Not on the contract. The dashboard rolls up across channels. We can break out by channel in a future drill-down without changing the contract.
- **Counterfactual modeling** — We don't claim "this booking would have happened anyway, here's our credit %." The seven reasons are binary: missed-or-not. Conservative beats clever.

---

## Change log

| Date       | Change                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Initial creation. Codifies the seven-reason contract, void scenarios, fresh-attribution rules, baseline capture, and dashboard methodology shipped in pivot Phase 4. |

---

> **TBD — confirm with founder.** Should the dashboard's default date window be 30 days (current default) or align with `Business.baselineCapturedAt + 30` for pilot tenants? Aligning would make the comparison anchor visually identical, but breaks for post-pilot graduated tenants. Current implementation: 30-day rolling window with optional baseline comparison strip below the cards.
