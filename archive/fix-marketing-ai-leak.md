# Bug Fix: Remove Marketing AI Section from Customer-Facing AI Settings

## Context

The AI Settings page at `apps/web/src/app/(protected)/settings/ai/page.tsx` renders a "Marketing AI" section (lines 506–651) that exposes internal-only marketing agent controls to all authenticated business users. Per the project's Internal vs External Boundary documented in `CLAUDE.md`, marketing AI controls must only be accessible to `SUPER_ADMIN` users in the admin app (`apps/admin/`). The customer app should show zero marketing AI UI.

## What to Remove

### 1. Page file: `apps/web/src/app/(protected)/settings/ai/page.tsx`

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
- Remove `Bot`, `Bell`, `Shield` from the lucide-react import if they are no longer used elsewhere in the file
- Remove unused `cn` import if no longer referenced (likely still used by other parts of the page)

### 2. Test file: `apps/web/src/app/(protected)/settings/ai/page.test.tsx`

**Remove all marketing-related test data and tests:**
- Remove `mockAutonomySettings` test fixture (around line 68–71)
- Remove the `/autonomy-settings` mock return from every `mockApi.get` implementation — check each test's mock setup and remove that line
- Remove the entire `// --- Marketing AI Section Tests ---` block (starting around line 146), which includes these tests:
  - "renders marketing AI section"
  - "renders marketing master toggle"
  - "disables marketing agents on toggle off"
  - "renders autonomy level selector with 4 options"
  - "changes default autonomy level on click"
  - "renders review mode selector" (around line 228)
  - "renders notification preferences" (around line 243)
  - "renders save marketing settings button"
  - "shows marketing saved indicator on save"

**Keep all non-marketing tests intact** — the AI Features, Auto-Reply Suggestions, Booking Assistant, AI Personality, and Auto-Reply toggle tests should remain unchanged, just with the `/autonomy-settings` mock line removed from their setup.

## Verification Steps

After making changes:

1. **Run the AI settings page tests:**
   ```bash
   cd apps/web && npx jest src/app/\(protected\)/settings/ai/page.test.tsx --no-coverage
   ```

2. **Run the full web test suite to check for regressions:**
   ```bash
   cd apps/web && npm test
   ```

3. **Run TypeScript type-check to ensure no dangling references:**
   ```bash
   cd apps/web && npx tsc --noEmit
   ```

4. **Verify the E2E boundary tests still pass** (if they exist):
   ```bash
   grep -r "marketing-ai-section\|marketing-master-toggle\|autonomy-level-selector" apps/web/e2e/
   ```
   If any E2E tests reference these test IDs, update them to assert the section does NOT exist.

5. **Grep for any remaining references** to ensure clean removal:
   ```bash
   grep -rn "marketing-ai-section\|marketing-master-toggle\|MarketingAutonomy\|AUTONOMY_LEVELS\|REVIEW_MODES\|NOTIFICATION_EVENTS\|handleMarketingToggle\|handleDefaultAutonomyChange\|handleSaveMarketing\|handleNotificationToggle\|marketingEnabled\|marketingSaved\|autonomy-settings" apps/web/src/app/\(protected\)/settings/ai/
   ```
   This should return zero results.

## What NOT to Change

- Do NOT touch `apps/admin/` — the admin app's marketing controls are correct
- Do NOT touch `apps/api/` — the backend endpoints (`/autonomy-settings`, `/agent-config`) remain, they're consumed by the admin app
- Do NOT remove the `api.get('/ai/settings')` or `api.get('/ai/stats')` calls — those power the core AI settings that stay
- Do NOT modify `apps/web/src/app/(protected)/settings/ai/page.tsx` lines 1–505 (the core AI settings section) beyond removing unused imports/state

## Commit Message

```
fix: remove marketing AI controls from customer-facing settings page

The Marketing AI section (autonomy levels, content review mode,
notification preferences, agent toggle) was incorrectly exposed to
all business users on /settings/ai. Per the internal/external boundary,
these controls are admin-only and belong exclusively in the admin app.

Removes: MarketingAutonomy interface, AUTONOMY_LEVELS, REVIEW_MODES,
NOTIFICATION_EVENTS constants, all marketing state/handlers, the full
Marketing AI JSX section, and associated test cases.
```
