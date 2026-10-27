import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e', testMatch: 'fuenf-dachflaechen-ablauf.spec.ts',
  workers: 1, retries: 0, timeout: 150_000, expect: { timeout: 12_000 },
  outputDir: '.release/fuenf-dachflaechen/results', reporter: 'list',
  use: { baseURL: process.env.PV_TEST_URL ?? 'http://localhost:3310/', channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'mobil', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  ],
});
