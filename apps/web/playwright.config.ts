import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev --workspace=@booking-os/api',
      url: 'http://localhost:3001/api/v1',
      timeout: 60000,
      reuseExistingServer: true,
      cwd: '../..',
    },
    {
      command: 'npm run dev --workspace=@booking-os/web',
      url: 'http://localhost:3000',
      timeout: 60000,
      reuseExistingServer: true,
      cwd: '../..',
    },
  ],
});
