# Booking OS - Demo Script

## Pre-Demo Setup

### 1. Start servers (in separate terminals)
```bash
cd booking-os
npm run dev --workspace=apps/api   # API on http://localhost:3001
npm run dev --workspace=apps/web   # Web on http://localhost:3000
```

### 2. Open browser
- Navigate to http://localhost:3000
- Have a second terminal ready for webhook commands (simulating WhatsApp messages)

### 3. Login credentials
- **Email:** sarah@glowclinic.com
- **Password:** password123

---

## PART 1: Login & Dashboard Overview (1-2 min)

### Scene: Login
1. Open http://localhost:3000 — you'll be redirected to the login page
2. Enter: `sarah@glowclinic.com` / `password123`
3. Click **Sign In** — redirected to Dashboard

### Scene: Dashboard
**Talk through:**
- "This is the Booking OS dashboard — a WhatsApp-first operating system for service businesses"
- Point out the **4 key metrics**: Bookings This Week, Revenue (30 days), Total Customers, Open Conversations
- Show **Today's Appointments** section — Sofia Rodriguez has a Chemical Peel booked
- Show **Unassigned Conversations** — Emma Wilson and James Thompson have open conversations
- "Let's explore the inbox where AI-powered conversations happen"

---

## PART 2: Inbox & AI Draft Responses (3-4 min)

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

## PART 3: Cancellation Flow (1-2 min)

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

## PART 4: Auto-Reply Mode (2-3 min)

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

## PART 5: Human Transfer (1-2 min)

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
3. Conversation is auto-assigned to the business owner
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

## PART 6: Customer Import (2-3 min)

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

## PART 7: Settings & Account Import (1 min)

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

## PART 8: Calendar & Bookings (1 min)

### Scene: Calendar View
1. Click **Calendar** in sidebar
2. Show the day/week view with Sofia's booking (and any new bookings created during demo)
3. Show staff columns
4. Click on a booking to show details

**Talk through:**
- "All bookings appear on the calendar, organized by staff member"
- "Staff can see their daily schedule at a glance"

---

## PART 9: Reports & Analytics (1 min)

### Scene: Reports
1. Click **Reports** in sidebar
2. Show the summary cards
3. Scroll through charts: Bookings Over Time, Revenue, Service Popularity
4. Show Staff Performance table
5. Show Peak Hours analysis

**Talk through:**
- "Business owners get comprehensive analytics"
- "Track bookings, revenue, staff performance, and peak hours"
- "Use these insights to optimize scheduling and staffing"

---

## PART 10: Wrap Up (30 sec)

**Talk through:**
- "That's Booking OS — a complete WhatsApp-first operating system for service businesses"
- "AI handles the heavy lifting: responding to customers, booking appointments, handling cancellations"
- "Staff stay in control with draft review, selective auto-reply, and seamless human handoff"
- "From customer import to conversation intelligence to booking management — everything in one platform"

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
