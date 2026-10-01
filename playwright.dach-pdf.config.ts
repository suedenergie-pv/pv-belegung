import { defineConfig } from '@playwright/test';
import basis from './playwright.felder.config';

export default defineConfig({ ...basis, testMatch: 'dach-pdf.spec.ts' });
