import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Maßentwurf, Navigation und Sitzungshistorie bleiben auf allen Zielgrößen sicher', async ({ browser }) => {
  test.setTimeout(180_000);
  const ordner = resolve('.debug-shots/editor-integration-2026-09-30/reliability');
  mkdirSync(ordner, { recursive: true });
  const messungen: unknown[] = [];
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [375, 812], [812, 375]]) {
    const context = await browser.newContext({ viewport: { width: width!, height: height! }, hasTouch: width! < 1100 });
    const page = await context.newPage();
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    try {
      await page.goto('http://localhost:3100/');
      await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
      await page.screenshot({ path: resolve(ordner, `${width}-projekt.png`), fullPage: true });
      const erstes = await page.getByLabel('Aktuelles Projekt').inputValue();
      await page.getByLabel('Kunde').fill('Sitzungstest');
      await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
      if (await page.getByRole('button', { name: 'Dachdetails', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
      await expect(page.getByText('Maße: Entwurf · noch nicht bestätigt')).toBeVisible();
      await page.getByLabel('Traufe', { exact: false }).fill('12');
      await page.getByRole('button', { name: '3. Export', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Maßentwurf noch offen' })).toBeVisible();
      await page.screenshot({ path: resolve(ordner, `${width}-entwurf-navigation.png`), fullPage: true });
      await page.getByRole('button', { name: 'Bleiben', exact: true }).click();
      await page.getByRole('button', { name: 'Maße übernehmen', exact: true }).click();
      await expect(page.getByText('Maße: bestätigt', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Rückgängig \(2\)/ })).toBeVisible();
      await page.getByRole('button', { name: '3. Export', exact: true }).click();
      await page.getByRole('button', { name: /Rückgängig \(2\)/ }).click();
      await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
      if (await page.getByRole('button', { name: 'Dachdetails', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
      await expect(page.getByLabel('Traufe', { exact: false })).toHaveValue('10');
      await page.getByRole('button', { name: /Wiederherstellen/ }).click();
      // Der neu montierte, unberührte Maßentwurf folgt dem wiederhergestellten Stand.
      await expect(page.getByLabel('Traufe', { exact: false })).toHaveValue('12');
      await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
      await page.getByRole('button', { name: '+ Neu', exact: true }).click();
      await page.getByLabel('Kunde').fill('Zweites Projekt');
      await page.getByLabel('Adresse').focus();
      await page.getByLabel('Aktuelles Projekt').selectOption(erstes);
      await expect(page.getByText('Maße: bestätigt', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Rückgängig \(2\)/ }).click();
      await expect(page.getByText('Maße: offen', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Wiederherstellen/ }).click();
      if (await page.getByRole('button', { name: 'Dachdetails', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
      await page.getByLabel('Traufe', { exact: false }).fill('');
      await page.getByRole('button', { name: '3. Export', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen', exact: true }).click();
      await expect(page.locator('[data-geometrie-entwurf]').getByRole('alert')).toContainText('korrigieren');
      await expect(page.getByRole('button', { name: '2. Dach & Belegung', exact: true })).toHaveAttribute('aria-current', 'step');
      await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
      await page.getByRole('button', { name: '3. Export', exact: true }).click();
      await page.getByRole('button', { name: 'Für Projektleitung markieren', exact: true }).click();
      await expect(page.getByText(/Übergabe steht noch aus – es wurde nichts versendet/)).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
      const messung = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      expect(messung.overflow).toBe(false);
      expect(fehler).toEqual([]);
      messungen.push({ ...messung, fehler });
      await page.screenshot({ path: resolve(ordner, `${width}-export-markierung.png`), fullPage: true });
    } finally { await context.close(); }
  }
  writeFileSync(resolve(ordner, 'messungen.json'), JSON.stringify(messungen, null, 2));
});
