import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Internal/External Boundary', () => {
  test.beforeEach(async ({ page }) => {
    // Login as sarah@glowclinic.com (ADMIN role, NOT SUPER_ADMIN)
    await loginViaApi(page);
  });

  test('customer user cannot see Marketing Autonomy panel on /ai page', async ({ page }) => {
    await page.goto('/ai');
    await page.waitForLoadState('networkidle');

    // The AI overview page should load
    await expect(page.locator('[data-testid="ai-overview"]')).toBeVisible({ timeout: 15000 });

    // Should NOT contain Marketing Autonomy
    await expect(page.locator('text=Marketing Autonomy')).toHaveCount(0);
    await expect(page.locator('text=AB Test')).toHaveCount(0);
    await expect(page.locator('text=Budget Allocation')).toHaveCount(0);
  });

  test('customer user accessing /marketing routes gets redirected', async ({ page }) => {
    // Navigate to /marketing/queue — should redirect to /ai
    await page.goto('/marketing/queue');
    await page.waitForLoadState('networkidle');

    // Should end up at /ai (redirect) or see no marketing content
    await expect(page).toHaveURL(/\/(ai|dashboard)/, { timeout: 15000 });
  });

  test('/ai/agents page shows only core agents, not marketing agents', async ({ page }) => {
    await page.goto('/ai');
    await page.waitForLoadState('networkidle');

    // Click on the Agents tab
    const agentsTab = page.locator('a[href*="/ai/agents"], button:has-text("Agents")').first();
    const tabVisible = await agentsTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (tabVisible) {
      await agentsTab.click();
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto('/ai/agents');
      await page.waitForLoadState('networkidle');
    }

    // Wait for page to load
    await expect(page.locator('[data-testid="agents-page"], text=Core Agents').first()).toBeVisible(
      { timeout: 15000 },
    );

    // Core agents should be visible (if configured)
    const pageContent = await page.textContent('body');

    // Should NOT contain marketing agent names
    expect(pageContent).not.toContain('Blog Writer');
    expect(pageContent).not.toContain('Social Creator');
    expect(pageContent).not.toContain('Email Composer');
    expect(pageContent).not.toContain('Content Calendar');
    expect(pageContent).not.toContain('Content Publisher');
    expect(pageContent).not.toContain('Trend Analyzer');

    // Should NOT have a "Marketing Agents" section
    expect(pageContent).not.toContain('Marketing Agents');
  });

  test('sidebar does not contain marketing nav items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const sidebarText = await sidebar.textContent();

    // Should NOT contain marketing nav links
    expect(sidebarText).not.toContain('Content Queue');
    expect(sidebarText).not.toContain('Email Sequences');
    expect(sidebarText).not.toContain('Rejection Analytics');

    // Should contain customer nav items
    expect(sidebarText).toContain('Inbox');
    expect(sidebarText).toContain('Calendar');
  });

  test('API /agent-config returns only core agents', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/v1/agent-config');

    if (response.ok()) {
      const agents = await response.json();
      const agentTypes = (Array.isArray(agents) ? agents : []).map(
        (a: { agentType: string }) => a.agentType,
      );

      // Should NOT contain marketing agent types
      const marketingTypes = [
        'BlogWriter',
        'SocialCreator',
        'EmailComposer',
        'CaseStudyWriter',
        'VideoScriptWriter',
        'NewsletterComposer',
        'ContentScheduler',
        'ContentPublisher',
        'PerformanceTracker',
        'TrendAnalyzer',
        'ContentCalendar',
        'ContentROI',
      ];

      for (const type of marketingTypes) {
        expect(agentTypes).not.toContain(type);
      }
    }
  });

  test('API /autonomy-settings returns 403 for non-SUPER_ADMIN', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/v1/autonomy-settings');

    // Should be forbidden for regular ADMIN users
    expect(response.status()).toBe(403);
  });
});
