# Dashboard Bug Fix Prompts

Three separate prompts for three distinct bugs. Run them in order since Bug 2 depends on Bug 1's nav changes.

---

## Prompt 1: Give Provider Mode Access to Inbox and Patients

### Context

Provider mode in `apps/web/src/lib/mode-config.ts` restricts navigation to only 5 routes: `/calendar`, `/bookings`, `/services`, `/service-board`, `/dashboard`. When a provider clicks "View Inbox →" on the dashboard, the shell's route guard (`apps/web/src/components/shell.tsx` lines 154–176) detects `/inbox` is not in the allowed set and redirects to `defaultLandingPath` (`/calendar`). Providers need access to `/inbox` and `/customers`.

### Changes Required

#### 1. `apps/web/src/lib/mode-config.ts`

**Update `providerSections` (line 80–84)** — add `/inbox` and `/customers` to the workspace array:

```typescript
// BEFORE (line 80-84):
const providerSections: NavSections = {
  workspace: ['/calendar', '/bookings'],
  tools: ['/services', '/service-board'],
  insights: ['/dashboard'],
};

// AFTER:
const providerSections: NavSections = {
  workspace: ['/inbox', '/calendar', '/customers', '/bookings'],
  tools: ['/services', '/service-board'],
  insights: ['/dashboard'],
};
```

The order matters — it controls sidebar ordering. `/inbox` first, then `/calendar`, then `/customers`, then `/bookings` matches the admin/agent pattern.

#### 2. `apps/web/src/lib/nav-config.ts`

**Update the roles for `/inbox` (line 54)** — add `SERVICE_PROVIDER`:

```typescript
// BEFORE (line 54):
{ href: '/inbox', label: t('nav.inbox'), icon: MessageSquare, roles: ['ADMIN', 'AGENT'] },

// AFTER:
{ href: '/inbox', label: t('nav.inbox'), icon: MessageSquare, roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'] },
```

**Update the roles for `/customers` (line 62–67)** — add `SERVICE_PROVIDER`:

```typescript
// BEFORE (line 62-67):
{
  href: '/customers',
  label: t('nav.customers', { entity: packLabels.customer }),
  icon: Users,
  roles: ['ADMIN', 'AGENT'],
},

// AFTER:
{
  href: '/customers',
  label: t('nav.customers', { entity: packLabels.customer }),
  icon: Users,
  roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
},
```

#### 3. `apps/web/src/components/shell.tsx`

**Update the mobile tab bar priority for provider mode (around line 266–269):**

```typescript
// BEFORE (line 266-269):
// provider → calendar, bookings, dashboard, services
const mobileTabPriority: string[] =
  modeDef?.key === 'provider'
    ? ['/calendar', '/bookings', '/dashboard', '/services']
    : ['/inbox', '/calendar', '/customers', '/dashboard'];

// AFTER:
// provider → inbox, calendar, customers, dashboard (now matches agent/admin pattern)
const mobileTabPriority: string[] =
  modeDef?.key === 'provider'
    ? ['/inbox', '/calendar', '/customers', '/dashboard']
    : ['/inbox', '/calendar', '/customers', '/dashboard'];
```

Since both arrays are now identical, you can simplify this to remove the ternary entirely:

```typescript
const mobileTabPriority: string[] = ['/inbox', '/calendar', '/customers', '/dashboard'];
```

#### 4. Update Tests

**`apps/web/src/components/shell-mobile-nav.test.tsx`** — the test at line 159 (`describe('Shell — provider mobile nav')`) and line 202 (`'provider mobile tab bar has fewer link tabs than admin'`) will need updating. Provider now has the same tab count as admin/agent, and includes Inbox + Customers. Update assertions to expect 4 tabs including Inbox and Customers.

### Verification

```bash
# Type-check
cd apps/web && npx tsc --noEmit

# Run shell tests
cd apps/web && npx jest src/components/shell --no-coverage

# Run mobile nav tests
cd apps/web && npx jest src/components/shell-mobile-nav --no-coverage

# Verify provider mode now includes all 4 workspace paths
grep -A4 'providerSections' apps/web/src/lib/mode-config.ts
```

### What NOT to Change

- Do NOT change `defaultLandingPath` for provider — `/calendar` is still the right landing page
- Do NOT change `allowedRoles` for provider mode — `['ADMIN', 'SERVICE_PROVIDER']` is correct
- Do NOT add AI, Reports, Staff, or other admin-only pages to provider mode

---

## Prompt 2: Remove Pinned Views Section from Sidebar

### Context

The sidebar VIEWS section (`apps/web/src/components/shell.tsx` lines 458–486) renders `SavedView` records fetched from `GET /saved-views/pinned`. Currently, "Pending Deposits" and "Overdue Replies" appear here as pinned sidebar links. These are duplicated due to the seed script being re-run (`packages/db/src/seed-demo.ts` line 1517 uses `createMany` without dedup checks), and the backend `dedupeById()` only deduplicates by ID, not by name.

Rather than fixing the dedup logic, the decision is to **remove the pinned views section from the sidebar entirely**. The dashboard's "Attention Needed" section already serves as the primary access point for these operational views. The saved views feature will still exist — users can still create, pin, and use saved views on individual pages (bookings, inbox). We're just removing the sidebar shortcut section.

### Changes Required

#### 1. `apps/web/src/components/shell.tsx`

**Remove the pinned views state and loading logic:**

- Remove the `pinnedViews` state variable (look for `useState` with `pinnedViews`)
- Remove the `loadPinnedViews` callback function (lines 178–187)
- Remove the `useEffect` that calls `loadPinnedViews` (lines 189–191)
- Remove the `SAVED_VIEW_ICONS` constant (look for the icon mapping object, around lines 51–60)

**Remove the pinned views JSX block (lines 458–486):**

Delete the entire block from `{/* Sidebar Pinned Views */}` through the closing `</div>` of `data-testid="pinned-views-section"`:

```tsx
// DELETE THIS ENTIRE BLOCK (lines 458-486):
{pinnedViews.length > 0 && (
  <div className="px-2 pb-2 border-t border-slate-100 dark:border-slate-800 pt-2"
       data-testid="pinned-views-section">
    ...
  </div>
)}
```

**Clean up imports:**

- Remove `Bookmark` from lucide-react imports if no longer used elsewhere
- Remove the `api` import if `loadPinnedViews` was the only consumer (unlikely — check other usages first)

#### 2. `apps/web/src/components/shell.test.tsx`

Remove any test cases that reference:
- `pinned-views-section` test ID
- `saved-views/pinned` API mock
- `pinnedViews` behavior
- `SAVED_VIEW_ICONS`

Keep all other shell tests intact.

#### 3. `packages/db/src/seed-demo.ts`

**Add dedup guard to the `savedView.createMany` call (around line 1517)** to prevent duplicates on re-seed. Even though we're removing the sidebar display, the SavedView records are still used by individual pages. Wrap the creation with a check:

```typescript
// BEFORE (line 1517):
await prisma.savedView.createMany({
  data: [ ... ],
});

// AFTER:
const existingViews = await prisma.savedView.findMany({
  where: { businessId: bizId },
  select: { name: true, staffId: true },
});
const existingKey = new Set(existingViews.map((v) => `${v.name}:${v.staffId ?? 'shared'}`));

const viewsToCreate = [
  {
    businessId: bizId,
    staffId: sarah.id,
    page: 'bookings',
    name: 'Pending Deposits',
    filters: { status: 'PENDING_DEPOSIT' },
    icon: 'flag',
    color: 'amber',
    isPinned: true,
    isDashboard: true,
    sortOrder: 0,
  },
  // ... rest of the views
].filter((v) => !existingKey.has(`${v.name}:${v.staffId ?? 'shared'}`));

if (viewsToCreate.length > 0) {
  await prisma.savedView.createMany({ data: viewsToCreate });
}
```

Also update the `isPinned` values to `false` for "Pending Deposits" and "Overdue Replies" since they no longer need to be pinned to the (now removed) sidebar section. They should still have `isDashboard: true` if they appear on the dashboard.

### Verification

```bash
# Type-check
cd apps/web && npx tsc --noEmit

# Run shell tests
cd apps/web && npx jest src/components/shell --no-coverage

# Verify no remaining references to pinned views in shell
grep -n "pinnedView\|pinned-views-section\|SAVED_VIEW_ICONS\|loadPinnedViews\|saved-views/pinned" apps/web/src/components/shell.tsx

# Should return zero results
```

### What NOT to Change

- Do NOT remove the `SavedView` Prisma model — it's still used by individual page view filters
- Do NOT remove the `GET /saved-views/pinned` API endpoint — other consumers may use it
- Do NOT remove the `SavedViewService.findPinned()` method
- Do NOT touch the dashboard "Attention Needed" section — it remains the primary access point

---

## Prompt 3: Remove Marketing AI Section from Customer-Facing Settings

### Context

The AI Settings page at `apps/web/src/app/(protected)/settings/ai/page.tsx` renders a "Marketing AI" section (lines 506–651) that exposes internal-only marketing agent controls to all authenticated business users. Per the project's Internal vs External Boundary documented in `CLAUDE.md`, marketing AI controls must only be accessible to `SUPER_ADMIN` users in the admin app (`apps/admin/`). The customer app should show zero marketing AI UI.

### Changes Required

#### 1. `apps/web/src/app/(protected)/settings/ai/page.tsx`

**Remove these top-level constants (lines 36–83):**
- `MarketingAutonomy` interface (lines 36–41)
- `AUTONOMY_LEVELS` array (lines 51–56)
- `REVIEW_MODES` array (lines 58–73)
- `NOTIFICATION_EVENTS` array (lines 76–83)

**Remove these state variables (lines 104–112):**
- `marketingAutonomy` / `setMarketingAutonomy`
- `marketingEnabled` / `setMarketingEnabled`
- `defaultAutonomy` / `setDefaultAutonomy`
- `reviewMode` / `setReviewMode`
- `notifications` / `setNotifications`
- `marketingSaved` / `setMarketingSaved`

**Clean up the `useEffect` data fetch (lines 114–141):**
- Remove the `api.get<MarketingAutonomy[]>('/autonomy-settings')` call from the `Promise.all`
- Remove all autonomy-related processing in the `.then()` callback (lines 123–137: `setMarketingAutonomy`, `setMarketingEnabled`, `setDefaultAutonomy` logic)
- Keep the `api.get('/ai/settings')` and `api.get('/ai/stats')` calls intact

**Remove these handler functions (lines 184–217):**
- `handleMarketingToggle` (lines 184–195)
- `handleDefaultAutonomyChange` (lines 197–208)
- `handleNotificationToggle` (lines 210–212)
- `handleSaveMarketing` (lines 214–217)

**Remove the entire Marketing AI JSX block (lines 506–651):**
- Everything from `{/* Marketing AI Settings */}` through the closing `</div>` of `data-testid="marketing-ai-section"`

**Clean up unused imports:**
- Remove `Bot`, `Bell`, `Shield` from the lucide-react import if no longer used elsewhere in the file
- Remove `cn` import only if no longer referenced (likely still used)

#### 2. `apps/web/src/app/(protected)/settings/ai/page.test.tsx`

**Remove all marketing-related test data and tests:**
- Remove `mockAutonomySettings` test fixture (around line 68–71)
- Remove the `/autonomy-settings` mock return from every `mockApi.get` implementation — check each test's mock setup and remove that branch
- Remove the entire `// --- Marketing AI Section Tests ---` block (starting around line 146), which includes these tests:
  - "renders marketing AI section"
  - "renders marketing master toggle"
  - "disables marketing agents on toggle off"
  - "renders autonomy level selector with 4 options"
  - "changes default autonomy level on click"
  - "renders review mode selector"
  - "renders notification preferences"
  - "renders save marketing settings button"
  - "shows marketing saved indicator on save"

Keep all non-marketing tests intact (AI Features, Auto-Reply, Booking Assistant, Personality tests), just with the `/autonomy-settings` mock line removed from their individual setup.

### Verification

```bash
# Run AI settings page tests
cd apps/web && npx jest src/app/\(protected\)/settings/ai/page.test.tsx --no-coverage

# Type-check
cd apps/web && npx tsc --noEmit

# Verify clean removal
grep -rn "marketing-ai-section\|MarketingAutonomy\|AUTONOMY_LEVELS\|REVIEW_MODES\|NOTIFICATION_EVENTS\|handleMarketingToggle\|handleSaveMarketing\|marketingEnabled\|marketingSaved" apps/web/src/app/\(protected\)/settings/ai/

# Should return zero results
```

### What NOT to Change

- Do NOT touch `apps/admin/` — the admin app's marketing controls are correct
- Do NOT touch `apps/api/` — backend endpoints remain for the admin app
- Do NOT remove `api.get('/ai/settings')` or `api.get('/ai/stats')` — those power the core AI settings
- Do NOT modify the core AI settings section (lines 1–505) beyond removing unused imports/state

### Commit Message

```
fix: remove marketing AI controls from customer-facing settings page

The Marketing AI section (autonomy levels, content review mode,
notification preferences, agent toggle) was incorrectly exposed to
all business users on /settings/ai. Per the internal/external boundary,
these controls are admin-only and belong exclusively in the admin app.
```

---

## Suggested Commit Messages

**Prompt 1:**
```
fix: grant provider mode access to inbox and patients pages

Providers clicking "View Inbox" on the dashboard were redirected to
/calendar by the mode route guard. Adds /inbox and /customers to the
provider workspace section, updates nav-config role arrays, and aligns
mobile tab bar with admin/agent pattern.
```

**Prompt 2:**
```
fix: remove pinned views section from sidebar navigation

Pending Deposits and Overdue Replies appeared duplicated in the sidebar
VIEWS section due to seed re-runs creating multiple records and dedup
logic only checking by ID. Removes the sidebar pinned views section
entirely — the dashboard Attention Needed cards serve as the primary
access point. Adds dedup guard to seed script to prevent future
duplicate SavedView records.
```

**Prompt 3:**
```
fix: remove marketing AI controls from customer-facing settings page

The Marketing AI section (autonomy levels, content review mode,
notification preferences, agent toggle) was incorrectly exposed to
all business users on /settings/ai. Per the internal/external boundary,
these controls are admin-only and belong exclusively in the admin app.
```
