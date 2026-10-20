import { defineConfig } from '@playwright/test';
import basis from './playwright.gauben.config';
export default defineConfig({ ...basis, testMatch: 'flachdach-ausrichten.spec.ts', workers: 2 });
