# Booking OS - Demo Script

## Demo Overview

| Section | Parts | Duration | What It Covers |
|---------|-------|----------|----------------|
| **Core Platform** | 1-15 | ~25 min | Login, onboarding, inbox, AI responses, deposits, self-serve, ROI |
| **Growth Engine** | 16-21 | ~10 min | Cmd+K search, waitlist, campaigns, automations, bulk actions, dark mode |
| **Agentic Transformation** | 22-31 | ~18 min | Role modes, briefing, action cards, autonomy, agents, outbound, audit, multi-vertical |
| **Total** | 31 parts | ~53 min | Full platform walkthrough |

**Quick demo (15 min):** Parts 2, 3, 5, 23-26, 31 — Dashboard, inbox AI, auto-reply, briefing, action cards, autonomy, agents, wrap-up.

**Agentic-only demo (18 min):** Parts 22-31 — Everything new in the agentic transformation.

---

## Pre-Demo Setup

### Option A: Production (recommended for stakeholder demos)
1. Open https://businesscommandcentre.com
2. No local setup needed — everything is live

### Option B: Local Development
1. Start servers:
   ```bash
   cd booking-os
   npm run dev   # Starts all apps (API :3001, Web :3000, WhatsApp Simulator :3002)
   ```
2. Open http://localhost:3000
3. Have a second terminal ready for webhook commands (simulating WhatsApp messages)

### Login Credentials

| Business | Email | Password | Role | Best for |
|----------|-------|----------|------|----------|
| Glow Aesthetic Clinic | sarah@glowclinic.com | password123 | Admin | Parts 1-28, 30-31 |
| Metro Auto Group | mike@metroauto.com | password123 | Admin | Part 29 (multi-vertical) |

---

## PART 1: Login & Onboarding Wizard (3-4 min)

### Scene: Login
1. Open http://localhost:3000 — you'll be redirected to the login page
2. Enter: `sarah@glowclinic.com` / `password123`
3. Click **Sign In** — automatically redirected to the **Setup Wizard** (first-time onboarding)

### Scene: Onboarding Wizard
**Talk through:**
- "First-time users are automatically guided through a step-by-step onboarding wizard"
- Show the progress bar at the top with 10 steps

**Step 1 — Clinic Type:**
- Show two cards: **Aesthetic Clinic** (recommended) and **General Practice**
- Click **Aesthetic Clinic** — card highlights with sage ring
- Pack installs automatically (services, templates, settings)
- Click **Next**

**Step 2 — Business Info:**
- Show pre-filled business name "Glow Aesthetic Clinic"
- Show timezone selector
- Click **Next**

**Step 3 — Connect WhatsApp:**
- "This is where businesses connect their WhatsApp Business API"
- "For now, we'll skip this step — our demo uses a webhook simulator"
- Click **Skip for Now** or **Next**

**Step 4 — Staff:**
- Show existing staff: Dr. Sarah Chen (Admin), Maria Garcia (Agent), Dr. Emily Park (Service Provider)
- "Businesses can add team members with different roles"
- Click **Next**

**Step 5 — Services:**
- Show the 5 pre-configured services with CONSULT/TREATMENT badges: Consultation (Free), Botox ($350, deposit required), Dermal Filler ($500), Chemical Peel ($200), Microneedling ($300)
- Click **Next**

**Step 6 — Working Hours:**
- Show the weekly schedule grid for each staff member
- Toggle between Dr. Sarah Chen and Maria Garcia
- "Staff members can have different schedules"
- Click **Next**

**Step 7 — Message Templates:**
- Show the 10 templates: Reminder, Confirmation, Follow-up, Consult Follow-up, Aftercare, Treatment Check-in, Deposit Request, Cancellation, Reschedule Link, Cancel Link
- "Templates support dynamic variables like customer name, service, and time"
- Click **Next**

**Step 8 — Profile Fields:**
- Show required field configuration
- Click **Next**

**Step 9 — Import Customers:**
- "Businesses can import customers in three ways"
- Show the 3 cards: Import from CSV, Create from Conversations, Add Manually
- *Optional:* Upload `demo-customers.csv` to show the CSV preview + import
- Click **Next**

**Step 10 — Finish:**
- Show **Feature Readiness Checklist** — 6 items with green/amber indicators (staff, services, templates, notifications, working hours, clinic pack)
- Click **Create Test Booking** — success toast confirms it works
- Click **Open WhatsApp Simulator** — opens simulator in new tab
- Click **Go to Dashboard**

---

## PART 2: Dashboard Overview (2 min)

### Scene: Dashboard
**Talk through:**
- "This is the Booking OS dashboard — a WhatsApp-first operating system for service businesses"
- Point out the **4 key metrics**: Bookings This Week, Revenue (30 days), Total Customers, Open Conversations
- Show **Today's Appointments** section
- Show **Unassigned Conversations**

### Scene: Attention Needed Panel (Phase 1)
- Show **Deposit-Pending Bookings** — Liam Parker's Botox needs a deposit
- Show **Overdue Replies** — conversations awaiting response
- Show **Tomorrow's Schedule** — upcoming appointments
- "These panels highlight what needs immediate attention"

### Scene: Go-Live Checklist (Phase 1, ADMIN only)
- Show the auto-updating 8-item checklist with progress bar
- Point out "Fix →" links that navigate to the relevant settings
- "This ensures clinics are fully set up before going live"

### Scene: First 10 Bookings Milestones (Phase 1)
- Show milestone tracker with coaching nudges
- "We guide new clinics through their first bookings with contextual tips"

---

## PART 3: Inbox & AI Draft Responses (3-4 min)

### Scene: Inbox Overview
1. Click **Inbox** in sidebar
2. Show the 3-column layout: filters | conversation list | message thread
3. Click on **Emma Wilson's** conversation
4. Show existing messages — she was asking about booking an appointment

**Talk through:**
- "The inbox shows all WhatsApp conversations in one place"
- "Notice the AI has already detected her intent and generated a draft response"
- Show the **AI draft box** (purple gradient) with the suggested reply
- Point out the **intent badge** and **confidence score**

### Scene: AI Summary
1. In the right sidebar, show the **AI Summary** section
2. Click **Refresh** to generate a new summary
3. Show customer info: name, phone, tags (VIP, Regular)

**Talk through:**
- "AI automatically summarizes each conversation so staff can quickly get context"

### Scene: Simulate a New WhatsApp Message
**Run in terminal:**
```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550201",
    "body": "Hi! I would like to book a Botox treatment for next Tuesday please",
    "externalId": "demo_msg_001"
  }'
```

1. The message appears in real-time in the inbox (WebSocket)
2. Wait 2-3 seconds — AI processes the message
3. Show the **AI draft response** that appears — it should suggest available times
4. Show the **intent: BOOK_APPOINTMENT** badge
5. In the sidebar, show the **AI Booking Panel** with extracted info (service: Botox, date: next Tuesday)

**Talk through:**
- "A customer just sent a WhatsApp message asking to book Botox for Tuesday"
- "The AI instantly detects the booking intent and extracts the service and date"
- "It generates a professional draft response suggesting available time slots"
- "The staff member can review, edit, and send — or dismiss if they want to write their own"

### Scene: Send the Draft & Continue Booking Flow
1. Click **Send Draft** to send the AI-generated response
2. Simulate the customer replying with a time preference:

```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550201",
    "body": "2pm would be perfect!",
    "externalId": "demo_msg_002"
  }'
```

3. Wait for AI processing — booking panel should progress to time confirmation step
4. Show the **Confirm Booking** button when all details are extracted
5. Click **Confirm** to create the booking

**Talk through:**
- "The AI guides the entire booking conversation step by step"
- "Once all details are confirmed — service, date, and time — staff can create the booking with one click"
- "The customer gets an automatic confirmation message via WhatsApp"

---

## PART 4: Cancellation Flow (1-2 min)

### Scene: Customer Wants to Cancel
**Run in terminal:**
```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550203",
    "body": "Hi, I need to cancel my Chemical Peel appointment tomorrow. Something came up.",
    "externalId": "demo_msg_003"
  }'
```

1. Click on **Sofia Rodriguez's** conversation
2. Show the AI draft response (empathetic cancellation acknowledgment)
3. Show **intent: CANCEL** badge
4. Show the **AI Cancel Panel** in sidebar — it identifies which booking to cancel
5. Click **Confirm Cancel** to process the cancellation

**Talk through:**
- "When a customer wants to cancel, the AI detects the intent and identifies the specific appointment"
- "It drafts an empathetic response and gives staff the option to confirm or dismiss the cancellation"

---

## PART 5: Auto-Reply Mode (2-3 min)

### Scene: Enable Auto-Reply
1. Click **Settings** in sidebar
2. Click **AI Settings** card
3. Show current settings: AI enabled, draft mode
4. Toggle **Enable Auto-Reply** ON
5. Select **"Reply to all intents"**
6. Click **Save**

**Talk through:**
- "By default, AI generates draft responses for staff to review"
- "But for businesses that want faster response times, we can enable Auto-Reply"
- "This lets the AI respond automatically to customer messages — no staff review needed"

### Scene: Test Auto-Reply
**Run in terminal:**
```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550202",
    "body": "What services do you offer and what are your prices?",
    "externalId": "demo_msg_004"
  }'
```

1. Click on **James Thompson's** conversation
2. Show that the AI responded **automatically** — no draft review needed
3. The response should list services and prices

**Talk through:**
- "James just asked about services and pricing"
- "With auto-reply enabled, the AI responded instantly — no staff intervention needed"
- "The response includes accurate service information from the business profile"

### Scene: Selective Auto-Reply
1. Go back to **Settings > AI Settings**
2. Change to **"Selected intents only"**
3. Check only **GENERAL** and **INQUIRY** — uncheck BOOK_APPOINTMENT, CANCEL, RESCHEDULE
4. Save

**Talk through:**
- "You can also be selective — auto-reply for simple questions, but require staff review for bookings and cancellations"
- "This gives businesses the perfect balance of speed and control"

---

## PART 6: Human Transfer (1-2 min)

### Scene: Customer Asks for a Human
**Run in terminal:**
```bash
curl -X POST http://localhost:3001/api/v1/webhook/inbound \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "+14155550202",
    "body": "I would like to speak with a real person please. I have some specific medical questions about the Botox treatment.",
    "externalId": "demo_msg_005"
  }'
```

1. Watch the inbox — AI detects **TRANSFER_TO_HUMAN** intent
2. AI sends an automatic handoff message: "I'm connecting you with a team member..."
3. Conversation is auto-assigned to the business admin
4. Show the **"Resume Auto-Reply"** button that appears in the conversation header

**Talk through:**
- "Sometimes customers want to talk to a real person"
- "The AI recognizes this instantly and transfers the conversation to a staff member"
- "It sends a polite handoff message so the customer knows a human will respond soon"
- "While transferred, all AI responses switch to draft-only mode — ensuring the human is in control"

### Scene: Resume Auto-Reply
1. Click the **"Resume Auto-Reply"** button
2. Show confirmation

**Talk through:**
- "Once the staff member resolves the issue, they can resume auto-reply with one click"

---

## PART 7: Customer Import (2-3 min)

### Scene: CSV Import
1. Click **Customers** in sidebar
2. Show the customer list (Emma, James, Sofia from seed data)
3. Click the **Import** button
4. In the modal, click **Import from CSV**
5. Upload the demo CSV file (see below)
6. Show the preview table
7. Click **Import**
8. Show results: "Created X, Skipped Y"

**Demo CSV file** — save as `demo-customers.csv`:
```csv
name,phone,email,tags
Alex Johnson,+14155551001,alex@example.com,new;referred
Mia Chen,+14155551002,mia@example.com,vip
David Park,+14155551003,david@example.com,regular
Lisa Wang,+14155551004,,new
Roberto Silva,+14155551005,roberto@example.com,regular;returning
```

**Talk through:**
- "Businesses can import their existing customer database via CSV"
- "The system detects duplicates by phone number and skips them"
- "Tags are preserved so you can segment customers right away"

### Scene: AI Profile Generation
1. Still in the Import modal, switch to **"Create from Conversations"**
2. Check **"Include past messages for AI profile creation"**
3. Click **Generate Profiles**
4. Show the results

**Talk through:**
- "For businesses migrating from WhatsApp, AI can analyze existing conversations"
- "It extracts customer names, emails, and creates intelligent tags based on conversation context"
- "This saves hours of manual data entry"

---

## PART 8: Settings & Account Import (1 min)

### Scene: Account Settings
1. Go to **Settings**
2. Click **Account & Import** card
3. Show the three sections:
   - CSV Import with drag-and-drop
   - AI Profile Generation from conversations
   - CSV Export

**Talk through:**
- "The Account page provides a central hub for all data import and export"
- "Businesses can import, generate AI profiles, or export their customer data anytime"

---

## PART 9: Calendar & Bookings (1 min)

### Scene: Calendar View
1. Click **Calendar** in sidebar
2. Show the day/week view with Sofia's booking (and any new bookings created during demo)
3. Show staff columns
4. Click on a booking to show details

**Talk through:**
- "All bookings appear on the calendar, organized by staff member"
- "Staff can see their daily schedule at a glance"

---

## PART 10: Reports & Analytics (1 min)

### Scene: Reports
1. Click **Reports** in sidebar
2. Show the summary cards
3. Scroll through charts: Bookings Over Time, Revenue, Service Popularity
4. Show Staff Performance table
5. Show Peak Hours analysis

**Talk through:**
- "Admins and agents get comprehensive analytics"
- "Track bookings, revenue, staff performance, and peak hours"
- "Use these insights to optimize scheduling and staffing"

---

## PART 11: Deposit Flow (Phase 1) (2 min)

### Scene: Deposit-Required Booking
1. Click **Bookings** in sidebar
2. Find Liam Parker's booking — status shows **Pending Deposit** (amber badge)
3. Click to open booking detail modal

### Scene: Send Deposit Request
1. Click **Send Deposit Request** button (amber border)
2. Toast confirms "Deposit request sent!"
3. Show the **notification timeline** at the bottom — deposit request logged with timestamp
4. "Deposit notifications are sent via WhatsApp and/or email based on clinic settings"

### Scene: Manager Override
1. Show the **Confirm Without Deposit** button (only visible for ADMIN role)
2. Click it — reason required popup appears
3. Enter a reason: "VIP client, will pay at appointment"
4. Override logged in timeline with reason

---

## PART 12: Clinic Intake (Phase 1) (1-2 min)

### Scene: Inbox Clinic Intake Card
1. Click **Inbox** in sidebar
2. Click on a patient conversation
3. In the right sidebar, show the **Clinic Intake** card
4. Show 7 fields: Medical Flag, Allergies, Concern Area, Desired Treatment, Budget Range, Preferred Provider, Contraindications
5. Point out **amber dots** on empty fields and the completion badge (e.g., "2/7")
6. Click the **pencil icon** to enter edit mode
7. Fill in some fields, click **Save**
8. Badge updates (e.g., "5/7")

---

## PART 13: Self-Serve Links (Phase 1) (2 min)

### Scene: Send Reschedule Link
1. Open a booking detail modal
2. Click **Send Reschedule Link** — toast confirms link sent
3. Show in **notification timeline** that the link was logged

### Scene: Customer Reschedule Page
1. In a new browser tab, open the reschedule link (from notification logs or API response)
2. Show the **clinic-branded reschedule page** with business name and booking details
3. Show the **policy-aware slot picker** — only valid time slots are shown
4. Select a new slot and confirm
5. "The customer can reschedule without calling or messaging — it just works"

### Scene: Send Cancel Link
1. Back in the booking detail, click **Send Cancel Link**
2. Open the cancel link in a new tab
3. Show the **clinic-branded cancel page** with confirmation and optional reason
4. "Expired or invalid links show a safe fallback — no private info revealed"

---

## PART 14: ROI Dashboard (Phase 1) (2 min)

### Scene: ROI Metrics
1. Click **ROI** in sidebar
2. Show the 6 metric cards: No-show Rate, Consult → Treatment Conversion, Avg Response Time, Revenue, Utilization, Deposit Compliance
3. Show **current vs baseline** comparison with green/red delta badges
4. "Baseline is captured at go-live — all improvements are measured from there"

### Scene: Recovered Revenue
1. Show the **Recovered Revenue** estimate card
2. Click **"How we calculate this"** — methodology is transparent
3. "We only show this when there's enough data — conservative and honest"

### Scene: Weekly Review
1. Click the **Weekly Review** tab
2. Show the week-over-week comparison table (6 metrics × 2 periods)
3. Delta badges show what improved vs worsened
4. Click **Email Review** — toast confirms review emailed
5. "Pilot clinics can email this to their team every Monday"

---

## PART 15: Templates & Notifications (Phase 1) (1 min)

### Scene: Template Pack
1. Go to **Settings > Templates**
2. Show all 10 templates — including Cancellation, Reschedule Link, Cancel Link
3. Click a template to preview
4. If any template has unresolved `{{variables}}`, show the **amber warning badge**
5. "Templates prevent embarrassing sends — unresolved variables are flagged before sending"

### Scene: Notification Timeline
1. Open any booking detail modal
2. Scroll to the **notification timeline** section
3. Show Send icons with timestamps for each notification event
4. "Every action — deposit requests, links, reminders — is logged and visible"

---

## PART 16: Global Search — Cmd+K (1 min)

### Scene: Command Palette
1. Press **Cmd+K** (or click the search icon in the sidebar)
2. The command palette opens with a search input and recent searches
3. Type **"Emma"** — results appear grouped by type: Customers, Bookings, Conversations
4. Use **arrow keys** to navigate results, **Enter** to select
5. Click on Emma Wilson's customer result → navigates to her detail page

**Talk through:**
- "Staff can search across the entire system instantly with Cmd+K"
- "Results are grouped by type — customers, bookings, services, conversations"
- "Recent searches are remembered for quick access"

---

## PART 17: Waitlist & Slot Fill (2 min)

### Scene: Waitlist Management
1. Click **Waitlist** in sidebar (Clock icon)
2. Show the waitlist page with any existing entries
3. Show the backfill metrics card: entries, offers sent, claimed, fill rate

**Talk through:**
- "When all slots are full, customers can join the waitlist from the public booking page"
- "When a booking is cancelled, the system automatically offers the slot to waitlisted customers"
- "Customers claim with a single tap via a secure link — no back-and-forth messaging needed"

### Scene: Waitlist Settings
1. Go to **Settings > Waitlist Settings**
2. Show configurable options: max offers per cancellation, offer expiry time, quiet hours
3. "Quiet hours ensure customers aren't notified at 2am about a slot opening"

---

## PART 18: Campaigns (2 min)

### Scene: Create a Campaign
1. Click **Campaigns** in sidebar (Megaphone icon)
2. Click **"+ New Campaign"**
3. **Step 1 — Audience:** Select segment filters (e.g., tag: "Regular", last booking > 30 days ago)
4. Show the audience preview: count + sample customer names
5. **Step 2 — Template:** Select a message template
6. **Step 3 — Schedule:** Choose "Send now" with throttle rate
7. **Step 4 — Review:** Show summary of all selections

**Talk through:**
- "Campaigns let businesses re-engage customers with targeted outreach"
- "Segment by tags, last visit date, service type, or customers with no upcoming booking"
- "Safe sending: throttled delivery, opt-out compliance, and campaign attribution tracks bookings driven by each campaign"

---

## PART 19: Automations (2 min)

### Scene: Built-in Playbooks
1. Click **Automations** in sidebar (Zap icon)
2. Show the 3 built-in playbooks with toggle switches:
   - **No-Show Prevention** — deposit reminder + confirmation before appointment
   - **Consult Conversion** — follow-up after consult if no treatment booked
   - **Re-engagement** — message dormant customers after 30+ days
3. Toggle one on — show "what will happen" summary

**Talk through:**
- "These are one-click playbooks that automate the most impactful workflows"
- "Each one explains exactly what will happen before you turn it on"

### Scene: Custom Rules
1. Click **"+ New Rule"** to open the rule builder wizard
2. Walk through: Trigger (e.g., BOOKING_CANCELLED) → Filters → Actions (SEND_TEMPLATE) → Review
3. Show safety settings: quiet hours, frequency caps

### Scene: Activity Log
1. Scroll to the **Activity Log** section
2. Show execution history: rule name, customer, outcome (SENT/SKIPPED/FAILED)
3. "Full audit trail — you can see exactly what ran, when, and why"

---

## PART 20: Bulk Actions (1 min)

### Scene: Bulk Booking Actions
1. Click **Bookings** in sidebar
2. Check multiple booking checkboxes
3. Show the **Bulk Action Bar** at the bottom: "X selected" with action buttons
4. Demonstrate: Change status for multiple bookings at once

### Scene: Bulk Customer Actions
1. Click **Customers** in sidebar
2. Check multiple customer checkboxes
3. Show bulk tag/untag actions
4. "Multi-select saves hours of repetitive work"

---

## PART 21: Dark Mode (30 sec)

### Scene: Toggle Dark Mode
1. Click the **Sun/Moon icon** in the sidebar
2. Watch the entire UI switch to dark mode
3. Show that all pages, charts, and components adapt

**Talk through:**
- "Full dark mode support — system preference detection or manual toggle"
- "Every page, every chart, every component is covered"

---

## PART 22: Role-Based Modes (1-2 min)

### Scene: Admin Mode (default)
1. You're currently logged in as Sarah (Admin) — notice the full sidebar with all sections
2. Point out: Dashboard has Daily Briefing, Settings includes Autonomy + Agents, full Reports access
3. "Admins see everything — strategic dashboards, team management, AI configuration"

### Scene: Switch to Agent Mode
1. Click the **mode selector** in the sidebar (or profile dropdown)
2. Switch to **Agent** mode
3. Show how the sidebar changes: Dashboard shows KPI Strip + MyWork instead of Briefing, fewer settings
4. "Agents focus on day-to-day operations — conversations, bookings, customer management"
5. Show the **MyWork** section: assigned conversations + today's schedule

### Scene: Provider Mode
1. Switch to **Service Provider** mode
2. Show the minimal sidebar: only Calendar, My Schedule, active conversations
3. "Providers see only what's relevant to their appointments — no admin noise"
4. Switch back to **Admin** mode for the rest of the demo

**Talk through:**
- "Three distinct roles — Admin, Agent, Provider — each sees a tailored interface"
- "Same app, same login, different experiences based on what each role needs"

---

## PART 23: Mission Control Dashboard & Saved Views (2 min)

### Scene: Mission Control Dashboard
1. Navigate to **Dashboard** (Admin mode)
2. Show the **Daily Briefing** section at the top — AI-generated action cards grouped by priority
3. Point out the 4 categories:
   - **Urgent Today** (red) — deposit-pending bookings, overdue replies
   - **Needs Approval** (lavender) — AI-proposed actions waiting for human sign-off
   - **Opportunities** (sage) — open slots, waitlist matches, re-engagement candidates
   - **Maintenance** (slate) — data cleanup, duplicate detection
4. Show the **urgent count badge** on the Daily Briefing header
5. Click the **Refresh** button to reload the briefing

**Talk through:**
- "The dashboard is no longer just metrics — it's a mission control that tells you what to do right now"
- "AI scans your entire business overnight and surfaces what matters most"
- "Each card explains WHY it's suggesting an action — not just what to do"

### Scene: Saved Views
1. Scroll to see **pinned Saved Views** on the dashboard (if any)
2. Navigate to **Bookings** page
3. Apply filters: status = CONFIRMED, date range = this week
4. Click **Save View** — name it "This Week Confirmed"
5. Show the saved view appears in the sidebar under a views section
6. Click the **pin icon** to pin it to the dashboard

**Talk through:**
- "Staff can save any filter combination as a named view"
- "Pin views to the dashboard for one-click access to your most-used queries"
- "Views can be shared with the team or kept personal"

---

## PART 24: Daily Briefing & Action Cards (3-4 min)

### Scene: Briefing Card Lifecycle
1. On the **Dashboard**, find a briefing card (e.g., "Deposit pending for Liam Parker's Botox")
2. Show the card anatomy:
   - **Title** — what happened
   - **Description** — "Because..." (AI explains why this matters)
   - **Suggested Action** — what the AI recommends doing
   - **CTA Buttons** — Approve, Dismiss, Preview
3. Click **Preview** on a card — show the diff/detail modal

### Scene: Approve an Action
1. Find a deposit-pending card
2. Click **Approve** — the card turns to APPROVED status and fades out
3. Show toast confirmation: "Action approved"
4. "The AI just sent a deposit reminder on your behalf — you approved it in one click"

### Scene: Dismiss an Action
1. Find an opportunity card (e.g., "Open slot tomorrow at 2pm")
2. Click **Dismiss** — card is removed
3. "Not every suggestion is right — dismiss what doesn't apply, the AI learns"

### Scene: Snooze an Action
1. Find a maintenance card
2. Click the **Snooze** button (clock icon)
3. "Snooze defers the card — it'll come back later so nothing falls through the cracks"

**Talk through:**
- "Every AI action goes through this lifecycle: Proposed → Approved/Dismissed/Snoozed → Executed"
- "Nothing happens without your knowledge — full transparency and control"
- "Cards expire automatically if not acted on — no stale notifications piling up"

---

## PART 25: AI Autonomy Settings (2 min)

### Scene: Autonomy Configuration
1. Navigate to **Settings > AI Autonomy** (Shield icon)
2. Show the autonomy settings page with 8 action types listed:
   - Deposit Reminders
   - Overdue Replies
   - Open Slot Notifications
   - Stalled Quote Follow-up
   - Waitlist Matching
   - Retention Outreach
   - Data Cleanup
   - Schedule Optimization

### Scene: Three Autonomy Levels
1. Point out the three buttons per action type: **Off | Assist | Auto**
2. Demonstrate toggling **Deposit Reminders** from Assist to Auto
3. Show toast: "Autonomy level updated"
4. Explain each level:
   - **Off** — AI does nothing for this action type
   - **Assist** — AI proposes the action as a card, human approves or dismisses
   - **Auto** — AI executes within constraints (e.g., max 10 per day) — no human approval needed

**Talk through:**
- "This is the trust dial — businesses start with Assist on everything"
- "As they gain confidence, they promote specific actions to Auto"
- "Each action type has independent controls — you might auto-approve deposit reminders but keep cancellation responses on Assist"
- "Constraints prevent runaway automation — max actions per day, required roles, quiet hours"

---

## PART 26: Background Agents (2-3 min)

### Scene: Agent Skills Catalog
1. Navigate to **Settings > Agent Skills** (Bot icon)
2. Show the three agent categories:

**Proactive Agents (sage):**
- **Waitlist Agent** — Monitors cancellations, matches waitlist entries, proposes top-3 candidates
- **Retention Agent** — Identifies customers overdue for their next visit, drafts re-engagement messages
- **Quote Follow-up Agent** — Detects stalled quotes, suggests follow-up timing and message

**Reactive Agents (lavender):**
- (Intent detection, booking assistant — always on, configured in AI Settings)

**Maintenance Agents (slate):**
- **Data Hygiene Agent** — Detects duplicate customers by phone/name/email, proposes merge
- **Scheduling Optimizer** — Analyzes gaps in the schedule, suggests slot consolidation

### Scene: Configure an Agent
1. Toggle the **Retention Agent** ON (if not already enabled)
2. Show the autonomy dropdown: Suggest Only / Require Approval / Fully Automatic
3. Change to **Suggest Only** — "The agent will create action cards but never act on its own"
4. Toggle it to **Fully Automatic** — "Now it runs in the background and sends outreach autonomously"

**Talk through:**
- "These are specialized AI agents that run behind the scenes"
- "Each agent has its own skill set and can be independently enabled and configured"
- "Waitlist Agent has matched X candidates this month — it fills cancellation slots automatically"
- "Data Hygiene Agent found Y potential duplicate customers and proposed merges"
- "Every agent action is logged in the audit trail — full accountability"

---

## PART 27: Outbound Messaging (1-2 min)

### Scene: Staff-Initiated Message
1. Navigate to **Inbox**
2. Click on a customer conversation
3. Click the **"New Message"** button (Send icon) in the conversation header
4. The **Outbound Compose** modal opens
5. Type a message: "Hi! Just wanted to check in — we have availability next week for your follow-up treatment."
6. Click **Send Draft** — toast confirms "Draft created"

**Talk through:**
- "Previously, staff could only reply to incoming messages"
- "Now they can initiate outbound conversations — proactive outreach, follow-ups, check-ins"
- "Messages go through a draft-approve flow for quality control"

### Scene: Draft Approval (Admin)
1. Show the **Outbound Drafts** section (if visible in inbox sidebar or settings)
2. Show a draft with status badge: **Draft** (lavender)
3. Click **Approve** — status changes to **Approved** (sage)
4. "Once approved, the message is sent via WhatsApp — the customer sees it as a normal message"

**Talk through:**
- "Draft → Approve → Send — prevents accidental or off-brand messages"
- "Admins can review all pending outbound messages before they go out"

---

## PART 28: Action History & Audit Trail (1-2 min)

### Scene: Activity Feed
1. Navigate to a **Customer detail** page (click any customer)
2. Scroll to the **Recent Activity** or **Action History** section
3. Show the chronological feed with entries like:
   - **AI** created deposit pending card (lavender Sparkles icon)
   - **Sarah** approved card (sage User icon)
   - **System** booking confirmed (sage Bot icon)
   - **AI** created overdue reply card
   - **Maria** dismissed card

### Scene: Diff View
1. Find an entry with a status change (e.g., "Booking status changed")
2. Show the **before/after diff**: `PENDING_DEPOSIT → CONFIRMED`
3. "Every change is tracked — who did it, when, and what changed"

**Talk through:**
- "Complete audit trail for every action — AI and human"
- "Three actor types: Staff (you), AI (the system), and System (automated processes)"
- "This is critical for compliance, training, and resolving disputes"
- "You can see exactly what the AI did and why — full transparency"

---

## PART 29: Multi-Vertical — Dealership Demo (2-3 min)

### Scene: Switch to Dealership
1. Log out of Glow Clinic
2. Log in as: **mike@metroauto.com** / **password123**
3. Show the dashboard — notice different branding and terminology

**Talk through:**
- "Booking OS isn't just for clinics — it's a platform that adapts to any service vertical"
- "Metro Auto Group is a dealership — same system, completely different experience"

### Scene: Dealership-Specific Features
1. Show the **service catalog** — Oil Change, Tire Rotation, Brake Inspection, Full Detail, Diagnostic Check
2. Show **service kinds** use APPOINTMENT (not CONSULT/TREATMENT)
3. Navigate to **Bookings** — show the Kanban board with dealership-relevant statuses
4. Show the **customer list** — 15 auto customers with vehicle-related tags
5. Navigate to **Settings > Agent Skills** — show the same 5 agents configured for dealership context

### Scene: Vertical Pack Differences
1. Point out UI differences: terminology, service types, workflow steps
2. "The vertical pack system configures everything — services, templates, agent behavior, terminology"
3. "Adding a new vertical is configuration, not code — the platform handles the rest"

**Talk through:**
- "One platform, multiple verticals — aesthetics, automotive, and more to come"
- "Vertical packs configure: services, message templates, AI behavior, autonomy defaults, agent skills"
- "The agentic system works across all verticals — same trust framework, different domain knowledge"

---

## PART 30: Customer Hub & Timeline (1-2 min)

### Scene: Customer Hub
1. Navigate to **Customers** and click on a customer with activity
2. Show the **unified customer profile**: contact info, tags, notes
3. Show the **Customer Notes** section — click **"+ Add Note"**, type a note, save it
4. "Staff can add contextual notes — preferences, medical info, special requests"

### Scene: Unified Timeline
1. Scroll to the **Timeline** section on the customer detail page
2. Show events from 6 sources:
   - Bookings (created, confirmed, completed, cancelled)
   - Conversations (messages sent/received)
   - Notes (staff-added context)
   - Payments (deposits, invoices)
   - Action Cards (AI proposals + outcomes)
   - Automations (triggered rules)
3. "Everything that ever happened with this customer — in one chronological view"

**Talk through:**
- "The customer hub replaces scattered data with a single source of truth"
- "Timeline pulls from 6 different sources — no more switching between pages"
- "Staff see the full picture before every interaction — better context, better service"

---

## PART 31: Wrap Up (1 min)

**Talk through:**
- "That's Booking OS — from tools you operate to an AI partner that operates with you"
- "The system sees what's happening, proposes what to do, and — when you trust it — acts on your behalf"
- "Five layers of intelligence:"
  - "**Signals** — AI monitors bookings, conversations, schedules, and customer behavior"
  - "**Situations** — Patterns are detected: overdue deposits, stalled quotes, open slots, dormant customers"
  - "**Cards** — Every situation becomes an action card with context, reasoning, and a suggested next step"
  - "**Autonomy** — You control the trust dial: Off, Assist, or Auto — per action type"
  - "**Agents** — Background agents run 24/7: filling waitlist gaps, catching duplicates, optimizing schedules"
- "Full audit trail — every AI action is logged with who, what, when, and why"
- "Works across verticals — aesthetics, automotive, and any service business"
- "3,154 tests, production-deployed at businesscommandcentre.com — enterprise-grade quality"
- "From reactive inbox tool to proactive business co-pilot — that's the agentic transformation"

---

## Quick Reference: Webhook Commands

All commands to simulate WhatsApp messages during the demo:

```bash
# 1. Emma wants to book Botox
curl -X POST http://localhost:3001/api/v1/webhook/inbound -H 'Content-Type: application/json' -d '{"from":"+14155550201","body":"Hi! I would like to book a Botox treatment for next Tuesday please","externalId":"demo_msg_001"}'

# 2. Emma confirms time
curl -X POST http://localhost:3001/api/v1/webhook/inbound -H 'Content-Type: application/json' -d '{"from":"+14155550201","body":"2pm would be perfect!","externalId":"demo_msg_002"}'

# 3. Sofia wants to cancel
curl -X POST http://localhost:3001/api/v1/webhook/inbound -H 'Content-Type: application/json' -d '{"from":"+14155550203","body":"Hi, I need to cancel my Chemical Peel appointment tomorrow. Something came up.","externalId":"demo_msg_003"}'

# 4. James asks about services (auto-reply test)
curl -X POST http://localhost:3001/api/v1/webhook/inbound -H 'Content-Type: application/json' -d '{"from":"+14155550202","body":"What services do you offer and what are your prices?","externalId":"demo_msg_004"}'

# 5. James wants a human (transfer test)
curl -X POST http://localhost:3001/api/v1/webhook/inbound -H 'Content-Type: application/json' -d '{"from":"+14155550202","body":"I would like to speak with a real person please. I have some specific medical questions about the Botox treatment.","externalId":"demo_msg_005"}'

# 6. New customer asks a general question
curl -X POST http://localhost:3001/api/v1/webhook/inbound -H 'Content-Type: application/json' -d '{"from":"+14155559999","body":"Hi! Do you do walk-ins or do I need an appointment? Also, is parking available?","externalId":"demo_msg_006"}'
```

## Demo CSV File

Save as `demo-customers.csv`:
```csv
name,phone,email,tags
Alex Johnson,+14155551001,alex@example.com,new;referred
Mia Chen,+14155551002,mia@example.com,vip
David Park,+14155551003,david@example.com,regular
Lisa Wang,+14155551004,,new
Roberto Silva,+14155551005,roberto@example.com,regular;returning
```
