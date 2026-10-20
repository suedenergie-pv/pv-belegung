import { defineConfig } from '@playwright/test';
import basis from './playwright.felder.config';

export default defineConfig({
  ...basis,
  testMatch: 'projekt-navigation.spec.ts',
  projects: (basis.projects ?? []).map((projekt) => ({
    ...projekt,
    use: { ...projekt.use, hasTouch: projekt.name !== 'desktop' },
  })),
});
