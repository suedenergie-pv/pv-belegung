import { defineConfig } from '@playwright/test';

const port = Number(process.env.PAGES_PREVIEW_PORT ?? '3188');
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './scripts', testMatch: 'pages-smoke.spec.ts',
  outputDir: '.release/test-results',
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 90_000, expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: '.release/pages-smoke-results.json' }]],
  use: {
    baseURL: process.env.PAGES_SMOKE_URL ?? `${origin}/pv-belegung/`, browserName: 'chromium',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'pages-desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'pages-mobil', use: { viewport: { width: 375, height: 812 } } },
  ],
  // Lifecycle über `npm run test:pages`; kein Dev-/Next-Server und kein Reuse.
});
