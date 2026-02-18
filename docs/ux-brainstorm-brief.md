# Booking OS — UX Improvement Brainstorm Brief

Use this document to brainstorm user experience improvements for Booking OS, a multi-vertical booking and business management SaaS platform. It contains a complete description of the product, what users can do today, and the gaps that exist.

---

## What Is Booking OS?

Booking OS is a WhatsApp-first booking and business management platform built for service businesses. It currently supports two verticals:

- **Aesthetic clinics** (consult → treatment → aftercare workflows, medical intake, before/after tracking)
- **Car dealerships** (service kanban board, quote approval, resource/bay scheduling)

The platform is designed to be extended to any service vertical via a "Vertical Pack" system that customizes fields, templates, automations, and workflows per industry.

### Target Users
- Small to mid-size service businesses (1-20 staff)
- Business owners, receptionists, and service providers
- Their end customers who book and manage appointments

### Tech Stack
- **Frontend:** Next.js 15 (React 19), Tailwind CSS, standalone deployment
- **Backend:** NestJS REST API + Socket.IO WebSocket
- **Database:** PostgreSQL 16 with Prisma ORM
- **Messaging:** WhatsApp Cloud API (with mock provider for development)
- **AI:** Claude API for intent detection, reply suggestions, conversation summaries
- **Payments:** Stripe (subscriptions + deposits)
- **Calendar:** Google Calendar + Outlook OAuth sync, iCal feed

### Design Language
Minimalist premium aesthetic (Apple Health meets Stripe). Lots of whitespace, subtle shadows, Playfair Display headers, Inter body text. Custom color palette: sage (primary/success), lavender (AI/pending), warm off-white backgrounds.

---

## Architecture Overview

```
                 End Customer                    Staff Member
                      │                               │
          ┌───────────┴──────┐              ┌─────────┴─────────┐
          ▼                  ▼              ▼                   ▼
   Public Booking      Self-Serve      Dashboard            Inbox
   Portal (/book)    Links (/manage)   Bookings          Conversations
                                       Calendar            AI Assist
                                       Customers
                                       Reports
                                       Settings
                                           │
                                    ┌──────┴───────┐
                                    ▼              ▼
                                  API           Database
                               (NestJS)       (PostgreSQL)
                                    │
                          ┌─────────┼──────────┐
                          ▼         ▼          ▼
                      WhatsApp    Stripe     Claude AI
                      Cloud API   Payments   (Anthropic)
```

---

## User Personas

| Persona | Description | Access Level |
|---------|-------------|-------------|
| **Admin** | Business owner/manager. Full access to everything. | All features, settings, billing, staff management |
| **Service Provider** | Staff who performs services. | View bookings/calendar, manage own schedule and time off, use inbox |
| **Agent** | Front desk / receptionist. | Manage bookings, conversations, customers. Cannot change settings or staff |
| **Customer (Public)** | Visitor to booking portal. No account needed. | Book appointments, join waitlist |
| **Customer (Self-Serve)** | Received a link via WhatsApp. Token-based access. | Reschedule, cancel, claim waitlist, approve quotes |

---

## Current Feature Inventory

### What Users CAN Do Today (296 capabilities)

#### Authentication & Account (12)
- Sign up with business name, owner name, email, password (creates business + admin)
- Log in / log out with httpOnly cookie session
- Request + complete password reset via email
- Change password while logged in
- Accept staff invitation via email link
- Verify email address via token link
- Resend email verification
- Auto-session refresh (15-min access token, 7-day refresh token)
- Brute force protection (5 failed attempts = 15-min lockout)

#### Onboarding (14)
- 10-step setup wizard: choose vertical pack → business info → WhatsApp → invite staff → define services → working hours → templates → profile fields → import customers → test booking
- CSV customer import (max 5,000 rows) with preview
- Import customers from conversation history
- Setup readiness checklist on dashboard

#### Dashboard (18)
- Real-time metrics: bookings this week, 30-day revenue, total customers, open conversations
- Secondary metrics: no-show rate, avg response time, consult→treatment conversion, status breakdown
- Waitlist backfill metrics
- "Attention Needed" section: deposit pending, overdue replies, tomorrow's schedule
- Today's appointments and unassigned conversations
- Go-live checklist and "First 10 Bookings" milestone tracker
- Email verification banner
- AI usage stats
- Click-through to detailed views

#### Bookings (24)
- CRUD bookings with customer, service, staff, date/time, notes, custom fields
- Status workflow: PENDING → PENDING_DEPOSIT → CONFIRMED → IN_PROGRESS → COMPLETED / CANCELLED / NO_SHOW
- Kanban workflow for dealerships: CHECKED_IN → DIAGNOSING → AWAITING_APPROVAL → IN_PROGRESS → READY_FOR_PICKUP
- Filter by status
- Bulk select + bulk status change + bulk staff assignment
- Force-book overlapping slots with captured reason
- Send deposit request, reschedule link, or cancel link to customer
- Policy window check (can customer still cancel/reschedule?)
- Assign to location and/or resource (equipment/bay)
- Calendar view: day view (staff as columns) and week view (days as columns)
- Navigate dates, filter by location and staff on calendar
- Click time slot to create booking, click booking to view detail
- Create recurring series (days of week, interval, total count)
- Cancel recurring series (single occurrence, all future, or entire series)

#### Customers (21)
- List with search, paginated
- CRUD with name, phone (required), email, tags, custom fields
- Bulk add/remove tags
- CSV import and conversation import
- Customer Hub: profile, tags, quick stats, context row (last booking, last conversation, waitlist count)
- Customer notes CRUD with staff ownership validation
- Unified activity timeline (6 sources: bookings, conversations, notes, waitlist, quotes, campaigns) with type filtering, pagination, deep links
- Deep link from customer detail to inbox conversations ("Message" button)
- Vertical modules: IntakeCard for aesthetics, quotes summary for dealership (collapsible)
- AI chat on customer detail page (summarize history, show treatments, upcoming bookings)
- Create booking from customer detail

#### Inbox / Conversations (31)
- 3-pane layout: filter sidebar, conversation list, message thread + customer info
- Filter: All, Unassigned, Mine, Overdue, Waiting, Snoozed, Closed (with badge counts)
- Filter by location
- Search conversations
- Send messages, use templates, use quick replies
- Assign/unassign conversations to staff
- Close, snooze (1h/3h/tomorrow/1d/3d), reopen conversations
- Add/remove conversation tags
- Add/delete internal notes (staff-only)
- Create booking from conversation
- AI features: draft suggestions with confidence + detected intent, accept/dismiss drafts, resume auto-reply, conversation summaries, booking/cancel/reschedule intent detection
- Customer sidebar: info, upcoming bookings, intake card, AI summary
- Real-time WebSocket updates for new messages and conversation changes
- Send deposit request from conversation
- Deep link to specific conversation via `?conversationId=` URL param
- Clickable customer name in inbox navigates to customer profile

#### Services (9)
- CRUD services: name, duration, price, category, kind (Consult/Treatment/Other), description
- Set deposit requirement
- Set buffer times (before/after)
- Add custom fields
- Toggle active/inactive with show/hide filter

#### Staff Management (11)
- View all staff, create new (name, email, password, role)
- Invite by email, resend/revoke invitations
- Edit name, email, role (Admin only)
- Deactivate staff
- Set working hours per day per staff (Admin or own for Service Providers)
- Add/remove time off

#### Waitlist (6)
- View entries with status and service filters
- Resolve entry (link to booking), cancel entry, update notes/staff

#### Campaigns (7)
- CRUD campaigns with name, template, audience filters (tags + services), scheduled time
- Preview audience count
- Send campaign (bulk messages with throttling)
- View delivery stats (total, sent, delivered, read, failed)

#### Automations (12)
- Pre-built playbooks with toggle on/off
- Custom rules: trigger (booking created, upcoming, status changed, no response, tag applied, cancelled) + filters + actions
- Quiet hours and max messages per customer per day
- Test rule (dry run)
- Activity log with outcomes (sent/skipped/failed) and reasons

#### Settings (21)
- Business profile, timezone
- Cancellation/reschedule policies (window hours, text, enable/disable)
- Notification settings (channels, follow-up delay)
- Message template management
- Waitlist settings (offer count, expiry, quiet hours)
- Offer management (create, edit, activate, set expiry, max redemptions)
- AI settings (enable, personality, auto-reply)
- Translation/i18n overrides per locale
- Google Calendar + Outlook Calendar OAuth sync
- iCal feed URL + token regeneration
- Stripe checkout and customer portal

#### Locations & Resources (12)
- CRUD locations with name, address, bookable flag
- Assign/remove staff to locations
- CRUD resources at locations (name, type, metadata)
- WhatsApp routing per location
- Filter bookings, calendar, and conversations by location

#### Reports (9)
- Bookings over time, no-show rate, response times, service breakdown
- Staff performance, revenue over time, status breakdown, peak hours
- Consult→treatment conversion rate

#### ROI Dashboard (5)
- Go-live to capture baseline metrics
- View baseline vs current: bookings, revenue, growth
- Weekly review + email weekly review

#### AI Features (12)
- Enable/disable AI, configure personality, toggle auto-reply
- Draft reply suggestions with confidence and intent
- Accept/dismiss drafts, resume auto-reply
- Conversation summary generation
- Booking/cancel/reschedule intent detection and confirmation
- Customer AI chat (ask questions about a specific customer)

#### Public Booking Portal (11)
- Multi-step wizard: select service → pick date (30 days) → choose time slot → enter details → confirm
- See service info (name, duration, price, description)
- See policies and deposit requirements
- Join waitlist when no availability
- Booking confirmation with summary

#### Self-Serve Links (7)
- Reschedule appointment: browse availability, pick new time, confirm
- Cancel appointment with optional reason
- Claim waitlist offer
- View and approve quote (IP logged)

#### Quotes (4)
- Create quote for a booking (description, amount, PDF URL)
- View quote detail, customer approval via token link

#### Billing (4)
- View subscription status, Stripe checkout, customer portal, deposit payment intents

#### Global (14)
- Global search (Cmd+K): customers, bookings, conversations — grouped results, deep links to detail pages, vertical-aware labels
- Dedicated `/search` page with type filter chips, counts, and load more per section
- Role-based mode switcher (Admin/Agent/Provider) with mode-grouped sidebar nav
- Saved filter views on list pages (bookings, customers, inbox, waitlist) with sidebar pinning and dashboard cards
- Staff preferences: persisted default mode and landing page
- Dark mode toggle
- Interactive demo tour (9 steps with spotlight + tooltip)
- Language picker on auth pages
- Command palette

---

### What Users CANNOT Do Today (199 gaps)

Organized by theme for brainstorming.

#### Missing Table/List Functionality
- No search on bookings table (only status filter)
- No date range, staff, service, or location filters on bookings table
- No column sorting on any table (bookings, customers, waitlist)
- No tag filter on customer list
- No customer last-visit-date filter
- No export to CSV/Excel from any list (bookings, customers, reports, conversations)
- No print functionality anywhere

#### Missing Calendar Features
- No monthly calendar view
- No drag-and-drop reschedule or resize on calendar
- No external calendar event overlay (Google/Outlook events not shown)
- No staff availability/working hours visualization on calendar
- No time-off blocks displayed on calendar
- No resource/equipment scheduling view on calendar
- Fixed 8am-7pm grid (not customizable)
- No color-coding by service type (only by status)

#### Missing Customer Features
- Cannot delete or merge duplicate customers
- No customer lifetime value calculation
- No customer photos (before/after)
- Cannot link customer to multiple phone numbers

#### Missing Communication Features
- Cannot send images, documents, or audio from inbox (text-only in UI)
- Cannot initiate outbound conversations (staff can't message first)
- No bulk close or bulk assign conversations
- Cannot edit or delete sent messages
- No message delivery/read receipts shown
- No scheduled messages
- No typing indicators
- Cannot pin or archive conversations
- No presence indicators (who's viewing what)
- No email as a messaging channel (WhatsApp only)
- No SMS channel

#### Missing Booking Features
- Cannot add multiple services to one booking
- Cannot set custom duration per booking (tied to service)
- Cannot attach files/photos to bookings
- Cannot duplicate a booking
- No booking color labels
- Cannot edit recurring series pattern (must delete and recreate)
- No booking audit log visible in UI (who changed what, when)

#### Missing Service Features
- No per-staff pricing or duration
- No service packages/bundles
- No staff-service capability mapping (which staff can do which services)
- No service images
- No deposit amount configuration (only boolean flag)
- Cannot reorder services
- No service popularity metrics
- No membership/recurring pricing

#### Missing Staff Features
- Cannot reactivate deactivated staff
- No break times within working hours
- No per-location working hours
- No staff photos or colors (for calendar)
- No staff specialties or commission rates
- Cannot view staff bookings from staff page

#### Missing Campaign Features
- No A/B testing
- No recurring campaigns
- No advanced audience filters (last visit, spend, booking status)
- No per-recipient delivery status
- No campaign ROI attribution
- Cannot duplicate or cancel-in-progress campaigns

#### Missing Automation Features
- No multi-step sequences (only single action per rule)
- No delays between actions
- No conditional branching (if/else)
- No visual builder (list-based only)
- Cannot duplicate rules

#### Missing Settings/Business Features
- No business logo or branding customization
- No booking portal appearance customization (colors, logo, custom text)
- No business-level hours (only staff-level)
- Cannot change business slug after creation
- Cannot delete business
- No email notification templates (WhatsApp templates only)
- Cannot set currency after setup
- No timezone per location
- No dedicated UI page for location management

#### Missing Account Features
- Cannot change own email address
- No social login (Google, Apple, Facebook)
- No two-factor authentication (2FA)
- No login history or session management
- No profile photos/avatars
- Cannot delete own account

#### Missing Public Booking Portal Features
- No online payment during booking (deposits sent separately after)
- No customer accounts or booking history
- No location selection on booking portal
- No staff bios or photos
- No reviews/ratings
- No add-to-calendar (iCal download) after booking
- Cannot book recurring appointments publicly
- No real-time availability updates

#### Missing Analytics/Reporting Features
- No export for any report
- No automated report emails
- No custom reports
- No date range comparison
- No location-level analytics
- No customer retention/churn metrics
- No revenue per customer
- No booking source attribution

#### Missing Global/Platform Features
- No browser push notifications
- No keyboard shortcuts beyond Cmd+K
- No global activity feed/audit log
- No undo/redo
- No offline support
- Cannot customize date/time format

---

## Business Context

### Current Metrics
- 2,533 automated tests (972 web + 1,561 API)
- API test coverage: 93% statements, 81% branches
- Web test coverage: 78% statements, 73% branches
- Deployed on Railway with CI/CD via GitHub Actions

### Completed Roadmap
- **Phase 1**: Core booking + aesthetic vertical (consult→treatment→aftercare, deposits, reminders, ROI dashboard)
- **Phase 2**: Automations, campaigns, waitlist, calendar sync
- **Phase 3**: Multi-location, resources, dealership vertical, pack builder, kanban, quotes, i18n
- **Test coverage push**: 425+ additional tests
- **Demo strategy**: Rich demo data + interactive product tour
- **UX Phase 1**: Role-based modes (Admin/Agent/Provider), Mission Control dashboard, saved views with sidebar pinning
- **UX Phase 2 (Bundle B)**: Customer Hub redesign, unified timeline (6 data sources), customer notes CRUD, enhanced Cmd+K with deep links, dedicated `/search` page, vertical modules
- **Error handling remediation**: Replaced silent catches with logged warnings, toast error surfaces
- **Security remediation**: 22 fixes across 5 batches (CSP, tenant isolation, input validation, state machine, token blacklisting)

### Not Yet Started
- **Phase 4**: Benchmarking, omnichannel inbox (IG/Messenger/web chat), vertical packs marketplace, customer mini-portal

### North Star Metric
"Completed booked revenue per active business per month"

### Three KPI Pillars
1. Lead → booking conversion rate
2. No-show rate reduction
3. Speed to first response

---

## Brainstorm Prompts

Use these prompts to generate ideas. Feel free to approach from any angle.

1. **Quick wins**: Which of the 215 "cannot do" gaps would deliver the most user value with the least engineering effort? Rank the top 10.

2. **Retention drivers**: What UX improvements would make a business owner log in daily? What creates habit loops?

3. **Conversion blockers**: A prospect is evaluating Booking OS. What missing features would cause them to choose a competitor? What's table stakes?

4. **Customer journey**: Map the end-customer journey from receiving a WhatsApp message → booking → arriving → follow-up. Where are the friction points?

5. **Staff workflow**: A receptionist starts their day. Walk through their ideal morning workflow. Where does the current UX slow them down?

6. **Mobile experience**: The platform is responsive but not mobile-optimized. What mobile-first improvements would matter most for staff on the go?

7. **AI opportunities**: Where could AI features be expanded beyond the current inbox suggestions? Think: smart scheduling, predictive no-shows, automated reporting, natural language queries.

8. **Vertical depth**: For aesthetics and dealerships specifically — what industry-specific UX improvements would create switching costs?

9. **Onboarding**: The current 10-step wizard covers setup. But what about ongoing education? How do you help users discover features they're not using?

10. **Data visibility**: Users have rich data (bookings, revenue, customers, conversations) but limited ways to slice and explore it. What analytics UX would be most impactful?

---

## Constraints

- **No external component libraries.** Strictly Tailwind CSS utility classes. No MUI, shadcn, etc.
- **Every change must include tests.** No code ships without associated test coverage.
- **Minimalist premium design.** Don't over-clutter. Whitespace is intentional.
- **WhatsApp-first messaging.** Email and SMS are future channels, not current.
- **Multi-tenant.** All features must respect business isolation.
- **Vertical-agnostic core.** New features should work across all verticals unless explicitly vertical-specific.
