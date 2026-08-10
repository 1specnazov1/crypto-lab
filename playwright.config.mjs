// CRYPTO LAB v79 build 7930 validation rerun after owner-authority synchronization.
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
  testMatch: /v79-(?:mobile-smoke|intelligence-home-smoke)\.spec\.js/,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'allow'
  },
  projects: [
    { name: 'mobile-390', use: { ...mobileChrome, viewport: { width: 390, height: 844 } } },
    { name: 'mobile-412', use: { ...mobileChrome, viewport: { width: 412, height: 915 } } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 900 } } }
  ]
});
