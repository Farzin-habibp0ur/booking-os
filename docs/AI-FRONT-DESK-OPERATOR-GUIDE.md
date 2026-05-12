# AI Front Desk — Operator Guide

> **Audience:** Clinic staff who run the AI Front Desk day-to-day. Front desk coordinators, owner-operators, and anyone whose job includes replying to inbound messages, taking bookings, or refilling cancellations.
> **Purpose:** Plain-language reference for the workflows you'll do every day. How to approve an AI draft, edit one, reject one, transfer to a human, take a booking, read your dashboard, and handle escalations.
> **Last updated:** 2026-05-09

---

## What you have

You have an inbox. Every inbound message — from Instagram, WhatsApp, SMS, email, your website chat, Facebook Messenger — lands in **one place**. Within a few seconds of each new message, an AI assistant drafts a reply for you. You decide whether to send it, edit it, reject it, or take over the conversation yourself.

This guide walks through the workflows in the order you'll actually do them.

Cross-references: the seven attribution reasons that drive your dashboard live in [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md). Compliance basics are in [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md). The 12-minute walkthrough video / script is at [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md).

---

## The four-second loop

Most of what you'll do is this loop, dozens of times a day:

1. New conversation pings the inbox (audible if your browser has notifications on; a red dot if not).
2. The AI draft appears under the inbound message in lavender, marked **AI Draft — needs approval**.
3. Read the draft.
4. **Approve & Send** if it's good. **Edit** if it needs a tweak. **Reject** if it's wrong. **Transfer to human** if the situation isn't right for AI.

When the loop is humming, it takes about 4 seconds per message. Drafts auto-save. If you walk away and come back, the draft is still there.

---

## Approving an AI draft

When a draft appears in a conversation, it has four buttons:

- **Approve & Send** — sends the draft as-is via the channel the customer used.
- **Edit** — opens the draft in the composer so you can change wording, add specifics, or restructure.
- **Reject** — discards the draft. The composer becomes empty. You write a manual reply.
- **Regenerate** — asks the AI for a different draft. Useful when the tone is close but not quite right.

### When to approve as-is

- The draft answers the customer's question correctly.
- The tone matches your clinic's voice.
- Any specifics the AI offered (slot times, prices) are accurate.
- The draft doesn't contain anything you'd never say (medical claims, prices outside your range, slots that aren't actually open).

If all four are true → **Approve & Send**. Don't overthink it. The faster the loop runs, the better the customer experience.

---

## Editing a draft

Click **Edit** on the draft. The text loads into the composer at the bottom of the conversation. A small banner reads _"Editing AI draft."_ Make your changes and hit Send.

What's worth editing:

- Specific dates / times / prices the AI got slightly wrong.
- Adding a personal touch ("Looking forward to seeing you Tuesday, Sarah").
- Clipping anything that sounds too formal or too generic.

The edited message is what goes out — the original draft is logged for your records (you can see it in the conversation history).

---

## Rejecting and writing manually

Click **Reject** when the draft is the wrong answer entirely:

- The customer is asking something off-script (a complaint, a complex medical question, a refund request).
- The AI misread the intent (it's drafting a booking reply but the customer is cancelling).
- The conversation needs a human voice that the AI can't replicate.

After reject, the composer is blank. Write your reply normally and send.

If you reject the same kind of draft repeatedly (e.g., the AI keeps offering the wrong service), tell BCC. We'll tune your clinic's voice settings or update the service catalog.

---

## Handling a transfer-to-human moment

Some conversations should escalate immediately, without an AI reply. The AI is trained to detect these and hand the conversation to staff with a banner: _"Transfer to human suggested."_

Trigger examples:

- Customer mentions an adverse reaction or complication.
- Customer asks for medical advice the AI shouldn't give.
- Customer expresses frustration or anger.
- Customer's question requires information that isn't in the AI's context (e.g., specifics about a clinical procedure).

When you see the transfer-to-human banner, the AI will not draft. You take over the conversation yourself. Your reply goes out under your name (the channel still shows the clinic, but the conversation log shows you as the responder).

If you want to ask the AI for a draft anyway after taking over, click **Request AI draft**. It will respect the transfer flag and only generate cautiously.

---

## The booking flow (multi-step assistant)

When a customer is asking to book — "Can I get lip filler next week?" — the AI runs a multi-step booking flow inside the conversation. You see the **Booking Assistant** panel populate on the right side of the conversation.

The assistant collects, in order:

1. **Service** — which service the customer wants (matched to your service catalog).
2. **Date** — the day they prefer (with awareness of your calendar).
3. **Time** — the slot they prefer (with conflict detection).
4. **Confirm** — a summary of service / date / time / provider for staff to approve.

At step 4, you see **Confirm booking** as the primary button. Clicking it:

- Creates the booking on your calendar.
- Sends a confirmation message to the customer (via the channel they used).
- Marks the conversation **Resolved — booking attributed**.
- Adds an attribution row to the dashboard. (See [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md) for what `attributionReason` gets set.)

If something is off at step 4 (wrong service, wrong slot, customer wants to negotiate price), reject the booking step and reply manually. The conversation continues.

### When the booking assistant misreads intent

If the customer is asking a general question and the booking assistant fires anyway (occasionally happens), you can dismiss the assistant panel from the conversation view. The AI returns to drafting normal replies.

---

## Reading the captured + would-have-been-missed dashboard

Open `Dashboard` in the sidebar (or click the AI Front Desk icon on mobile). You'll see two cards over your selected time range (default: last 30 days):

### Card 1 — Bookings captured

- **Count** — how many bookings flowed through BCC in the period.
- **Revenue** — total paid (service + add-ons + tip) for those bookings.

This card includes every booking, regardless of how it came in. It's your headline volume.

### Card 2 — Bookings that would have been missed without BCC

- **Count** — the subset of card 1 where, without BCC, you wouldn't have booked the appointment.
- **Revenue** — the dollars associated.

Hover the methodology icon (a small question mark) to see the breakdown by reason: how many came from after-hours messages, how many from waitlist matches, how many from quote follow-ups, etc.

### What "voided" means

If a booking was cancelled or no-showed, its attribution is voided. The card reflects what actually happened, not what was on the calendar at the time. A cancelled booking that was previously counted in Card 2 disappears from Card 2 once the cancellation is recorded.

### Baseline strip

If your founder captured a baseline during onboarding (typical monthly bookings before BCC), you'll see a small strip below the cards comparing this period to that baseline. The honest read: are we lifting the number you'd have done anyway? Card 2 is the hard answer — it shows bookings BCC was specifically responsible for, and revenue tied to them.

---

## Setting per-channel auto-reply overrides

By default, **auto-reply is OFF**. Every AI draft requires staff approval before sending. This is the recommended setting during pilot and for the first 30 days after pilot.

After you've gotten comfortable with the AI's tone in a specific channel, you can enable auto-reply per channel.

To enable:

1. Go to **Settings → AI**.
2. Under **Auto-reply**, find the channel toggle (Web Chat, Email, SMS, Instagram, WhatsApp, Facebook Messenger).
3. Turn the toggle on for that channel.
4. Optionally set a confidence threshold — drafts below the threshold still require approval.

What's safe to auto-reply on:

- **Web Chat** — lowest risk; conversational, customer expects fast replies, the AI's tone tends to be cleanest here.
- **Email** — medium risk; more formal, easier to mistakenly send something off-tone.
- **SMS** — medium risk; brevity matters, hard to recover from a wrong send.
- **Instagram / WhatsApp / Facebook** — highest risk; voice + emoji + brand expectations matter most. Enable last, if at all.

You can always turn auto-reply back off. The toggle is per-channel; the rest of the system continues as normal.

> **TBD — confirm with founder.** Whether to expose a confidence-threshold slider in the AI settings UI as part of Year 1, or to fix it server-side until we have more pilot data. Current direction: server-side fixed default; UI lever added later if pilots ask for it.

---

## Escalation paths

### When a draft is wrong in a way that worries you

Reject the draft. Reply manually. Then:

1. Note the conversation ID (visible in the URL when the conversation is open).
2. Email your founder contact at BCC with the conversation ID and a one-line description.
3. We'll review during your weekly check-in (or sooner if you flag it as urgent).

### When the AI keeps making the same mistake

Examples: keeps quoting the wrong price, keeps offering a discontinued service, keeps using a name that's not yours.

This is a voice / context tuning problem, not a per-draft issue. Tell BCC. We'll update your AI settings or service catalog. Expect a 24-hour turnaround during pilot.

### When a customer says something time-sensitive (allergic reaction, complication, urgent dispute)

Don't wait for the AI. Take over the conversation immediately. Reply manually. Loop in the appropriate clinical or owner contact directly. The AI is for routine messaging — escalations are human.

### When you can't log in / the inbox isn't loading / a channel disconnected

1. Check `https://businesscommandcentre.com` — is the site loading?
2. Check Settings → Channels — is the channel showing connected?
3. If it looks like a platform issue, email BCC. During pilot, your founder is your direct contact.
4. Don't troubleshoot for more than 5 minutes — message us. We'd rather you ping us early than wait.

---

## Mobile

The web inbox works on your phone (Safari on iOS, Chrome on Android). The native mobile app is on the roadmap but not the launch priority — until then, the web inbox on a phone is fully functional.

Common one-tap actions on mobile:

- Approve & Send a draft (large primary button).
- Open a conversation from the inbox list.
- Send an inbound notification check.

Push notifications are configurable but currently best-effort — keep the browser open if you need real-time alerts. (Planned in a future release.)

---

## Day-to-day rhythm

A reasonable rhythm for a single front desk staffer running this:

- **Morning (15 min)** — Open the inbox. Burn through any overnight conversations. Clear after-hours drafts.
- **Throughout the day** — Approve drafts as they pop in. Most take 5 seconds.
- **Mid-afternoon (10 min)** — Skim the dashboard. Anything looking off? Any conversations stuck in `WAITING`?
- **End of day (5 min)** — Confirm any pending bookings, send manual reschedule replies, snooze anything that needs follow-up tomorrow.

If your inbox is busier than expected, message BCC. We can tune drafts, enable auto-reply on lower-risk channels, or surface specific automations to help.

---

## What to ignore (for now)

The platform has more features than the AI Front Desk wedge needs. During pilot, focus only on:

- The inbox (drafts + approvals).
- The calendar (bookings landing on it).
- The dashboard (captured + would-have-been-missed).
- The waitlist (when cancellations create offers).

Don't worry about Campaigns (gated during pilot), Reports (more than what your dashboard already shows), or Automations (set up by your founder during onboarding).

---

## Cross-references

- [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md) — the seven attribution reasons that drive your dashboard.
- [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md) — what BCC handles vs what your PMS handles.
- [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) — the 12-minute walkthrough.
- [`docs/PILOT-OPS.md`](PILOT-OPS.md) — for owners: what to expect during the 30-day concierge pilot.

---

## Change log

| Date       | Change                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Initial creation. Plain-language operator guide for clinic staff covering approve / edit / reject / transfer / book / dashboard / auto-reply / escalations. |
