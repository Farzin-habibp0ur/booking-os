# Booking OS — Complete User Stories

Exhaustive inventory of everything each user persona can and cannot do on the platform. Organized by persona, then by feature area. Each story marked with current status.

---

## Personas

| Persona | Description | Role |
|---------|-------------|------|
| **Admin** | Business owner / manager. Full access to all features. | ADMIN |
| **Service Provider** | Staff who performs services (stylist, technician, doctor). Limited to own schedule. | SERVICE_PROVIDER |
| **Agent** | Front desk / reception. Manages bookings and conversations. | AGENT |
| **Customer (Authenticated)** | End customer using self-serve links (reschedule, cancel, claim, quote). No login. | Token-based |
| **Customer (Public)** | Visitor to the public booking portal. No auth required. | None |
| **Super Admin** | Platform-wide admin for pack management. | SUPER_ADMIN |

---

## 1. Authentication & Account

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 1.1 | Sign up with business name, owner name, email, and password | Any (becomes Admin) | Creates business + first admin staff. Password: 12+ chars, mixed case + digit |
| 1.2 | Log in with email and password | All staff | Sets httpOnly cookies. Rate limited: 10/min |
| 1.3 | Log out (clears session, blacklists token) | All staff | Redirects to /login |
| 1.4 | Request password reset via email | All staff | Sends token link. Rate limited: 3/min |
| 1.5 | Reset password using emailed token link | All staff | Token is single-use with expiry |
| 1.6 | Change password while logged in | All staff | Blacklists old token, issues new cookies |
| 1.7 | Accept a staff invitation via email link | Invited staff | Sets password, joins business |
| 1.8 | Verify email address via emailed token link | All staff | Auto-redirects to dashboard on success |
| 1.9 | Resend email verification | All staff | Rate limited: 3/min |
| 1.10 | View own profile (name, email, role, business) via /auth/me | All staff | — |
| 1.11 | Stay logged in across page refreshes (cookie-based session) | All staff | 15-min access token auto-refreshes via 7-day refresh token |
| 1.12 | Get locked out after 5 failed login attempts (15 min) | All staff | Brute force protection |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 1.13 | Change own email address | No endpoint exists |
| 1.14 | Delete own account | No self-service deletion |
| 1.15 | View or manage other businesses | Strict tenant isolation |
| 1.16 | Sign up without a business (join as freelancer) | Business is required at signup |
| 1.17 | Use social login (Google, Facebook, Apple) | Only email/password auth |
| 1.18 | Enable two-factor authentication (2FA) | Not implemented |
| 1.19 | See login history or active sessions | Not tracked in UI |
| 1.20 | Choose a profile photo / avatar | Not implemented |
| 1.21 | Update own locale/language preference from profile | API supports it but no UI setting |

---

## 2. Onboarding / Setup Wizard

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 2.1 | Choose vertical pack (Aesthetic or General) during setup | Admin | Installs default services, templates, profile fields |
| 2.2 | Set business name, timezone, and currency | Admin | — |
| 2.3 | Connect WhatsApp (placeholder) | Admin | UI exists but actual connection requires Meta portal setup |
| 2.4 | Invite staff members by email during setup | Admin | Sends invitation link |
| 2.5 | Define services (name, duration, price, category) | Admin | — |
| 2.6 | Configure working hours per staff member per day | Admin | — |
| 2.7 | View installed message templates | Admin | Read-only in setup |
| 2.8 | Configure required profile fields (medical flags, intake) | Admin | Saves to packConfig |
| 2.9 | Import customers via CSV upload (name, phone, email, tags) | Admin | Max 2MB, 5000 rows, RFC 4180 |
| 2.10 | Import customers from existing conversations | Admin | — |
| 2.11 | Create a test booking to verify setup | Admin | — |
| 2.12 | View setup readiness checklist | Admin | Tracks: staff, services, templates, notifications, hours, pack |
| 2.13 | Skip setup steps | Admin | — |
| 2.14 | Mark setup as complete | Admin | Hides checklist on dashboard |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 2.15 | Choose Dealership pack from UI setup wizard | Only Aesthetic and General shown; dealership installed via API |
| 2.16 | Re-run setup wizard after completion | No way to return to /setup once complete |
| 2.17 | Import from external systems (Calendly, Square, etc.) | Only CSV and conversation import |
| 2.18 | Preview how the booking portal looks during setup | No preview step |
| 2.19 | Set up multiple locations during onboarding | Locations managed separately in settings/API |
| 2.20 | Configure automations during setup | Separate page post-setup |

---

## 3. Dashboard

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 3.1 | View bookings this week (count + trend) | All staff | — |
| 3.2 | View revenue over 30 days | All staff | — |
| 3.3 | View total customer count | All staff | — |
| 3.4 | View open conversation count | All staff | — |
| 3.5 | View no-show rate | All staff | — |
| 3.6 | View average response time | All staff | — |
| 3.7 | View consult-to-treatment conversion rate | All staff | Aesthetic vertical |
| 3.8 | View booking status breakdown | All staff | — |
| 3.9 | View waitlist backfill metrics | All staff | If waitlist feature used |
| 3.10 | See "Attention Needed" items (deposit pending, overdue replies, tomorrow's schedule) | All staff | — |
| 3.11 | View today's appointments list | All staff | — |
| 3.12 | View unassigned conversations | All staff | — |
| 3.13 | See go-live checklist (first-time setup guidance) | Admin | Hidden after setup complete |
| 3.14 | Track "First 10 Bookings" milestone | Admin | With nudge messages |
| 3.15 | Dismiss nudge notifications | Admin | — |
| 3.16 | See email verification banner and resend verification | All staff | If email not verified |
| 3.17 | View AI usage stats | All staff | — |
| 3.18 | Navigate to detailed views by clicking metrics | All staff | Links to bookings, inbox, etc. |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 3.19 | Customize which metrics appear on dashboard | Fixed layout |
| 3.20 | Set custom date ranges for dashboard metrics | Fixed periods (week, 30 days) |
| 3.21 | Export dashboard data | No export functionality |
| 3.22 | Compare metrics across time periods | No comparison view |
| 3.23 | See dashboard for a specific location | No location filter on dashboard |
| 3.24 | Set personal goals or targets for metrics | Not implemented |
| 3.25 | Pin or favorite certain metrics | Not implemented |

---

## 4. Bookings

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 4.1 | View all bookings in a table (customer, service, staff, date, status) | All staff | Paginated, 50 per page |
| 4.2 | Filter bookings by status | All staff | Dropdown: all statuses |
| 4.3 | Create a new booking (pick customer, service, staff, date/time, notes) | All staff | — |
| 4.4 | View booking detail in a modal | All staff | — |
| 4.5 | Update booking fields (service, staff, time, notes, custom fields) | All staff | — |
| 4.6 | Change booking status (pending → confirmed → in-progress → completed, etc.) | All staff | Logs staff context |
| 4.7 | Cancel a booking with reason | All staff | — |
| 4.8 | Mark as no-show | All staff | — |
| 4.9 | Force-book an overlapping slot with reason | All staff | forceBook + forceBookReason captured |
| 4.10 | Bulk select bookings | All staff | Checkbox per row |
| 4.11 | Bulk change status | All staff | — |
| 4.12 | Bulk assign staff | All staff | — |
| 4.13 | Send deposit request to customer | All staff | Triggers payment link via messaging |
| 4.14 | Send reschedule link to customer | All staff | Token-based self-serve link |
| 4.15 | Send cancel link to customer | All staff | Token-based self-serve link |
| 4.16 | Check policy window (can customer still cancel/reschedule?) | All staff | Returns allowed/disallowed with reason |
| 4.17 | Update kanban status (dealership workflow) | All staff | CHECKED_IN → DIAGNOSING → IN_PROGRESS → READY |
| 4.18 | View kanban board | All staff | Filter by location, staff, date range |
| 4.19 | Assign booking to a location | All staff | At creation time |
| 4.20 | Assign booking to a resource (equipment/bay) | All staff | At creation time |
| 4.21 | Add custom fields to a booking | All staff | JSON with 3-level nesting, max 50 keys |
| 4.22 | Create recurring booking series | All staff | Days of week, interval, total count |
| 4.23 | Cancel recurring series (single, future, or all) | All staff | — |
| 4.24 | View recurring series detail | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 4.25 | Search bookings by text (customer name, notes) | No search on bookings list; only status filter |
| 4.26 | Filter bookings by date range in the table view | Date filter exists on calendar but not on bookings table |
| 4.27 | Filter bookings by staff member in the table view | No staff filter on bookings table |
| 4.28 | Filter bookings by service type in the table view | No service filter on bookings table |
| 4.29 | Filter bookings by location in the table view | No location filter on bookings table |
| 4.30 | Export bookings to CSV/Excel | Not implemented |
| 4.31 | Print a booking confirmation | Not implemented |
| 4.32 | Drag-and-drop reschedule from the table | Only via modal |
| 4.33 | See booking history/audit log (who changed what) | Status changes tracked but no UI for full audit trail |
| 4.34 | Add attachments to a booking (photos, documents) | Not implemented |
| 4.35 | Add multiple services to a single booking | One service per booking |
| 4.36 | Set booking color labels | Not implemented |
| 4.37 | Duplicate a booking | Not implemented |
| 4.38 | Set a custom booking duration (overrides service duration) | Uses service duration only |
| 4.39 | Edit a recurring series pattern after creation | Can only cancel; must recreate |
| 4.40 | Sort bookings by column | Not implemented in table |

---

## 5. Calendar

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 5.1 | View day view (staff as columns, time slots as rows) | All staff | — |
| 5.2 | View week view (days as columns) | All staff | — |
| 5.3 | Navigate between dates (prev/next/today) | All staff | — |
| 5.4 | Filter by location | All staff | If locations exist |
| 5.5 | Filter by staff (chip buttons) | All staff | — |
| 5.6 | Click a time slot to create a new booking | All staff | Pre-fills date/time/staff |
| 5.7 | Click a booking to view details | All staff | Opens detail modal |
| 5.8 | See color-coded booking statuses | All staff | — |
| 5.9 | See recurring booking indicators | All staff | Icon on recurring bookings |
| 5.10 | View booking tooltip on hover | All staff | Full details without opening modal |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 5.11 | View monthly calendar | Only day and week views |
| 5.12 | Drag-and-drop to reschedule | Click-only interaction |
| 5.13 | Drag to resize booking duration | Not implemented |
| 5.14 | See external calendar events overlaid (Google/Outlook) | API supports fetching external events but no UI overlay |
| 5.15 | Color-code by service type | Colored by status only |
| 5.16 | See staff availability/working hours shaded on calendar | Not visually indicated |
| 5.17 | See time-off blocks on calendar | Not displayed |
| 5.18 | Print calendar view | Not implemented |
| 5.19 | Export calendar to PDF | Not implemented |
| 5.20 | Set custom time range for calendar grid | Fixed 8am–7pm |
| 5.21 | See resource/equipment scheduling on calendar | Only staff-based calendar |

---

## 6. Customers

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 6.1 | View customer list (name, phone, email, tags, created date) | All staff | Paginated |
| 6.2 | Search customers by name/phone/email | All staff | — |
| 6.3 | Create a new customer (name, phone, email, tags, custom fields) | All staff | — |
| 6.4 | Edit customer details | All staff | — |
| 6.5 | View customer detail page with profile, tags, and stats | All staff | — |
| 6.6 | Add/remove tags on a customer | All staff | — |
| 6.7 | Bulk add tags to selected customers | All staff | — |
| 6.8 | Bulk remove tags from selected customers | All staff | — |
| 6.9 | Import customers via CSV (name, phone, email, tags) | All staff | Max 2MB, 5000 rows |
| 6.10 | Import customers from conversation history | All staff | — |
| 6.11 | View customer's booking history (upcoming + past) | All staff | On detail page |
| 6.12 | View customer's quick stats (total bookings, spend, no-shows) | All staff | On detail page |
| 6.13 | View customer's next appointment | All staff | On detail page |
| 6.14 | Chat with AI about a customer (summarize, show treatments, etc.) | All staff | AI customer chat on detail page |
| 6.15 | Create a booking directly from customer detail page | All staff | — |
| 6.16 | View and edit customer custom fields (vertical-specific) | All staff | E.g., allergies, vehicle info |
| 6.17a | Add, edit, and delete notes on a customer profile | All staff | Staff ownership validation for edit/delete |
| 6.18a | See customer activity timeline (all interactions in one feed) | All staff | 6 sources: bookings, conversations, notes, waitlist, quotes, campaigns |
| 6.19a | View customer's conversations from their profile ("Message" button) | All staff | Deep links to `/inbox?conversationId=X` |
| 6.20a | See customer's active waitlist count in context row | All staff | On detail page |
| 6.21a | View vertical-specific modules (IntakeCard for aesthetics, quotes for dealership) | All staff | Collapsible sections on detail page |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 6.17 | Delete a customer | No delete endpoint — only edit |
| 6.18 | Merge duplicate customers | Not implemented |
| 6.19 | Export customer list to CSV | Not implemented |
| 6.20 | ~~View customer communication history (messages)~~ | **DONE** — Timeline tab + "Message" button deep link |
| 6.21 | See customer lifetime value calculation | Only total bookings and raw spend |
| 6.22 | ~~Add notes directly to a customer profile~~ | **DONE** — CustomerNote model with full CRUD |
| 6.23 | Upload customer photos (before/after) | Not implemented |
| 6.24 | Link a customer to multiple phone numbers | One phone per customer per business |
| 6.25 | ~~View customer's waitlist entries~~ | **DONE** — Waitlist count in context row + timeline events |
| 6.26 | ~~View customer's conversation from their profile~~ | **DONE** — "Message" button navigates to `/inbox?conversationId=X` |
| 6.27 | Filter customers by tag | No tag filter on customer list page |
| 6.28 | Filter customers by last visit date | Not implemented |
| 6.29 | Sort customers by column | Not implemented |
| 6.30 | ~~See customer activity timeline (all interactions in one feed)~~ | **DONE** — CustomerTimeline component with 6 event types |

---

## 7. Inbox / Conversations

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 7.1 | View all conversations (3-pane layout: filters, list, thread) | All staff | — |
| 7.2 | Filter conversations: All, Unassigned, Mine, Overdue, Waiting, Snoozed, Closed | All staff | Badge counts per filter |
| 7.3 | Filter by location | All staff | If locations exist |
| 7.4 | Search conversations | All staff | — |
| 7.5 | View conversation thread (messages in chronological order) | All staff | — |
| 7.6 | Send a message in a conversation | All staff | — |
| 7.7 | Use a message template | All staff | Template picker |
| 7.8 | Use quick replies | All staff | Chip buttons |
| 7.9 | Assign conversation to a staff member | All staff | Dropdown in sidebar |
| 7.10 | Unassign conversation (set to null) | All staff | — |
| 7.11 | Close/resolve a conversation | All staff | — |
| 7.12 | Snooze a conversation (1h, 3h, tomorrow, 1 day, 3 days) | All staff | — |
| 7.13 | Add/remove conversation tags | All staff | — |
| 7.14 | Add internal notes to a conversation | All staff | Visible to staff only |
| 7.15 | Delete internal notes | All staff | — |
| 7.16 | Create a booking from a conversation | All staff | Pre-links customer |
| 7.17 | Send deposit request from conversation sidebar | All staff | For PENDING_DEPOSIT bookings |
| 7.18 | View AI draft suggestions with confidence/intent | All staff | Auto-generated |
| 7.19 | Accept or dismiss AI draft | All staff | — |
| 7.20 | Resume auto-reply (after human takeover) | All staff | — |
| 7.21 | View AI conversation summary | All staff | In sidebar |
| 7.22 | See AI booking/cancel/reschedule intent panels | All staff | In sidebar |
| 7.23 | View customer info in sidebar (name, phone, tags, upcoming) | All staff | — |
| 7.24 | View intake card / custom fields in sidebar | All staff | — |
| 7.25 | See unread message badges | All staff | — |
| 7.26 | See overdue conversation indicators | All staff | Red dot |
| 7.27 | See conversation status badges | All staff | OPEN, WAITING, SNOOZED, RESOLVED |
| 7.28 | Real-time message updates via WebSocket | All staff | — |
| 7.29 | View conversation notes in a separate tab | All staff | Info / Notes tabs in sidebar |
| 7.30 | Deep link to a specific conversation via URL param | All staff | `?conversationId=X` auto-selects |
| 7.31 | Click customer name in inbox to navigate to their profile | All staff | Links to `/customers/{id}` |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 7.30 | Send images, documents, or audio | Text-only in UI (API supports content types) |
| 7.31 | Forward or share a conversation | Not implemented |
| 7.32 | Mark a conversation as read/unread manually | Auto-marked on view |
| 7.33 | Create a conversation manually (staff-initiated outbound) | Only inbound-initiated |
| 7.34 | Bulk close conversations | No bulk operations |
| 7.35 | Bulk assign conversations | No bulk operations |
| 7.36 | Edit a sent message | Messages are immutable |
| 7.37 | Delete a message | Messages are immutable |
| 7.38 | See message delivery/read receipts | Not shown in UI |
| 7.39 | Schedule a message for later | Not implemented |
| 7.40 | Use canned responses / saved replies beyond templates | Templates only |
| 7.41 | See typing indicators | Not implemented |
| 7.42 | Pin a conversation | Not implemented |
| 7.43 | Export conversation history | Not implemented |
| 7.44 | Archive a conversation (vs close) | Only close/resolve |
| 7.45 | Start a new conversation with an existing customer | No outbound initiation |
| 7.46 | See which staff member is viewing a conversation | No presence indicators |

---

## 8. Services

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 8.1 | View all services grouped by category | All staff | Cards layout |
| 8.2 | Create a service (name, duration, price, category, kind, description) | All staff | — |
| 8.3 | Edit a service | All staff | — |
| 8.4 | Delete (deactivate) a service | All staff | Soft deactivation |
| 8.5 | Set service kind: Consult, Treatment, or Other | All staff | — |
| 8.6 | Set deposit requirement on a service | All staff | Boolean flag |
| 8.7 | Set buffer times (before/after) | All staff | Minutes |
| 8.8 | Toggle visibility of inactive services | All staff | Show/hide toggle |
| 8.9 | Add custom fields to a service | All staff | JSON |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 8.10 | Set different prices per staff member | One price per service |
| 8.11 | Set different durations per staff member | One duration per service |
| 8.12 | Create service packages (bundles) | Not implemented |
| 8.13 | Set service availability per location | Not linked to locations |
| 8.14 | Upload a service image | Not implemented |
| 8.15 | Set deposit amount (only boolean flag) | No amount field in UI |
| 8.16 | Reorder services within a category | Not implemented |
| 8.17 | Limit which staff can perform a service | No staff-service mapping |
| 8.18 | Set recurring pricing / membership discounts | Not implemented |
| 8.19 | Track service popularity / demand metrics | Not shown per service |

---

## 9. Staff Management

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 9.1 | View all staff members | All staff | Table with expandable rows |
| 9.2 | Create a new staff member (name, email, password, role) | Admin | Direct creation |
| 9.3 | Invite a staff member by email | Admin | Sends invite link |
| 9.4 | Resend invitation email | Admin | — |
| 9.5 | Revoke a pending invitation | Admin | — |
| 9.6 | Edit staff name, email, role | Admin | — |
| 9.7 | Deactivate a staff member | Admin | — |
| 9.8 | Set working hours per day (enable/disable days, start/end times) | Admin, own (SP) | SERVICE_PROVIDER can only edit own |
| 9.9 | Add time off (start date, end date, reason) | Admin, own (SP) | — |
| 9.10 | Remove time off | Admin, own (SP) | — |
| 9.11 | View staff working hours and time off | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 9.12 | Reactivate a deactivated staff member | No reactivation endpoint |
| 9.13 | Delete a staff member permanently | Only deactivation |
| 9.14 | Set break times within working hours | Only start/end per day |
| 9.15 | Set different working hours per location | One schedule per staff |
| 9.16 | View a staff member's bookings from the staff page | Must go to bookings/calendar |
| 9.17 | Set staff specialties / services they can perform | No staff-service mapping |
| 9.18 | Upload staff profile photos | Not implemented |
| 9.19 | Set staff color for calendar display | Not implemented |
| 9.20 | View staff performance metrics from staff page | Must go to reports |
| 9.21 | Set staff commission rates | Not implemented |
| 9.22 | Bulk import staff | Not implemented |

---

## 10. Waitlist

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 10.1 | View all waitlist entries | All staff | Table with filters |
| 10.2 | Filter by status (Active, Offered, Booked, Expired, Cancelled) | All staff | — |
| 10.3 | Filter by service | All staff | — |
| 10.4 | Resolve a waitlist entry (link to a booking) | All staff | — |
| 10.5 | Cancel a waitlist entry | All staff | With confirmation |
| 10.6 | Update entry notes or assigned staff | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 10.7 | Create a waitlist entry from the staff UI | Only via public booking portal or API |
| 10.8 | Manually send an offer to a waitlist entry | Automated only |
| 10.9 | Set waitlist priority | No priority system |
| 10.10 | See waitlist entries on the customer detail page | Not linked in UI |
| 10.11 | Bulk manage waitlist entries | No bulk operations |
| 10.12 | Configure offer expiry time from the waitlist page | In settings/API only |

---

## 11. Campaigns

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 11.1 | View all campaigns (name, status, scheduled time) | All staff | — |
| 11.2 | Create a new campaign (name, template, filters, scheduled time) | Admin | — |
| 11.3 | Edit a campaign | Admin | — |
| 11.4 | Delete a campaign | Admin | — |
| 11.5 | Preview audience count based on filters | All staff | Tags + services filter |
| 11.6 | Send a campaign (bulk messages) | Admin | Rate limited: 5/min |
| 11.7 | View campaign delivery stats (total, sent, delivered, read, failed) | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 11.8 | A/B test campaign content | Not implemented |
| 11.9 | Schedule recurring campaigns | One-time only |
| 11.10 | Filter audience by last visit date | Only by tags and services |
| 11.11 | Filter audience by booking status or spend | Not implemented |
| 11.12 | See per-recipient delivery status | Aggregate stats only |
| 11.13 | Track campaign ROI (bookings attributed) | Stats field exists but no attribution UI |
| 11.14 | Duplicate a campaign | Not implemented |
| 11.15 | Cancel a sending campaign | No cancel-in-progress |
| 11.16 | Preview message rendering with actual customer data | Template preview only |

---

## 12. Automations

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 12.1 | View pre-built playbooks | All staff | — |
| 12.2 | Toggle playbooks on/off | Admin | — |
| 12.3 | View custom automation rules | All staff | — |
| 12.4 | Create custom rule (trigger, filters, actions, quiet hours, max/day) | Admin | — |
| 12.5 | Edit a custom rule | Admin | — |
| 12.6 | Delete a custom rule | Admin | — |
| 12.7 | Toggle a custom rule on/off | Admin | — |
| 12.8 | Test a rule (dry run) | Admin | — |
| 12.9 | View automation activity log (rule, action, outcome, time) | All staff | — |
| 12.10 | See skipped automation reasons | All staff | In activity log |
| 12.11 | Set quiet hours for automations | Admin | Start/end HH:mm |
| 12.12 | Set max messages per customer per day | Admin | 0-100 |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 12.13 | Create multi-step automation sequences (workflows) | Single action per rule only |
| 12.14 | Add delays between actions | No delay support |
| 12.15 | Use conditional branching (if/else) | Not implemented |
| 12.16 | Trigger automations manually | Only event-driven |
| 12.17 | Duplicate a rule | Not implemented |
| 12.18 | Export/import automation rules | Not implemented |
| 12.19 | See automation performance metrics (conversion rates) | Log only shows sent/skipped/failed |
| 12.20 | Create automations with customer property triggers | Only booking/conversation triggers |
| 12.21 | Visual automation builder (drag-and-drop) | List-based UI only |

---

## 13. Settings

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 13.1 | Edit business profile (name, phone, timezone) | Admin | — |
| 13.2 | Configure cancellation policy (window hours, policy text) | Admin | 1-168 hours |
| 13.3 | Configure reschedule policy (window hours, policy text) | Admin | 1-168 hours |
| 13.4 | Enable/disable policies | Admin | — |
| 13.5 | Configure notification settings (channels, follow-up delay) | Admin | — |
| 13.6 | Manage message templates (CRUD) | Admin | — |
| 13.7 | Configure waitlist settings (offer count, expiry, quiet hours) | Admin | — |
| 13.8 | Manage offers (create, edit, activate/deactivate, set expiry, max redemptions) | Admin | — |
| 13.9 | Configure AI settings (enable/disable, personality, auto-reply) | Admin | — |
| 13.10 | Manage translations / i18n overrides per locale | Admin | — |
| 13.11 | Install a vertical pack | Admin | — |
| 13.12 | Configure customer profile fields | Admin | — |
| 13.13 | Connect Google Calendar (OAuth) | All staff | Own calendar |
| 13.14 | Connect Outlook Calendar (OAuth) | All staff | Own calendar |
| 13.15 | Disconnect a calendar | All staff | Own calendar |
| 13.16 | Get iCal feed URL for external subscription | All staff | — |
| 13.17 | Regenerate iCal feed token | All staff | — |
| 13.18 | Manually sync external calendar events | All staff | — |
| 13.19 | View subscription / billing status | Admin | — |
| 13.20 | Open Stripe checkout for plan upgrade | Admin | — |
| 13.21 | Open Stripe customer portal | Admin | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 13.22 | Change business slug | Set once at creation, not editable |
| 13.23 | Delete business | No self-service deletion |
| 13.24 | Set business logo / branding | Not implemented |
| 13.25 | Customize booking portal appearance (colors, logo) | Not implemented |
| 13.26 | Set business hours (separate from staff hours) | Business-level hours not supported |
| 13.27 | Configure email notification templates | WhatsApp templates only |
| 13.28 | Set up webhook integrations to external systems | Not user-facing |
| 13.29 | Export all business data | Not implemented |
| 13.30 | Set currency (no setting post-setup) | Only during setup wizard |
| 13.31 | Configure SMS as a messaging channel | WhatsApp only |
| 13.32 | Set timezone per location | One timezone per business |

---

## 14. Locations & Resources

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 14.1 | Create a location (name, address, bookable flag) | Admin | — |
| 14.2 | Edit a location | Admin | — |
| 14.3 | Deactivate a location (soft delete) | Admin | — |
| 14.4 | Assign staff to locations | Admin | Many-to-many |
| 14.5 | Remove staff from locations | Admin | — |
| 14.6 | Create resources at a location (name, type, metadata) | Admin | Equipment, bays, etc. |
| 14.7 | Edit a resource | Admin | — |
| 14.8 | Deactivate a resource (soft delete) | Admin | — |
| 14.9 | Configure WhatsApp routing per location | Admin | phoneNumberId in whatsappConfig |
| 14.10 | View all locations and their resources | All staff | — |
| 14.11 | Filter bookings/calendar by location | All staff | — |
| 14.12 | Filter conversations by location | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 14.13 | Set location-specific working hours | Uses staff-level hours |
| 14.14 | Set location-specific services | Services are business-wide |
| 14.15 | Set location-specific pricing | Prices are service-wide |
| 14.16 | View location-specific analytics | Dashboard is business-wide |
| 14.17 | Set location address with map/geocoding | Plain text address only |
| 14.18 | Reactivate a deactivated location | No reactivation endpoint |
| 14.19 | View resource utilization metrics | Not implemented |
| 14.20 | Set resource capacity/concurrent booking limits | Not implemented |
| 14.21 | See a dedicated location management page in the UI | Managed via API; no standalone UI page for locations |

---

## 15. Reports & Analytics

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 15.1 | View bookings over time chart | All staff | Configurable days param |
| 15.2 | View no-show rate | All staff | — |
| 15.3 | View message response times | All staff | — |
| 15.4 | View service breakdown (bookings per service) | All staff | — |
| 15.5 | View staff performance metrics | All staff | — |
| 15.6 | View revenue over time | All staff | — |
| 15.7 | View booking status breakdown | All staff | — |
| 15.8 | View peak hours analysis | All staff | — |
| 15.9 | View consult-to-treatment conversion rate | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 15.10 | Export reports to PDF/CSV | Not implemented |
| 15.11 | Schedule automated report emails | Not implemented |
| 15.12 | Create custom reports | Fixed report types |
| 15.13 | Compare date ranges | Not implemented |
| 15.14 | Filter reports by location | Not implemented |
| 15.15 | Filter reports by staff member | Staff breakdown exists but no filter |
| 15.16 | See customer retention/churn metrics | Not implemented |
| 15.17 | See revenue per customer metrics | Not implemented |
| 15.18 | See booking source attribution | Not tracked |

---

## 16. ROI Dashboard

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 16.1 | Start ROI tracking (go-live) | Admin | Captures baseline metrics |
| 16.2 | View baseline (pre-platform) metrics | Admin | — |
| 16.3 | View current ROI dashboard (bookings, revenue, growth vs baseline) | Admin | — |
| 16.4 | View weekly review | Admin | — |
| 16.5 | Email weekly review | Admin | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 16.6 | Reset or recalibrate baseline | One-time capture |
| 16.7 | Set custom ROI goals | Not implemented |
| 16.8 | Share ROI dashboard externally | Not implemented |
| 16.9 | Compare ROI across locations | Not implemented |

---

## 17. AI Features

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 17.1 | Enable/disable AI features | Admin | — |
| 17.2 | Configure AI personality | Admin | — |
| 17.3 | Enable/disable auto-reply | Admin | — |
| 17.4 | View AI draft reply suggestions in inbox | All staff | With confidence and detected intent |
| 17.5 | Accept or dismiss AI drafts | All staff | — |
| 17.6 | Resume auto-reply after human takeover | All staff | — |
| 17.7 | Generate conversation summary | All staff | — |
| 17.8 | Confirm AI-detected booking intent | All staff | — |
| 17.9 | Confirm AI-detected cancellation intent | All staff | — |
| 17.10 | Confirm AI-detected reschedule intent | All staff | — |
| 17.11 | Chat with AI about a specific customer | All staff | On customer detail page |
| 17.12 | View AI usage stats | All staff | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 17.13 | Train AI on custom responses | Not implemented |
| 17.14 | Set AI auto-reply hours (only on when enabled globally) | No time-based AI toggle |
| 17.15 | Customize AI personality per conversation type | One personality per business |
| 17.16 | View AI accuracy metrics | Not tracked |
| 17.17 | Override AI intent detection rules | Not implemented |
| 17.18 | Use AI for report generation or insights | Not implemented |

---

## 18. Public Booking Portal

### What Customers CAN Do

| # | Story | Notes |
|---|-------|-------|
| 18.1 | View business services (name, duration, price, description) | — |
| 18.2 | Select a service | — |
| 18.3 | Pick a date (30-day window) | — |
| 18.4 | Choose an available time slot (grouped by staff) | — |
| 18.5 | Enter contact details (name, phone required; email optional) | — |
| 18.6 | Add notes to booking | — |
| 18.7 | See cancellation/reschedule policies before confirming | If configured |
| 18.8 | See deposit requirements before confirming | If service requires deposit |
| 18.9 | Submit booking | Rate limited: 10/min |
| 18.10 | Join waitlist when no availability | — |
| 18.11 | See booking confirmation with summary | — |

### What Customers CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 18.12 | Choose a specific staff member (only see available slots by staff) | Can see who, but slot selection implicitly chooses |
| 18.13 | Book multiple services at once | One service per booking |
| 18.14 | Create an account / view booking history | No customer login |
| 18.15 | Pay deposit online during booking | Deposit request sent separately after booking |
| 18.16 | See staff bios or photos | Not displayed |
| 18.17 | See customer reviews or ratings | Not implemented |
| 18.18 | Select a preferred location | Not shown on portal |
| 18.19 | Choose a recurring schedule | Not available publicly |
| 18.20 | Add booking to their personal calendar (iCal download) | Not implemented |
| 18.21 | See real-time availability updates | Static on page load |

---

## 19. Self-Serve Links (Customer)

### What Customers CAN Do

| # | Story | Notes |
|---|-------|-------|
| 19.1 | Reschedule an appointment via token link | Pick new date + time, confirm |
| 19.2 | Cancel an appointment via token link | Optional reason |
| 19.3 | Claim a waitlist offer via token link | — |
| 19.4 | View and approve a quote via token link | IP logged for audit |
| 19.5 | See booking summary before taking action | — |
| 19.6 | See policy text (cancellation/reschedule windows) | If configured |
| 19.7 | Browse available slots for rescheduling (30-day window) | — |

### What Customers CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 19.8 | Reschedule outside the policy window | Blocked by policy check |
| 19.9 | Cancel outside the policy window | Blocked by policy check |
| 19.10 | Change the service during reschedule | Same service only |
| 19.11 | Add a message when rescheduling | Not implemented |
| 19.12 | View other bookings they have | Only the one linked to the token |
| 19.13 | Reject a quote with a counter-offer | Only approve; rejection handled via conversation |

---

## 20. Quotes (Dealership / Service)

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 20.1 | Create a quote for a booking (description, amount, PDF URL) | All staff | Rate limited: 10/min |
| 20.2 | View quote detail | All staff | — |
| 20.3 | View quote for a specific booking | All staff | — |
| 20.4 | Customer approves quote via token link | Customer | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 20.5 | Edit a quote after creation | Immutable once created |
| 20.6 | Create multiple quotes for one booking | Not supported |
| 20.7 | Add line items to a quote | Free-text description only |
| 20.8 | Generate quote PDF automatically | Must provide external PDF URL |
| 20.9 | Send quote via message (auto-send link) | Must be done manually or via automation |
| 20.10 | Track quote conversion rates | Not implemented |

---

## 21. Billing & Payments

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 21.1 | View subscription status (plan, status, period end) | Admin | — |
| 21.2 | Start Stripe checkout for Basic or Pro plan | Admin | — |
| 21.3 | Open Stripe customer portal (manage subscription) | Admin | — |
| 21.4 | Create a deposit payment intent for a booking | Admin | — |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 21.5 | Process payments within the app | Redirects to Stripe |
| 21.6 | Issue refunds | Must use Stripe dashboard |
| 21.7 | Create invoices | Not implemented |
| 21.8 | Track payment history per customer | Not in UI |
| 21.9 | Set up payment plans / installments | Not implemented |
| 21.10 | Accept payments at point of service | No POS integration |
| 21.11 | View revenue collected vs outstanding | Not implemented |

---

## 22. Global Features

### What Users CAN Do

| # | Story | Persona | Notes |
|---|-------|---------|-------|
| 22.1 | Global search (customers, bookings, conversations) | All staff | Cmd+K or search bar |
| 22.2 | Switch language (locale picker on auth pages) | All | — |
| 22.3 | Use command palette (Cmd+K) | All staff | — |
| 22.4 | Toggle dark mode | All staff | — |
| 22.5 | Start interactive demo tour (9 steps) | All staff | Sidebar button or ?tour=true |
| 22.6 | Navigate via sidebar (Dashboard, Bookings, Calendar, Customers, etc.) | All staff | — |
| 22.7 | View Swagger API docs | Dev only | Disabled in production |
| 22.7a | Switch between role-based modes (Admin, Agent, Provider) | All staff | Mode switcher pill in sidebar |
| 22.7b | Save and reuse filter views on list pages (bookings, customers, inbox, waitlist) | All staff | ViewPicker + SaveViewModal |
| 22.7c | Pin saved views to sidebar for quick access | All staff | — |
| 22.7d | Pin saved views to dashboard as cards | All staff | — |
| 22.7e | Set default landing page per mode | All staff | Persisted in staff preferences |
| 22.7f | View dedicated search results page with type filters and load more | All staff | `/search?q=` |
| 22.7g | Navigate to detail pages from Cmd+K results | All staff | Customers → profile, conversations → inbox |

### What Users CANNOT Do

| # | Story | Notes |
|---|-------|-------|
| 22.8 | Customize sidebar navigation order | Fixed order |
| 22.9 | ~~Set a default landing page~~ | **DONE** — Staff preferences persist mode + landing path |
| 22.10 | Receive browser push notifications | Not implemented |
| 22.11 | Use keyboard shortcuts for common actions | Only Cmd+K and tour keys |
| 22.12 | Customize date/time format | Follows locale |
| 22.13 | View a global activity feed / audit log | Not implemented |
| 22.14 | Undo/redo actions | Not implemented |
| 22.15 | Use the platform offline | No offline support |

---

## Summary Statistics

| Category | Can Do | Cannot Do |
|----------|--------|-----------|
| Authentication | 12 | 9 |
| Onboarding | 14 | 6 |
| Dashboard | 18 | 7 |
| Bookings | 24 | 16 |
| Calendar | 10 | 11 |
| Customers | 21 | 9 |
| Inbox | 31 | 17 |
| Services | 9 | 10 |
| Staff | 11 | 11 |
| Waitlist | 6 | 6 |
| Campaigns | 7 | 9 |
| Automations | 12 | 9 |
| Settings | 21 | 11 |
| Locations | 12 | 9 |
| Reports | 9 | 9 |
| ROI | 5 | 4 |
| AI | 12 | 6 |
| Public Booking | 11 | 10 |
| Self-Serve | 7 | 6 |
| Quotes | 4 | 6 |
| Billing | 4 | 7 |
| Global | 14 | 7 |
| **Total** | **296** | **199** |
