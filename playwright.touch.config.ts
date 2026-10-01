import { defineConfig } from '@playwright/test';
import basis from './playwright.config';

export default defineConfig({
  ...basis,
  testMatch: 'tablet-fadenkreuz.spec.ts',
  use: { baseURL: process.env.PV_QA_URL ?? 'http://localhost:3100', headless: true, hasTouch: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.PV_QA_URL ? undefined : basis.webServer,
  projects: ['chromium', 'webkit'].flatMap((browserName) => [
    { name: `${browserName}-tablet-quer`, use: { browserName: browserName as 'chromium' | 'webkit', ...(browserName === 'chromium' ? { channel: 'chrome' } : {}), viewport: { width: 1024, height: 768 } } },
    { name: `${browserName}-tablet-hoch`, use: { browserName: browserName as 'chromium' | 'webkit', ...(browserName === 'chromium' ? { channel: 'chrome' } : {}), viewport: { width: 768, height: 1024 } } },
    { name: `${browserName}-mobil`, use: { browserName: browserName as 'chromium' | 'webkit', ...(browserName === 'chromium' ? { channel: 'chrome' } : {}), viewport: { width: 375, height: 812 } } },
    { name: `${browserName}-mobil-quer`, use: { browserName: browserName as 'chromium' | 'webkit', ...(browserName === 'chromium' ? { channel: 'chrome' } : {}), viewport: { width: 812, height: 375 } } },
  ]),
});
