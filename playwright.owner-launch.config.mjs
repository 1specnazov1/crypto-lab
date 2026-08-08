import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /v79-owner-launch-smoke\.spec\.js/,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'allow'
  },
  projects: [
    { name: 'owner-desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 900 } } }
  ]
});
