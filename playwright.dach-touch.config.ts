import { defineConfig, devices } from '@playwright/test';
import basis from './playwright.config';

export default defineConfig({
  ...basis,
  testMatch: 'dach-touch.spec.ts',
  use: { baseURL: process.env.PV_QA_URL ?? 'http://localhost:3100', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.PV_QA_URL ? undefined : basis.webServer,
  projects: [
    { name: 'ipad-hoch', use: { ...devices['iPad (gen 7)'], browserName: 'webkit' } },
    { name: 'ipad-quer', use: { ...devices['iPad (gen 7) landscape'], browserName: 'webkit' } },
    { name: 'ipad-pro-quer', use: { ...devices['iPad Pro 11 landscape'], browserName: 'webkit' } },
  ],
});
