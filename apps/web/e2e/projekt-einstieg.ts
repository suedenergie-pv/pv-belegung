import { expect, type Page } from '@playwright/test';

/** Bestehende Editorprüfungen wählen ihr Projekt jetzt bewusst in der Übersicht. */
export async function oeffneStartprojekt(page: Page) {
  await expect(page.getByRole('heading', { name: 'Meine Projekte' })).toBeVisible();
  const fortsetzen = page.getByRole('link', { name: /Fortsetzen/ });
  if (await fortsetzen.count()) await fortsetzen.click();
  else await page.getByRole('button', { name: '+ Neues Projekt', exact: true }).click();
}
