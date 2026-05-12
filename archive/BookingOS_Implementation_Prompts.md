# BookingOS Bug Fixes — Claude Code Implementation Prompts

> **CORRECTED v2** — Verified against source code. 4 inaccuracies from original plan fixed.
>
> **How to use:** Copy each prompt block into Claude Code in order. Run tests after each fix.

---

## Fix Order

| # | Bug | Summary | Key Files | Effort | Day |
|---|-----|---------|-----------|--------|-----|
| 1 | 001+003 | Mode init race + URL redirects | use-mode.tsx, shell.tsx | 5h | Day 1 |
| 2 | 002 | Timezone offset | availability.service.ts, calendar/page.tsx | 6h | Day 2 |
| 3 | 005 | Calendar click bubbling | calendar/page.tsx | 1h | Day 3 |
| 4 | 004 | Automations tab switching | ai/automations/page.tsx | 2h | Day 3 |
| 5 | 006 | Customer row clicks | customers/page.tsx | 1h | Day 3 |
| 6 | 007 | Duplicate saved views | seed-demo.ts, view-picker.tsx | 1h | Day 3 |

**Total: ~16 hours / 3 developer days**

---

## Fix 1: Mode Init Race + URL Redirects (BUG-001 + BUG-003)

**Severity: CRITICAL | Effort: 5h | Files: 2**

> ⚠️ **CORRECTION:** The original plan said BUG-001 was caused by SERVICE_PROVIDER users seeing Clinic Manager mode. This is WRONG — `mode-config.ts` already filters modes by role via `getAvailableModes()`, and `mode-switcher.tsx` hides when only 1 mode is available. BUG-001 and BUG-003 are actually the SAME underlying bug: a race condition where Shell's redirect useEffect fires before mode re-derives after user auth loads. They are now combined into one fix.

### Prompt to Paste

```
Fix BUG-001 + BUG-003: Mode initialization race condition causes incorrect redirects.

Direct URL navigation to /staff, /invoices, /ai/agents redirects to /inbox.
Mode switching can crash when localStorage has stale mode from a different role session.

ROOT CAUSE (VERIFIED): In apps/web/src/lib/use-mode.tsx, when the page first loads:
- user is null so role defaults to 'AGENT' (line 46: const role = user?.role || 'AGENT')
- Mode state may be 'admin' from localStorage (previous ADMIN session)
- getAvailableModes('AGENT', pack) doesn't include admin mode
- But the mode useState was already initialized with 'admin' from getInitialMode()
- The useEffect on line 66-69 re-derives mode when user?.id changes, but this
  runs AFTER Shell's redirect useEffect (shell.tsx line 138-159)
- Shell fires redirect with the stale mode before ModeProvider corrects it

The existing guard on shell.tsx line 141 (!modeDef.allowedRoles.includes(user.role))
only catches role/mode mismatch AFTER mode is wrong. It doesn't prevent the race.

FIX (2 files):

1. apps/web/src/lib/use-mode.tsx
   - Add 'modeReady' boolean to ModeContextType and the context value
   - Initialize modeReady as false
   - In the useEffect that re-derives mode on user?.id/user?.role change (line 66-69),
     set modeReady to true AFTER calling setModeState
   - ALSO set modeReady to true if user is already loaded on first render
     (handle the case where auth resolves before ModeProvider mounts)
   - In setMode callback, add validation: check that the new mode's allowedRoles
     includes user.role before updating. If not, return early. This prevents
     stale localStorage values from being accepted.
   - Export modeReady from context alongside mode, setMode, etc.

2. apps/web/src/components/shell.tsx
   - Import modeReady from useMode()
   - In the redirect useEffect (line 138-159), add an early return if !modeReady
   - This prevents the redirect from firing until mode has stabilized
   - Add modeReady to the useEffect dependency array
   - Also: change the role mismatch handling (line 141) from 'return' to
     actively resetting mode: call setMode(getDefaultMode(user.role)) and return.
     Import getDefaultMode from mode-config. This recovers from stale localStorage.

DO NOT modify mode-switcher.tsx — it already correctly filters modes via
availableModes from useMode(), which calls getAvailableModes(role, packName).

After making changes:
- Add test: Shell does not redirect while modeReady is false
- Add test: Shell redirects correctly once modeReady is true for disallowed routes
- Add test: setMode rejects mode that user's role cannot access
- Add test: stale localStorage 'admin' with SERVICE_PROVIDER role recovers to 'provider'
- Run: npm run format && npm run lint && npm test
```

### Verify

```bash
npm run format && npm run format:check && npm run lint && npm test
```

Manual: Open new tab, paste `https://businesscommandcentre.com/staff` directly. Page should load. Try `/invoices`, `/ai/agents`, `/ai/actions` too.

---

## Fix 2: Booking Timezone Offset (BUG-002)

**Severity: MEDIUM | Effort: 6h | Files: 4 + dependency**

> ⚠️ **CORRECTION:** The original plan told Claude Code to `import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'`. These functions were RENAMED in date-fns-tz v3+ (released 2024) to `fromZonedTime` and `toZonedTime`. Installing the latest version with the old names would cause an immediate import error. The corrected prompt below uses the current v3 API.

### Prompt to Paste

```
Fix BUG-002: Booking time mismatch — selecting 14:00 displays as 11:00 AM on calendar.

ROOT CAUSE (VERIFIED): The Business model has a timezone field (default 'UTC') that
is NEVER USED. In apps/api/src/modules/availability/availability.service.ts line 90,
targetDate uses new Date(date + 'T00:00:00') which creates a date in the server's
local time (UTC on Railway). setHours/toISOString produce UTC times. The frontend
calendar (apps/web/src/app/(protected)/calendar/page.tsx) uses getHours() and
toLocaleTimeString() which convert to browser local time, creating the offset.

FIX (4 files + 1 dependency):

0. Install date-fns-tz v3 in the API:
   cd apps/api && npm install date-fns-tz

   CRITICAL: date-fns-tz v3 renamed functions from v2:
   - zonedTimeToUtc is now called fromZonedTime
   - utcToZonedTime is now called toZonedTime
   Use the NEW names. Verify with: grep 'export.*fromZonedTime' node_modules/date-fns-tz/

1. apps/api/src/modules/availability/availability.service.ts
   - import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'
   - In getAvailableSlots(), after fetching the service, also fetch business timezone:
     const business = await this.prisma.business.findUnique({
       where: { id: businessId }, select: { timezone: true } });
     const tz = business?.timezone || 'UTC';
   - Replace line 90: const targetDate = new Date(date + 'T00:00:00');
     With: const targetDate = fromZonedTime(date + 'T00:00:00', tz);
     This interprets '2026-04-03T00:00:00' as midnight in the BUSINESS timezone
     and converts to the correct UTC instant.
   - For slot generation (~line 177-178), create slot times in business timezone:
     const slotStart = fromZonedTime(
       date + 'T' + String(Math.floor(mins/60)).padStart(2,'0') + ':' +
       String(mins%60).padStart(2,'0') + ':00', tz);
   - The 'display' field should show the business-local time (it already does via
     the hours/minutes math — keep this logic unchanged)
   - The 'time' field (slotStart.toISOString()) will now be the correct UTC
   - Also apply tz to dayStart/dayEnd for booking queries (~lines 111, 146-147, 337-338)

2. apps/api/src/modules/booking/booking.service.ts
   - The startTime from the client will now be a correct UTC ISO string
   - Verify new Date(data.startTime) works correctly (it should, UTC in = UTC out)
   - No major changes needed if the availability service is fixed

3. apps/web/src/app/(protected)/calendar/page.tsx
   - The calendar needs to display times in the BUSINESS timezone, not browser timezone
   - Get business timezone from the auth context: user?.business?.timezone || 'UTC'
   - Replace all toLocaleTimeString() calls with timezone-aware versions:
     new Date(b.startTime).toLocaleTimeString([], {
       hour: '2-digit', minute: '2-digit', timeZone: businessTimezone })
   - Replace getHours() for positioning calculations with timezone-aware versions:
     Use Intl.DateTimeFormat to extract hour in business timezone, or:
     const getBusinessHour = (iso) => {
       const parts = new Intl.DateTimeFormat('en', {
         hour: 'numeric', hour12: false, timeZone: businessTimezone
       }).formatToParts(new Date(iso));
       return parseInt(parts.find(p => p.type === 'hour').value);
     };
   - This affects: booking card positioning, time labels, slot click handlers

4. apps/web/src/components/booking-form-modal.tsx
   - selectedSlot.time sent to backend (~line 217) will already be correct UTC
     after fixing availability.service.ts
   - No changes needed unless display of selected time is wrong

After making changes:
- Add unit tests to availability.service.spec.ts:
  Slot at 14:00 in America/Los_Angeles on 2026-04-03 produces
  ISO string 2026-04-03T21:00:00.000Z (UTC = PDT + 7h)
- IMPORTANT: Do NOT break existing bookings. Existing data is UTC and will
  display correctly with the timezone-aware frontend.
- Run: npm run format && npm run lint && npm test
```

### Verify

```bash
npm run format && npm run format:check && npm run lint && npm test
```

Manual: Create a booking at 14:00. Verify it displays as 2:00 PM on the calendar, not 11:00 AM.

---

## Fix 3: Calendar Click Opens Create Form (BUG-005)

**Severity: LOW | Effort: 1h | Files: 1**

> ⚠️ **CORRECTION:** The original plan said to add `e.stopPropagation()` to booking click handlers at "approximately lines 868, 981, 1120". But the desktop day view (line 867) ALREADY has `e.stopPropagation()`. Only the mobile card view and possibly week/month views need it.

### Prompt to Paste

```
Fix BUG-005: Clicking an existing booking on the calendar opens the Create New
Booking form instead of showing the booking detail.

ROOT CAUSE: Event bubbling from booking click handlers to parent time slot handlers.
The desktop day view (line ~867) ALREADY has e.stopPropagation() and works correctly.
But other views are missing it.

FIX apps/web/src/app/(protected)/calendar/page.tsx:

1. Search for ALL onClick handlers that call handleBookingClick or set booking state
2. The desktop day view booking card (~line 867) already has:
   onClick={(e) => { e.stopPropagation(); handleBookingClick(b, e); }}
   DO NOT touch this one.
3. Find the mobile stacked cards view (~line 981):
   onClick={(e) => handleBookingClick(b, e)}
   Change to: onClick={(e) => { e.stopPropagation(); handleBookingClick(b, e); }}
4. Check week view and month view for the same pattern. If any booking card
   onClick lacks stopPropagation, add it.
5. ALSO ensure handleBookingClick itself doesn't need e.stopPropagation() internally
   in case it's called from contexts where it's not on the event handler directly.

After making changes:
- Verify clicking empty slots STILL opens the create booking form
- Verify clicking bookings opens detail/popover in ALL views (day, week, month, mobile)
- Run: npm run format && npm run lint && npm test
```

### Verify

```bash
npm run format && npm run format:check && npm run lint && npm test
```

---

## Fix 4: Automations Tab Switching (BUG-004)

**Severity: LOW | Effort: 2h | Files: 1-2**

### Prompt to Paste

```
Fix BUG-004: On the Automations page (AI Hub > Automations), clicking the
'Custom Rules' or 'Activity Log' tabs does not switch the content — it stays
on the Playbooks view.

CONTEXT: The code in apps/web/src/app/(protected)/ai/automations/page.tsx has
correct tab switching logic (useState with 'playbooks' | 'rules' | 'logs',
onClick handlers calling setTab). Tests pass locally. The issue is likely a
server-side rendering hydration mismatch that breaks React event handlers
in production.

DIAGNOSE AND FIX:

1. Check apps/web/src/app/(protected)/ai/automations/page.tsx:
   - Confirm 'use client' directive is at the top
   - Look for content that differs between server and client render:
     dates, timestamps, Math.random, window references, Date.now()
   - Check if formatTime12h() or any other function produces different
     output on server vs client
   - Check if useCallback/useMemo dependencies could cause stale closures

2. If hydration mismatch found:
   - Wrap dynamic content in a client-only pattern:
     const [mounted, setMounted] = useState(false)
     useEffect(() => setMounted(true), [])
     Render: mounted ? dynamicContent : staticPlaceholder

3. If no hydration issue found, check:
   - Is there a parent layout intercepting click events?
   - CSS: z-index, pointer-events, overflow preventing clicks from reaching tabs
   - Are there TWO automations pages? Check if /automations/page.tsx exists
     alongside /ai/automations/page.tsx
   - Is a loading overlay blocking the tab buttons?

4. Test with a production build locally:
   cd apps/web && npm run build && npm start
   Then test tab switching at localhost:3000/ai/automations

After making changes:
- Run: npm run format && npm run lint && npm test
- Verify all three tabs switch content in production build
```

### Verify

```bash
npm run format && npm run format:check && npm run lint && npm test
```

Manual: Build production, navigate to `/ai/automations`, click all 3 tabs.

---

## Fix 5: Customer Row Click Navigation (BUG-006)

**Severity: LOW | Effort: 1h | Files: 1**

### Prompt to Paste

```
Fix BUG-006: Clicking a customer row in the list does not reliably navigate
to the customer detail page.

CONTEXT: In apps/web/src/app/(protected)/customers/page.tsx, onClick handlers
with router.push('/customers/${c.id}') are on individual <td> cells (not the <tr>).
This means clicks that land on <td> padding or between cells may not trigger.

FIX apps/web/src/app/(protected)/customers/page.tsx:

1. Move onClick from individual <td> cells to the parent <tr> element:
   <tr key={c.id} onClick={() => router.push(`/customers/${c.id}`)}
     className='hover:bg-slate-50 cursor-pointer'>

2. Remove onClick from all individual <td> cells that currently have it

3. Keep e.stopPropagation() on the checkbox <td> to prevent row navigation
   when selecting checkboxes (this already exists)

4. For better accessibility, wrap the customer name in a Next.js <Link>:
   <Link href={`/customers/${c.id}`}>{c.name}</Link>
   This enables right-click > Open in new tab and screen reader navigation

After making changes:
- Add/update test: clicking customer row triggers router.push
- Verify checkbox selection does NOT trigger navigation
- Run: npm run format && npm run lint && npm test
```

### Verify

```bash
npm run format && npm run format:check && npm run lint && npm test
```

---

## Fix 6: Duplicate Saved Views (BUG-007)

**Severity: LOW | Effort: 1h | Files: 2**

### Prompt to Paste

```
Fix BUG-007: Two 'Overdue Replies' saved view chips appear in the Inbox filter bar.

ROOT CAUSE: The frontend ViewPicker (apps/web/src/components/saved-views/view-picker.tsx)
deduplicates by id (line 37: new Map(data.map(v => [v.id, v]))). The backend returns
two SavedView records with different IDs but the same name. The seed-demo.ts has a
dedup guard but it may not have caught views from earlier seed runs.

FIX (2 files):

1. apps/web/src/components/saved-views/view-picker.tsx
   - Change line 37 dedup from id-based to name+page based:
     const unique = [...new Map((data || []).map(v => [v.name + ':' + v.page, v])).values()];
   - NOTE: This means if two views have the same name on the same page,
     only the last one is shown. This is acceptable since duplicate names are confusing.

2. packages/db/src/seed-demo.ts
   - Verify the dedup guard on lines 1529-1585 correctly prevents duplicates
   - The guard uses existingViewKey.has(`${v.name}:${v.staffId ?? 'shared'}`)
   - Check if the issue is that staffId differs between runs (null vs actual ID)
   - Fix: also dedup by name+page combination, not just name+staffId
   - Consider adding a cleanup step before creation:
     await prisma.savedView.deleteMany({
       where: { businessId: bizId, name: 'Overdue Replies' } });
     Then recreate with the correct data

After making changes:
- Run seed script to verify no duplicate creation
- Run: npm run format && npm run lint && npm test
```

### Verify

```bash
npm run format && npm run format:check && npm run lint && npm test
```

---

## Final Checklist After All 6 Fixes

Once all fixes are committed, paste this into Claude Code:

```
Run the complete BookingOS pre-commit checklist and self-validation protocol:

1. npm run format
2. npm run format:check
3. npm run lint
4. npm test

If all pass, give me a summary of:
- Total tests passing
- Any new tests added
- Files modified across all fixes
- Any warnings to be aware of

Then deploy and re-run the full 53-test QA suite to confirm 100% pass rate.
```

---

## Changes From Original Plan

1. BUG-001 and BUG-003 combined into one fix (same root cause: mode init race)
2. Removed unnecessary mode-switcher.tsx changes (filtering already exists)
3. Fixed date-fns-tz imports: `fromZonedTime`/`toZonedTime` (not deprecated names)
4. BUG-005 now targets only views missing stopPropagation (not all views)
5. Total effort reduced from ~20h to ~16h (6 prompts instead of 7)
6. All root causes verified against actual source code line numbers
