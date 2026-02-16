# Booking OS - Demo Script

## Pre-Demo Setup

### 1. Start servers
```bash
cd booking-os
npm run dev   # Starts all apps (API :3001, Web :3000, WhatsApp Simulator :3002)
```

### 2. Open browser
- Navigate to http://localhost:3000
- Have a second terminal ready for webhook commands (simulating WhatsApp messages)

### 3. Login credentials
- **Email:** sarah@glowclinic.com
- **Password:** password123

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

## PART 16: Wrap Up (30 sec)

**Talk through:**
- "That's Booking OS — a complete WhatsApp-first operating system for aesthetic clinics"
- "Phase 1 adds the full clinic workflow: intake, deposits, consults, aftercare, self-serve, and ROI tracking"
- "AI handles the heavy lifting: responding to customers, booking appointments, handling cancellations"
- "Staff stay in control with draft review, selective auto-reply, and seamless human handoff"
- "From setup wizard to ROI dashboard — everything a pilot clinic needs to prove value in 90 days"

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
