import { defineConfig } from '@playwright/test';
import basis from './playwright.felder.config';
export default defineConfig({ ...basis, testMatch: 'aussparungen-bearbeiten.spec.ts', workers: 2 });
