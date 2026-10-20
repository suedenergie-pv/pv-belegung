import { defineConfig } from '@playwright/test';
import basis from './playwright.felder.config';
export default defineConfig({
  ...basis, testMatch: 'gauben-bearbeiten.spec.ts', workers: 2,
  projects: (basis.projects ?? []).map(p => ({ ...p, use: { ...p.use, hasTouch: p.name !== 'desktop' } })),
});
