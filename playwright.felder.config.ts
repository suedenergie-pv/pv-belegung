import { defineConfig } from '@playwright/test';
import basis from './playwright.touch.config';

export default defineConfig({
  ...basis,
  testMatch: 'felder-werkzeuge.spec.ts',
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-quer', use: { browserName: 'webkit', viewport: { width: 1024, height: 768 } } },
    { name: 'tablet-hoch', use: { browserName: 'webkit', viewport: { width: 768, height: 1024 } } },
    { name: 'mobil-hoch', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 375, height: 812 } } },
    { name: 'mobil-quer', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 812, height: 375 } } },
  ],
});
