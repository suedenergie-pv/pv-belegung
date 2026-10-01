import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('Mehrere Dachflächen lassen Eigenschaften auch im kurzen Querformat erreichbar', async ({ page }, info) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '+ Dachfläche hinzufügen', exact: true }).click();
    await page.getByRole('button', { name: 'Bereich schließen', exact: true }).click();
  }
  await expect(page.getByLabel('Aktive Dachfläche').locator('option')).toHaveCount(4);
  await page.getByRole('button', { name: 'Dachfläche 1 auswählen', exact: true }).click();
  await expect(page.getByLabel('Aktive Dachfläche')).toHaveValue('p1');
  await expect(page.getByRole('button', { name: 'Dachfläche 1 auswählen', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const foto = await page.getByTestId('editor-viewport').boundingBox();
  const masse = page.getByRole('button', { name: 'Maße bestätigen', exact: true });
  await masse.scrollIntoViewIfNeeded();
  // Bruchteilige CSS-Pixel an der Scrollkante dürfen maximal 1% Rand kosten;
  // die Mitte muss zusätzlich frei anklickbar sein (kein verdeckendes Panel).
  await expect(masse).toBeInViewport({ ratio: .99 });
  expect(await masse.evaluate((el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  expect(await page.getByTestId('editor-viewport').boundingBox()).toEqual(foto);
  const upload = page.getByRole('button', { name: 'Foto hinzufügen', exact: true });
  await expect(upload).toBeInViewport({ ratio: 1 });
  expect(await upload.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 2));
  })).toBe(true);
  const ordner = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/workbench-2026-10-01');
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: resolve(ordner, `${info.project.name}-mehrere-flaechen.png`) });
  await masse.click();
  await page.getByLabel(/^Traufe/).fill('14');
  await page.getByRole('button', { name: 'Maße übernehmen', exact: true }).click();
  expect(await page.evaluate(() => ({ y: scrollY, hoehe: document.documentElement.scrollHeight > innerHeight + 1 }))).toEqual({ y: 0, hoehe: false });
  await expect(page.getByTestId('editor-viewport')).toBeInViewport({ ratio: 1 });
});
