# Booking OS - E2E Test Suite

Comprehensive end-to-end testing for the Booking OS web application using Playwright.

## Test Structure

The E2E test suite is organized into the following test files:

### Authentication & Authorization
- **auth.spec.ts** - Core authentication flows (login page, redirects, invalid credentials, protected routes)
- **login.spec.ts** - Detailed login UI testing and logout functionality

### Main Application Features
- **bookings.spec.ts** - Bookings page, list display, navigation
- **customers.spec.ts** - Customers page, search functionality, data display
- **services.spec.ts** - Services page, categories, pricing information
- **staff.spec.ts** - Staff/team management page, roles, availability
- **settings.spec.ts** - Settings pages including business info and AI settings
- **inbox.spec.ts** - Messaging inbox, conversations, message threads

### Navigation & UX
- **navigation.spec.ts** - Sidebar navigation, active states, browser history, page titles
- **setup-wizard.spec.ts** - Initial setup wizard flow for new organizations

### Workflow Tests
- **workflows.spec.ts** - End-to-end clinic journey tests covering critical workflows:
  - Booking lifecycle (create and view)
  - Deposit flow (pending deposit visible)
  - Consult completion flow
  - Self-serve reschedule page loads
  - Self-serve cancel page loads
  - ROI dashboard loads
  - Template settings page shows templates

## Test Helpers

Located in `e2e/helpers/`:

### auth.ts
Provides authentication utilities:
- `loginViaApi()` - Fast authentication by calling API directly and setting token
- `loginViaUi()` - Authentication through the login form UI

**Usage:**
```typescript
import { loginViaApi } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await loginViaApi(page);
});
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npx playwright test --ui
```

### Run specific test file
```bash
npx playwright test e2e/bookings.spec.ts
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Debug tests
```bash
npx playwright test --debug
```

### Run tests matching a pattern
```bash
npx playwright test --grep "bookings"
```

## Test Credentials

Default test user credentials:
- **Email:** sarah@glowclinic.com
- **Password:** password123

These credentials are seeded in the database via the seed script at `packages/db/src/seed.ts`.

## Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL:** http://localhost:3000
- **API URL:** http://localhost:3001
- **Timeout:** 30 seconds per test
- **Retries:** 0 in local, 2 in CI
- **Workers:** Unlimited in local, 1 in CI
- **Screenshots:** Only on failure
- **Trace:** On first retry

### Web Servers

Playwright automatically starts both servers before running tests:
1. API server on port 3001
2. Web server on port 3000

The servers are reused if already running (useful during development).

## Writing New Tests

### Best Practices

1. **Use loginViaApi for speed**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await loginViaApi(page);
   });
   ```

2. **Wait for page load states**
   ```typescript
   await page.goto('/customers');
   await page.waitForLoadState('networkidle');
   ```

3. **Use flexible selectors**
   ```typescript
   // Prefer role-based selectors
   await page.getByRole('button', { name: /submit/i });

   // Use regex for case-insensitive text matching
   await expect(page.locator('body')).toContainText(/customer/i);
   ```

4. **Handle empty states gracefully**
   ```typescript
   const hasData = await page.locator('[data-testid="item"]')
     .first()
     .isVisible()
     .catch(() => false);

   if (!hasData) {
     // Test empty state or skip
   }
   ```

5. **Use proper timeouts**
   ```typescript
   await expect(element).toBeVisible({ timeout: 10000 });
   ```

### Test Template

```typescript
import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('describes what it tests', async ({ page }) => {
    await page.goto('/path');
    await page.waitForLoadState('networkidle');

    // Your test assertions
    await expect(page.locator('body')).toContainText(/expected text/i);
  });

  test('requires authentication', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/protected-path');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

## Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

Reports include:
- Test results with pass/fail status
- Screenshots of failures
- Traces for debugging
- Execution times

## CI/CD Integration

Tests are configured to run in CI environments:
- Increased retries (2 attempts)
- Single worker for consistency
- Forbid `.only()` to prevent incomplete test runs
- Servers start fresh (no reuse)

## Troubleshooting

### Tests fail with "Navigation timeout"
- Ensure both API and web servers are running
- Check that database is seeded with test data
- Increase timeout in playwright.config.ts if needed

### Authentication failures
- Verify test credentials exist in database
- Check that seed script has been run
- Ensure API is accessible at http://localhost:3001

### Flaky tests
- Add `waitForLoadState('networkidle')` after navigation
- Use explicit waits with timeouts
- Check for race conditions in async operations

### Debug mode not working
```bash
# Set headed and slowMo for better visibility
PWDEBUG=1 npx playwright test --headed --slowMo=500
```

## Coverage

Current test coverage includes:
- Authentication flows
- Protected route access
- Main navigation
- All primary feature pages (bookings, customers, services, staff, settings, inbox)
- Empty states and data display
- Search functionality
- Browser navigation (back/forward)
- Page titles and active states

## Future Enhancements

Potential additions:
- Form submission tests
- Data creation/editing flows
- Delete operations with confirmations
- Filter and sort functionality
- Pagination tests
- Mobile viewport testing
- Performance testing
- Accessibility testing (a11y)
- Visual regression testing
