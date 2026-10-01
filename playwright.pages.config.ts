import { defineConfig } from '@playwright/test';

const target = process.env.STATIC_DEPLOY_TARGET ?? 'pages';
if (!['pages', 'vps'].includes(target)) throw new Error('Ungültiges Releaseziel.');
const port = Number(process.env.PAGES_PREVIEW_PORT ?? (target === 'vps' ? '3189' : '3188'));
const origin = `http://127.0.0.1:${port}`;
const prefix = target === 'vps' ? '' : '/pv-belegung';
export default defineConfig({
  testDir: './scripts', testMatch: 'pages-smoke.spec.ts',
  outputDir: target === 'pages' ? '.release/test-results' : '.release/vps-test-results',
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 90_000, expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: `.release/${target}-smoke-results.json` }]],
  use: {
    baseURL: process.env.PAGES_SMOKE_URL ?? `${origin}${prefix}/`, browserName: 'chromium',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: `${target}-desktop`, use: { viewport: { width: 1440, height: 900 } } },
    { name: `${target}-mobil`, use: { viewport: { width: 375, height: 812 } } },
  ],
  // Lifecycle über `npm run test:pages`; kein Dev-/Next-Server und kein Reuse.
});
