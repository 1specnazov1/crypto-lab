import { defineConfig, devices } from '@playwright/test';

const mobileChrome = {
  browserName: 'chromium',
  userAgent: devices['Pixel 7'].userAgent,
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true
};

export default defineConfig({
  testDir: './tests',
  testMatch: /v79-owner-mobile-navigation\.spec\.js/,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['line']] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'allow'
  },
  projects: [
    { name: 'owner-mobile-390', use: { ...mobileChrome, viewport: { width: 390, height: 844 } } },
    { name: 'owner-mobile-412', use: { ...mobileChrome, viewport: { width: 412, height: 915 } } }
  ]
});
