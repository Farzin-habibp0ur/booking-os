# Sales Demo Plan — AI Front Desk

> **Audience:** Owner-operator of a US/Canada medical spa, 1–10 locations, $800K–$2.5M revenue, public Instagram presence.
> **Duration:** 12 minutes (the full demo). Discovery + Q&A bring the call to ~30 minutes.
> **Wedge in one line:** Turn missed clinic messages into booked appointments — and prove it on the dashboard every week.
> **Live URL:** https://businesscommandcentre.com
> **Demo login:** `sarah@glowclinic.com` / `Bk0s!DemoSecure#2026`
> **Canonical demo flow:** [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md)

This plan is paired with [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md). The script has the timing, screenshots, and exact talk track. This plan covers what surrounds the demo: prep, framing, objection handling, what NOT to show, and the close.

---

## What this demo proves

One story, told well, in 12 minutes:

1. A potential client sends an Instagram DM at 6:42pm.
2. The AI drafts a clinic-safe reply within seconds.
3. The owner approves the draft on her phone.
4. The customer picks a slot the AI offered.
5. The AI proposes the booking; staff confirms.
6. The booking lands on the calendar with attribution.
7. The two-metric dashboard shows revenue **captured** and bookings that **would have been missed without BCC**.

That's it. No feature parade. No multi-vertical narrative. No HIPAA / BAA promises.

Cross-references:

- [`docs/PILOT-OPS.md`](PILOT-OPS.md) — what happens after they say yes (concierge onboarding, baseline, scorecard).
- [`docs/PILOT-SALES-SCRIPT.md`](PILOT-SALES-SCRIPT.md) — full pitch, discovery, and 5 objection responses.
- [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md) — what we do and don't claim.
- [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md) — the seven attribution reasons that drive the dashboard.

---

## Pre-demo (30 minutes before)

1. Open https://businesscommandcentre.com on your laptop. Log in as `sarah@glowclinic.com`.
2. Confirm:
   - Inbox has at least one unread Instagram conversation at the top.
   - The two-metric dashboard shows non-zero "captured" and "would have been missed" cards over the last 30 days.
   - Calendar has bookings on today and the rest of the week.
3. Open the demo on a phone (your second device) and log in. You'll demonstrate phone-based approval.
4. Open a terminal with the two webhook curls from `DEMO_SCRIPT.md` ready to paste.
5. Quick sanity: open `/pilot` in a tab; verify the form loads with `practiceType` radios and the "med spas only in Year 1" banner.

If demo data looks sparse:

```bash
cd ~/Projects/booking-os
npx tsx packages/db/src/seed-demo.ts
```

---

## The 12-minute flow (reference: `DEMO_SCRIPT.md`)

| Minute      | Section                                     | What you show                     |
| ----------- | ------------------------------------------- | --------------------------------- |
| 0:00–0:30   | The missed-message problem                  | Owner phone, after-hours DM       |
| 0:30–2:00   | Inbound Instagram DM lands in the inbox     | Inbox, channel badge              |
| 2:00–4:00   | AI drafts a clinic-safe reply               | Draft chip, "needs approval"      |
| 4:00–5:30   | Owner approves on her phone                 | Mobile inbox, single tap          |
| 5:30–7:00   | Customer responds with a time preference    | Inbound message in real time      |
| 7:00–8:30   | AI proposes a confirmed slot                | Booking Assistant panel           |
| 8:30–9:30   | Staff confirms the booking                  | Calendar entry + attribution chip |
| 9:30–11:00  | Captured + would-have-been-missed dashboard | Two-metric ROI dashboard          |
| 11:00–12:00 | 30-day pilot scorecard + close              | Scorecard view, pilot terms       |

Read the full script and screenshot list in [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md).

---

## What NOT to show

- **Settings deep dives** — Settings, Automations, Campaigns, Reports beyond the two-metric dashboard. They collapse the wedge into a feature tour.
- **Multi-vertical or non-aesthetic tenants** — Year 1 is medical spas only. Showing Glow Aesthetic Clinic's data is fine; showing other tenants implies we serve them.
- **Clinical features that don't exist anymore** — `MedicalRecord`, `ClinicalPhoto`, `Aftercare*` were removed in the pivot. Don't reference them.
- **Auto-send during pilot** — Pilot default is staff-approved drafts (`autoReply.enabled = false`). Auto-send is opt-in per channel after the clinic is comfortable.
- **HIPAA / BAA promises** — We are non-clinical infrastructure. See [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md) for the BAA decline script.

---

## Discovery (before the demo, ~5 minutes)

Confirm the prospect is in-ICP before showing anything. Year-1 ICP is medical spas only.

Ask:

1. "What kinds of treatments do you offer most — injectables, laser, body contouring?" _(qualifies MED_SPA practiceType)_
2. "How many locations are you running?" _(want 1–10)_
3. "Roughly what's your monthly booking volume right now?" _(grounds the baseline math; expect 60–200/mo for our ICP)_
4. "Where are most of your inbound leads coming from? Instagram DMs, WhatsApp, the website, walk-ins?" _(confirms the wedge applies)_
5. "Who replies to those messages today, and at what hours?" _(surfaces the after-hours / unanswered-threshold pain)_
6. "Are you currently running anything for after-hours coverage or auto-replies?" _(captures objection #1 setup; see Pilot Sales Script)_

If they're not MED_SPA, redirect to the Year 2 waitlist and end the call politely. Don't run the demo. ICP discipline matters more than any single closed deal at this stage.

---

## Talk track for the close (minute 11:00–12:00)

After the dashboard and the scorecard, transition with:

> "Here's what I'm offering: a 30-day pilot. Free. I personally onboard you on a 60-minute concierge call. We capture your current monthly bookings as a baseline, plug in the channels you use today, and run the AI Front Desk in staff-approved mode. At the end of 30 days, you decide. If we captured at least 10 messages and 5 bookings you would have otherwise missed, and you want to continue, you graduate at $397/month for one location, $197/month for each additional location. If we don't, you walk away and you've lost nothing but an hour of onboarding time."

Then ask: "Want me to send you the application now?"

If yes: send the link to `/pilot` (live form, has rate limit + honeypot). They fill in `practiceType=MED_SPA`. Founder gets the notification email and personally responds within 24h. See [`docs/PILOT-OPS.md`](PILOT-OPS.md) for what happens next.

---

## Demo environment checklist

Run through this before every demo:

- [ ] Demo tenant logs in cleanly at the live URL.
- [ ] Inbox has at least one unread Instagram conversation in the top 3.
- [ ] Calendar has confirmed bookings for today and tomorrow.
- [ ] Two-metric dashboard renders with non-zero captured + would-have-been-missed cards over the last 30 days.
- [ ] Pilot scorecard view loads (link from dashboard or `/admin/businesses/[id]/pilot-health` from admin).
- [ ] Webhook curls from `DEMO_SCRIPT.md` work against the demo tenant.
- [ ] Mobile login works on your phone (you'll do step 3 from there).

---

## Objection handling (short list)

The full pitch + 5-objection script lives in [`docs/PILOT-SALES-SCRIPT.md`](PILOT-SALES-SCRIPT.md). The five common ones to be ready for during demo:

1. **"We already use [other tool]."** — Reframe as channel coverage + attribution proof. We're not replacing the booking system; we're catching the messages that the booking system never sees.
2. **"How is this HIPAA compliant?"** — Year 1 is non-PHI infrastructure. The PMS remains the system of record for any patient health information. Polite BAA decline if asked.
3. **"Why $397?"** — ROI calc: a single recovered booking covers it. The dashboard you just saw makes that math visible every week.
4. **"I want my staff to write replies, not AI."** — Staff approval mode is the default. Auto-send is opt-in per channel, after they trust the tone. The AI saves the typing, not the judgment.
5. **"What if it doesn't work?"** — 30-day free pilot, kill switch any time, no contract. We only continue if the scorecard hits.

---

## Post-demo follow-up

Within 24 hours of the demo:

- Send the prospect the pilot application link (`/pilot`) and the live URL.
- Forward [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md) if they asked about HIPAA, BAA, or PHI.
- Add them to the CRM as `pilot_pending` with `practiceType` and source channel logged.
- If they said "not now," set a 60-day re-engagement reminder.

---

## What success looks like

For us to consider the demo "worked":

- Prospect agrees to apply for pilot, OR
- Prospect agrees to a follow-up specifically about the pilot terms, OR
- Prospect explicitly disqualifies themselves (not MED_SPA, > 10 locations, insurance-billed, etc.) and we route to the Year 2 waitlist.

A "we'll think about it" is a soft no. Treat it as such.
