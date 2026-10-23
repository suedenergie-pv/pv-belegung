import { defineConfig } from '@playwright/test';
import basis from './playwright.felder.config';
export default defineConfig({
  ...basis, testMatch: ['walter-ablauf.spec.ts', 'workbench-layout.spec.ts'], workers: 2,
  projects: [
    ...(basis.projects ?? []).map(p => ({ ...p, use: { ...p.use, hasTouch: p.name !== 'desktop' } })),
    { name: 'kurz-hoch', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 375, height: 500 }, hasTouch: true } },
    { name: 'klein-hoch', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 320, height: 568 }, hasTouch: true } },
    { name: 'desktop-kompakt', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 720, height: 450 }, hasTouch: false } },
  ],
});
