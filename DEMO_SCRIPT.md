# Business Command Centre — 12-Minute Wedge Demo

## What This Demo Proves

Business Command Centre is the **AI Front Desk for medical spas**. It captures Instagram, WhatsApp,
and website leads, drafts replies for staff approval, fills cancellations, follows up on consults,
and proves **revenue captured + bookings that would have been missed**.

This 12-minute demo walks through the single wedge story end-to-end:

1. An after-hours Instagram DM lands in the inbox.
2. The AI drafts a clinic-safe reply within seconds.
3. The owner approves the draft on her phone.
4. The customer responds with a time preference.
5. The AI proposes a confirmed slot.
6. Staff confirms and the booking is created.
7. The captured + would-have-been-missed dashboard reflects the recovered revenue.

It closes with the 30-day pilot scorecard so the prospect sees exactly what they would receive.

---

## Demo Outline

| Minute  | Section                                | Screens                                           |
| ------- | -------------------------------------- | ------------------------------------------------- |
| 0:00–0:30 | Setup — the missed-message problem    | Empty owner phone after hours                     |
| 0:30–2:00 | Step 1 — Inbound Instagram DM lands   | Inbox conversation list, channel badge            |
| 2:00–4:00 | Step 2 — AI drafts clinic-safe reply  | Conversation thread with AI draft chip            |
| 4:00–5:30 | Step 3 — Owner approves on her phone  | Mobile inbox view, one-tap approve                |
| 5:30–7:00 | Step 4 — Customer responds with a time| Real-time inbound message                         |
| 7:00–8:30 | Step 5 — AI proposes a slot           | Booking assistant panel with proposed slot        |
| 8:30–9:30 | Step 6 — Staff confirms the booking   | Confirm button, calendar entry, customer SMS      |
| 9:30–11:00| Step 7 — Captured vs. would-have-been-missed dashboard | Two-metric ROI dashboard                  |
| 11:00–12:00| Pilot scorecard + close              | 30-day pilot scorecard view                       |

**Total: 12 minutes.** No detours, no feature parade — one story, told well.

---

## Pre-Demo Setup

### Recommended path: Production demo tenant

1. Open https://businesscommandcentre.com on your laptop.
2. Log in as the demo owner: `sarah@glowclinic.com` / `Bk0s!DemoSecure#2026`.
3. On a second device (your phone in airplane Wi-Fi), log in to the same account so you can
   demonstrate phone-based approval.
4. Have the demo Instagram simulator (or a webhook curl) ready in a terminal so you can drop the
   inbound message at minute 0:30.

### Optional: Local development

```bash
cd booking-os
npm run dev
# API :3001, Web :3000
```

Open http://localhost:3000 and log in with the same credentials.

---

## Setup (0:00–0:30) — The missed-message problem

**Talk track:**

> "Imagine you own a medical spa. You're closing up at 6:42pm. You glance at Instagram and there's
> a DM from a potential client asking about lip filler availability for next week. By the time you
> see it tomorrow morning, she's already booked somewhere else. That's a $600 booking that walked
> out the door — and you'll never know it happened."

**[SCREENSHOT 1: Owner's phone showing Instagram DM with a 6:42pm timestamp, unread.]**

**Talk track:**

> "This is the wedge problem. Medical spas lose more revenue to missed and slow-replied messages
> than they do to no-shows or cancellations combined. Business Command Centre is the AI Front Desk
> that fixes exactly this. Let me show you."

---

## Step 1 (0:30–2:00) — The inbound Instagram DM lands in the inbox

**Action:** Drop an inbound DM to the demo tenant. From a second terminal:

```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550201",
    "channel": "INSTAGRAM",
    "body": "Hi! Do you have any availability for lip filler next week? First time, asking for prices too.",
    "externalId": "wedge_msg_001"
  }'
```

(For production demos, send the same message through the demo Instagram simulator instead.)

**On screen:** The message appears in the **Inbox** in real time. The conversation row shows the
**Instagram** channel badge and the timestamp.

**[SCREENSHOT 2: Inbox showing the inbound DM at the top of the conversation list, channel badge
visible.]**

**Talk track:**

> "Every inbound message — Instagram, WhatsApp, website chat, SMS, email — lands in one inbox.
> Notice the channel badge. Your front desk doesn't have to swivel between five apps to keep up."

---

## Step 2 (2:00–4:00) — The AI drafts a clinic-safe reply

**Action:** Click the new conversation. Wait two seconds for the AI to draft.

**On screen:** A draft reply appears in the conversation thread, marked **AI Draft — needs
approval**. The draft is clinic-safe: it acknowledges the inquiry, gives a price range or
directs to a consult, and offers two specific time options based on the calendar.

**[SCREENSHOT 3: Conversation thread with the inbound DM at top and an AI-drafted reply below it,
labelled "Draft — staff approval required". Draft proposes two specific Tuesday/Thursday slots.]**

**Talk track:**

> "Within two seconds of the message arriving, the AI has read it, pulled service pricing from your
> profile, checked the calendar, and drafted a reply offering two real slots. It's clinic-safe — no
> medical claims, no diagnosis language — and it's a draft, not an auto-send. Your team stays in
> control."

---

## Step 3 (4:00–5:30) — Owner approves the draft on her phone

**Action:** Switch to the second device (the phone). The same conversation is at the top of the
inbox with a **Needs Approval** badge.

**On screen:** Tap the conversation. The AI draft is shown with a single primary button:
**Approve and send**.

**[SCREENSHOT 4: Mobile inbox view of the same conversation, "Needs Approval" badge visible, with
a large "Approve and send" button at the bottom of the screen.]**

**Action:** Tap **Approve and send**. The message goes out via Instagram. The conversation status
updates to **Sent**.

**Talk track:**

> "The owner is at home making dinner. Her phone buzzes — there's a message ready to send. She
> reads the draft in five seconds, taps approve, and the reply is on its way. From inbound message
> to customer reply: under three minutes, on a Tuesday night at 7pm."

---

## Step 4 (5:30–7:00) — The customer responds with a time preference

**Action:** Drop the customer's reply.

```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550201",
    "channel": "INSTAGRAM",
    "body": "Tuesday at 2pm works! Let me know what to expect.",
    "externalId": "wedge_msg_002"
  }'
```

**On screen:** The customer's reply appears in real time in the conversation thread.

**[SCREENSHOT 5: Conversation thread now showing the customer's response confirming Tuesday 2pm.]**

**Talk track:**

> "She picks the slot we offered. Notice the conversation now has all the context the AI needs:
> service intent, pricing acknowledged, time preference, channel."

---

## Step 5 (7:00–8:30) — The AI proposes a confirmed slot

**Action:** Watch the **Booking Assistant** panel populate on the right side of the conversation.

**On screen:** The AI shows extracted booking details — service: Lip Filler, date: next Tuesday,
time: 2:00 PM, provider: any available — with a single primary button: **Confirm booking**.

**[SCREENSHOT 6: Conversation view with the right-side Booking Assistant panel showing extracted
booking details and a "Confirm booking" button.]**

**Talk track:**

> "The AI has now extracted everything needed to create the booking — service, date, time,
> provider. Nothing has been written to the calendar yet. Staff still owns the final action."

---

## Step 6 (8:30–9:30) — Staff confirms the booking

**Action:** Click **Confirm booking**.

**On screen:** Three things happen simultaneously:

1. The booking appears on the **Calendar** for next Tuesday 2:00 PM.
2. A confirmation message is drafted and sent (or queued for approval, depending on autonomy
   settings) to the customer.
3. The conversation is marked **Resolved — booking attributed**.

**[SCREENSHOT 7: Calendar showing the new Tuesday 2pm Lip Filler booking, with a small "Sourced
from Instagram" attribution chip on the booking card.]**

**Talk track:**

> "One click. The booking is on the calendar, the customer has a confirmation, and the booking
> carries an attribution chip showing it came from Instagram. That attribution is what powers the
> dashboard you're about to see."

---

## Step 7 (9:30–11:00) — Captured vs. would-have-been-missed dashboard

**Action:** Click **Dashboard** in the sidebar.

**On screen:** The **Two-Metric Attribution Dashboard** shows the headline numbers for the last
30 days:

- **Revenue Captured** — sum of bookings where the inbound message was outside business hours or
  unanswered for over 30 minutes before the AI drafted a reply.
- **Bookings That Would Have Been Missed** — count of those same bookings, expressed as a number
  the owner can feel.

**[SCREENSHOT 8: Two-metric dashboard with two large headline cards — "Revenue Captured: $14,820"
and "Bookings That Would Have Been Missed: 23" — and a small chart showing the trend over the
30-day window.]**

**Talk track:**

> "This is the only ROI screen that matters during pilot. Revenue Captured is conservative — we
> only count bookings tied to inbound messages your team didn't catch in time, where the AI drafted
> the reply that closed the loop. The booking we just created will show up here at 2:00 PM next
> Tuesday. Twenty-three bookings, almost fifteen thousand dollars, in 30 days — that's the wedge."

---

## Close (11:00–12:00) — The 30-day pilot scorecard

**Action:** Click **Pilot Scorecard** (or scroll to it on the dashboard).

**On screen:** The 30-day pilot scorecard shows:

- Days into pilot: 30 / 30
- Inbound messages captured: 412
- AI drafts approved by staff: 287
- Bookings attributed to AI Front Desk: 23
- Revenue captured: $14,820
- Average draft-to-approve time: 4 minutes
- Cancellations refilled from waitlist: 6

**[SCREENSHOT 9: Pilot Scorecard view with the seven scorecard rows above and a big "Pilot
outcome: PASS" header at the top.]**

**Talk track:**

> "Every pilot lasts 30 days and ends with this scorecard. If we don't capture revenue you would
> have missed, the pilot doesn't convert. If we do, you decide whether to extend at the
> post-pilot price. That's the entire deal."

> "A few things to know before you decide:
>
> - Pilot is medical spas only in Year 1. Other practice types apply to the Year 2 waitlist.
> - We are non-clinical infrastructure. Your PMS remains the system of record for any patient
>   health information.
> - Replies are drafted for staff approval by default. Auto-send is opt-in, per channel, after
>   you're comfortable with tone and escalation rules.
>
> Ready to apply for pilot?"

---

## Quick Reference: Webhook Commands

The three webhook curls used in the demo:

```bash
# 1. Inbound Instagram DM (Step 1)
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"+14155550201","channel":"INSTAGRAM","body":"Hi! Do you have any availability for lip filler next week? First time, asking for prices too.","externalId":"wedge_msg_001"}'

# 2. Customer accepts the slot (Step 4)
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"+14155550201","channel":"INSTAGRAM","body":"Tuesday at 2pm works! Let me know what to expect.","externalId":"wedge_msg_002"}'
```

---

## Demo Don'ts

- Do **not** open Settings, Automations, Campaigns, or Reports during this demo. Those are
  post-pilot expansion screens; showing them collapses the wedge into a feature tour.
- Do **not** show multi-vertical or non-aesthetic tenants. The Year 1 pilot is medical spas only.
- Do **not** mention HIPAA, BAA, or PHIPA. We are non-clinical infrastructure.
- Do **not** promise auto-send during pilot. The pilot default is staff-approved drafts.
