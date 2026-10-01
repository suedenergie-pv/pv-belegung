import { defineConfig } from '@playwright/test';
import basis from './playwright.touch.config';

export default defineConfig({
  ...basis,
  testMatch: 'mouse-touch.spec.ts',
  projects: [
    { name: 'chromium-hybrid-desktop', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-hybrid-tablet', use: { browserName: 'webkit', viewport: { width: 1024, height: 768 } } },
    { name: 'chromium-hybrid-mobil', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 375, height: 812 } } },
  ],
});
