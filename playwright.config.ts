import { defineConfig } from '@playwright/test';

const ansichten = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'tablet-grenze', viewport: { width: 1023, height: 768 } },
  { name: 'mobil-hoch', viewport: { width: 375, height: 812 } },
  { name: 'mobil-quer', viewport: { width: 812, height: 375 } },
];

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ansichten.map((ansicht) => ({
    name: ansicht.name,
    use: { viewport: ansicht.viewport },
  })),
  webServer: {
    command: 'npm run dev -w web -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
