import { defineConfig } from '@playwright/test';

/** Lokale Funktionsabnahme nach Übertragung, kein zusätzlicher CI-Trigger. */
export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: ['feldgassen-sueden.spec.ts', 'gauben-varianten.spec.ts', 'usability-kundentermin.spec.ts'],
  outputDir: '.release/transfer-funktion-results',
  workers: 1,
  retries: 0,
  timeout: 100_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.PV_TEST_URL || 'http://127.0.0.1:3290/',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'mobil', use: { viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
});
