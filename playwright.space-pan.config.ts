import { defineConfig } from '@playwright/test';
import basis from './playwright.touch.config';

export default defineConfig({
  ...basis,
  testMatch: 'space-pan.spec.ts',
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 }, hasTouch: false } },
    { name: 'hybrid-webkit', use: { browserName: 'webkit', viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'mobil', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
});
