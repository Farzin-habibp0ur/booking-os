# Pilot Ops — Concierge Playbook

> **Audience:** Founder running pilots (Year 1, you). Future hires (success ops, founding AE).
> **Purpose:** End-to-end operational playbook for the 30-day, free, concierge AI Front Desk pilot. From "application submitted" through "graduate or kill."
> **Last updated:** 2026-05-09

---

## Pilot frame

| Property            | Value                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Length**          | 30 days                                                                                                                                                         |
| **Cost**            | Free                                                                                                                                                            |
| **Mode**            | Concierge — founder personally onboards, runs weekly check-ins, owns the relationship                                                                           |
| **Slot count**      | 5 simultaneous pilots                                                                                                                                           |
| **ICP**             | US/Canada medical spas, owner-operated, 1–10 locations, $800K–$2.5M revenue, public Instagram presence (see [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) §1) |
| **Decision point**  | After all 5 pilots complete — continue, kill, or iterate before opening more slots                                                                              |
| **Graduation**      | $397/mo single-location, $197/mo per added location, 15% annual discount, flat-rate messaging up to 5K/mo                                                       |
| **Year 2 waitlist** | Non-MED_SPA practice types route to `PilotApplication.status = 'WAITLIST_YEAR_2'` automatically                                                                 |

Cross-references: [`docs/PILOT-SALES-SCRIPT.md`](PILOT-SALES-SCRIPT.md) (pitch + objections), [`docs/AI-FRONT-DESK-OPERATOR-GUIDE.md`](AI-FRONT-DESK-OPERATOR-GUIDE.md) (clinic staff guide), [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md) (the dashboard contract), [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md) (what we do and don't claim), [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) (the 12-minute demo).

---

## Stage 0 — Application received

1. **Application lands** at `/pilot`. The form is rate-limited, honeypot-protected, and requires `practiceType`. The API persists a `PilotApplication` row.
2. **Notification email** fires to `farz@businesscommandcentre.com` (controlled by `PILOT_APPLICATION_NOTIFY_EMAIL`).
3. **Triage in admin** at `/admin/pilot-applications`:
   - If `practiceType === 'MED_SPA'` → "Accept and Provision" button is visible.
   - If `practiceType !== 'MED_SPA'` → "Add to Year 2 Waitlist" button is visible. One click sets `status = 'WAITLIST_YEAR_2'` and sends a polite email.
4. **Reply within 24 hours.** Even if you can't onboard them this week, reply within a day. Silence is the worst outcome.

---

## Stage 1 — Discovery + concierge call (60 minutes)

Schedule the concierge call within 5 business days of application. This is **discovery + demo + onboarding day-1 in one**.

### Pre-call (10 min)

- Read their pilot application end to end. Pull their public Instagram handle, website, Google reviews.
- Note their PMS / booking system (visible from "Book Online" destination on their site).
- Have your screen ready: the production demo tenant logged in, [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) flow ready.

### On the call (45 min)

1. **Discovery first (5 min).** Ask the six discovery questions from [`docs/PILOT-SALES-SCRIPT.md`](PILOT-SALES-SCRIPT.md). Confirm in-ICP. If they're not, redirect to Year 2 waitlist and end politely. Don't run the demo.
2. **Run the 12-minute wedge demo.** Follow `DEMO_SCRIPT.md`. Don't deviate.
3. **Capture the baseline (5 min).** Ask: "What's a typical month for you in bookings? In revenue?" Write down their numbers. These become `Business.baselineMonthlyBookings` and `Business.baselineMonthlyRevenue`. Their number is their number — do not negotiate. (See [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md) §Baseline capture for the rationale.)
4. **Set expectations (5 min).** 30 days, free, concierge. Three success conditions. Continuation conversation in week 4. Kill switch any time. No contract.
5. **Onboarding day-1 plan (5 min).** Walk them through the channel-connect checklist below. Schedule a follow-up if they need to gather credentials (Instagram, WhatsApp Business API, Twilio, etc.).

### Post-call (10 min)

- Click **"Accept and Provision"** in `/admin/pilot-applications`. This creates the `Business`, the Owner-role `Staff`, generates a password-setup token, and sends the welcome email. (Implementation: `acceptApplicationAndProvision()` in `apps/api/src/modules/pilot-application/pilot-application.service.ts`, wrapped in a transaction.)
- Open `/admin/businesses/[id]/baseline` and enter the baseline numbers from the call. Submit.
- Send a recap email. Include: pilot terms (1 paragraph), baseline you captured, link to set their password, link to [`docs/AI-FRONT-DESK-OPERATOR-GUIDE.md`](AI-FRONT-DESK-OPERATOR-GUIDE.md), and the next check-in time.

---

## Stage 2 — Onboarding day-1 checklist

The owner sets their password from the welcome email and lands on the AI Front Desk setup wizard. Walk them through it on a screenshare.

| Step                           | Action                                                                                                                                         | Acceptance                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **1. Channels connected**      | Connect at minimum Instagram + one of {WhatsApp, web chat, SMS, email}. Public Instagram is the primary wedge channel.                         | Owner sees inbound messages land in the BCC inbox in real time during the call.                    |
| **2. Voice set**               | Configure clinic voice in `/ai/settings`. Adjust tone, must-include disclaimers, must-avoid phrases.                                           | At least one AI draft generated during onboarding sounds clinic-safe to the owner.                 |
| **3. Approval mode confirmed** | `autoReply.enabled = false`. All channel overrides default to staff approval.                                                                  | Owner verbally confirms: "I want to approve every reply for now."                                  |
| **4. Waitlist enabled**        | Waitlist configured with offer expiry (default 24h), max offers per slot, quiet hours.                                                         | At least one historical waitlist entry visible if seed data; otherwise empty state with explainer. |
| **5. Baseline captured**       | `Business.baselineMonthlyBookings`, `baselineMonthlyRevenue`, `baselineCapturedAt` populated by founder via `/admin/businesses/[id]/baseline`. | Owner sees the baseline strip on the two-metric dashboard.                                         |

**Do NOT skip the approval-mode confirmation.** Auto-send during pilot is an explicit no. The clinic's trust is built one approved draft at a time. Auto-reply is opt-in per channel after the pilot, once the clinic is comfortable with tone and escalation rules.

End of onboarding day-1: Owner can log in on web and on their phone, at least one channel is wired up, the AI has drafted at least one reply, and the baseline is set.

---

## Stage 3 — Weekly check-ins (15 min each)

Schedule four check-ins, one per week. Calendar invite from the founder. Same Zoom link weekly.

### Week 1 — "Did anything land?"

- Open the inbox together. How many inbound messages this week? How many drafts approved? Any rejected — and why?
- Open the two-metric dashboard. Captured count + would-have-been-missed count. Any voids (cancellations / no-shows)?
- Listen for tone complaints. Adjust voice settings if needed.
- Ask the owner: "What's one thing that surprised you this week?"

### Week 2 — "Are we attributing real money?"

- Drill into the would-have-been-missed card. Show the byReason breakdown (`AFTER_HOURS_AI`, `UNANSWERED_THRESHOLD`, etc.).
- Pick one specific booking and walk through the attribution: "This Thursday 2pm Botox came from a 7:42pm Instagram DM. AI drafted, you approved on your phone, customer confirmed. That's `AFTER_HOURS_AI` and `revenueAtBooking = $350`."
- Surface any data quality issues (mis-routed channels, customer-merge candidates, duplicates).

### Week 3 — "What would break if we left?"

- Discussion question: "If we turned BCC off tomorrow, what would happen?"
- This is the continuation-conversation pre-frame. You're not selling, you're listening. The answer reveals whether the wedge has stuck.
- Look at the success scorecard (next section). Are we tracking to all three?

### Week 4 — Continuation conversation

- Run the success scorecard (see below).
- If all three are green: ask explicitly, "Want to continue?" If yes, send Stripe Checkout. (See Stage 5.)
- If one or two are amber: discuss what went wrong. Was it adoption? Was it message volume? Decide together: extend pilot 2 weeks, kill, or graduate at a partial-trust price.
- If all three are red: thank them, kill cleanly, ask for honest feedback. Don't push.

---

## The success scorecard

All **three** must be true at week 4 for the pilot to graduate.

| Check                             | Threshold                                                                                                                               | Source                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Messages handled in BCC inbox** | ≥ 10 customer messages handled (drafted, approved, sent) during the 30-day pilot                                                        | `/admin/businesses/[id]/pilot-health` "messages handled" metric                                  |
| **Platform bookings**             | ≥ 5 platform bookings (or ≥ baseline ÷ 12 if the baseline is small — for clinics with fewer than 60 bookings/month, prorate to 30 days) | Same admin pilot-health view                                                                     |
| **Continuation agreement**        | Clinic verbally agrees to continue                                                                                                      | The week-4 conversation. There is no UI checkbox for this — it's a conversation outcome you log. |

Bookings count includes both `captured` and `wouldHaveBeenMissed` — the threshold is total platform bookings, not just the missed subset. The "would have been missed" card is the qualitative proof; the bookings threshold is the volume floor.

If the baseline is small (e.g., a clinic doing 30 bookings/month), 5 absolute bookings might be unfairly hard. The fallback: `baseline ÷ 12` rounded up. For a 30-bookings/month baseline, that's 3 bookings in the 30-day pilot window. Use whichever floor is **lower** (3 vs 5) — we want to qualify clinics in, not gate them out.

> **TBD — confirm with founder.** The `baseline ÷ 12` math assumes a 30-day pilot maps to roughly 1/12 of an annualized year. Should we instead use `baseline ÷ 30 × 30` (i.e., a per-day prorate of monthly baseline)? Probably equivalent in practice — confirm.

---

## Stage 4 — Weekly maintenance (founder-side, off-call)

Between check-ins, every week:

- Skim each pilot's pilot-health admin page (10 min × 5 = 50 min/week).
- Check the inbox for any conversations stuck in `WAITING` for >2 hours — surface to the clinic.
- Watch for failed AI processing (action cards generated by the dead-letter queue path). Investigate root cause. (Implementation: `apps/api/src/common/queue/`.)
- Read 5 random AI drafts per pilot. If any are off-tone, message the owner with a "we adjusted X" note before they notice.
- Log notes in the founder's CRM. Trends across pilots are the iteration signal.

---

## Stage 5 — Graduation flow

When the clinic verbally agrees to continue at week 4:

1. **In Stripe Dashboard**, the AI Front Desk monthly product must already exist (env vars `STRIPE_PRICE_ID_AIFD_*`).
2. **Send Stripe Checkout link** for $397/mo (or $197/mo if they're a single secondary location of an existing customer). This is currently a manual step — automated graduation is on the roadmap. (See `BCC-PIVOT-MASTER-PLAN.md` "What this plan does NOT cover.")
3. **Confirm subscription active.** Inside the admin console, the business's Subscription record updates with the new plan.
4. **Update internal tracking.** Mark the pilot as graduated in the CRM. Log the date, the price, and any negotiated terms (annual, multi-location).
5. **Send a "thanks for graduating" email** with: founder's direct cell (yes, really), a link to [`docs/AI-FRONT-DESK-OPERATOR-GUIDE.md`](AI-FRONT-DESK-OPERATOR-GUIDE.md) for any new staff they onboard, and a 30-day check-in calendar invite.

If they don't graduate (kill): send a thank-you email, ask for a 5-minute exit interview, archive the business in admin (don't delete — the data is useful for product feedback). Set a 90-day re-engagement reminder.

---

## Stage 6 — Post-graduation (first 30 days as paying customer)

- Day 1 post-graduation: founder sends "first day as a paid customer" Loom thanking them and reminding them where to find help.
- Day 7: founder texts the owner asking for one piece of feedback.
- Day 14: optional auto-reply unlock conversation. If the clinic's tone trust is high, walk them through enabling auto-reply for one specific channel (usually web chat or SMS). Per-channel toggle in `Business.aiSettings.autoReply.channelOverrides`.
- Day 30: case study request if the numbers warrant it.

---

## When to kill

Kill cleanly and quickly if any of these hit:

- Clinic ghosts after onboarding (no messages handled in 7 days, no replies to founder outreach).
- Clinic actively dislikes the tone of AI drafts and tone tuning hasn't fixed it after two iterations.
- Clinic asks for HIPAA / BAA mid-pilot. Read [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md). Polite decline, kill, route to Year 2 waitlist.
- Clinic asks to restructure the deal (longer pilot, lower price, custom terms). The pilot terms are non-negotiable in Year 1.
- A second clinic in the cohort needs urgent attention and you don't have founder bandwidth. Better to kill the disengaged pilot than half-serve both.

Kill = honest exit interview + thank-you note + archive. No animosity. Some clinics graduate 6 months later. Don't burn bridges.

---

## Founder rituals

Daily (10 min):

- Open `/admin/pilot-applications` — any new applications? Triage.
- Open `/admin/businesses` — any pilot tenants showing red on pilot-health? Investigate.

Weekly (60 min):

- Run all 5 weekly check-ins (15 min × 5 across the week).
- 30 minutes: review founder's CRM notes, surface trends, decide what (if anything) to ship before next week's check-ins.

Monthly:

- Continue/kill review of the 5-pilot cohort.
- Decide whether to open more slots or iterate first.

---

## Operational dependencies

- **Email deliverability**: `EMAIL_FROM=hello@businesscommandcentre.com` with verified DKIM/SPF before any pilot sends. Pilot welcome emails fire from this address.
- **Notification routing**: `PILOT_APPLICATION_NOTIFY_EMAIL=farz@businesscommandcentre.com`. If you change owners, change this env var.
- **Stripe products**: Manually created in Stripe Dashboard before the first paid graduation. Steps in [`docs/STRIPE-SETUP.md`](STRIPE-SETUP.md).
- **Pilot health admin page**: `/admin/businesses/[id]/pilot-health` reads from a SUPER_ADMIN-gated endpoint that reuses front-desk summary logic. (Implementation: `apps/api/src/modules/business/` or admin module — see Phase 3 of `BCC-PIVOT-MASTER-PLAN.md`.)

---

## Change log

| Date       | Change                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Initial creation. Codifies the 30-day concierge pilot ops shipped in pivot Phases 3–6: acceptance flow, baseline capture, weekly check-ins, success scorecard, graduation. |
