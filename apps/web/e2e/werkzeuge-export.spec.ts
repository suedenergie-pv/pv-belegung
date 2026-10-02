import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { neuesProjekt, type Projekt } from '../lib/model';

const shots = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/werkzeuge-export');
async function stand(page: Page): Promise<Projekt> {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt;
  });
}

test('Werkzeuge nach Zweck, direkte Aktionen und sichtbarer Export mit Entwurfsschutz', async ({ page }, info) => {
  test.setTimeout(90_000);
  mkdirSync(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const projekt = neuesProjekt();
  const input = process.env.PV_QA_PHOTO ? readFileSync(process.env.PV_QA_PHOTO)
    : Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>');
  const dataUrl = `data:image/jpeg;base64,${(await sharp(input).resize(1600, 900).jpeg({ quality: 85 }).toBuffer()).toString('base64')}`;
  projekt.fotos = [{ id: 'foto', name: 'Drohnenfoto', dataUrl, breitePx: 1600, hoehePx: 900 }];
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt',
    felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 6, quer: false }, { xM: 12, yM: 1, breiteM: 5, hoeheM: 6, quer: false }],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript(projekt => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./');
  const kompakt = info.project.name.startsWith('mobil');
  await expect(page.getByTestId('flaechen-status')).toContainText('2 Felder');
  const exportButton = page.getByRole('button', { name: '3. Export', exact: true });
  const exportLayout = await exportButton.evaluate(b => {
    const r = b.getBoundingClientRect();
    return { height: r.height, right: r.right, bottom: r.bottom, width: innerWidth, heightScreen: innerHeight, color: getComputedStyle(b).backgroundColor };
  });
  expect(exportLayout.height).toBeGreaterThanOrEqual(44);
  expect(exportLayout.right).toBeLessThanOrEqual(exportLayout.width);
  expect(exportLayout.bottom).toBeLessThanOrEqual(exportLayout.heightScreen);
  expect(exportLayout.color).toBe('rgb(184, 61, 30)');
  // SVG-Fotos können nach der bereits sichtbaren Editor-Geometrie dekodieren.
  await page.getByRole('img', { name: /^Belegungsfläche/ }).locator('image').first().evaluate(async element => {
    const img = new Image();
    img.src = (element as SVGImageElement).href.baseVal;
    await img.decode();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({ path: resolve(shots, `${info.project.name}-editor.png`) });
  const auto = page.getByRole('button', { name: 'Automatisch belegen', exact: true }).filter({ visible: true });
  const perspektive = page.getByRole('button', { name: 'Perspektive bearbeiten', exact: true }).filter({ visible: true });
  if (!kompakt) {
    await expect(auto).toBeInViewport();
    await expect(perspektive).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Mehr', exact: true })).toBeInViewport();
  }
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Belegung & Ansicht', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abstand zum Dachrand', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gauben verwalten', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Alle auswählen', exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(shots, `${info.project.name}-mehr.png`) });
  await page.getByRole('button', { name: 'Maße einblenden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Maße ausblenden', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Maße ausblenden', exact: true }).click();

  const vorher = (await stand(page)).flaechen[0]!.felder;
  page.once('dialog', d => d.dismiss());
  await auto.click();
  expect((await stand(page)).flaechen[0]!.felder).toEqual(vorher);
  if (kompakt) await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  page.once('dialog', d => d.accept());
  await auto.click();
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder!.length).toBe(1);
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder).toEqual(vorher);

  // Derselbe Schutz gilt auch für die nun direkt erreichbaren Aktionen.
  await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
  await page.getByLabel('Traufe', { exact: false }).fill('19');
  if (!kompakt) {
    await perspektive.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Bleiben', exact: true }).click();
    await expect(page.getByLabel('Traufe', { exact: false })).toHaveValue('19');
  }
  await exportButton.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Bleiben', exact: true }).click();
  await expect(page.getByLabel('Traufe', { exact: false })).toHaveValue('19');
  await exportButton.click();
  await dialog.getByRole('button', { name: 'Verwerfen', exact: true }).click();
  await expect(page.getByRole('button', { name: '2. Dach & Belegung', exact: true })).toBeVisible();
  await expect(page.getByTestId('flaechen-status')).toHaveCount(0);
  expect((await stand(page)).flaechen[0]!.breiteM).toBe(18);
  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  if (kompakt) await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await perspektive.click();
  await expect(page.getByTestId('perspektiv-editor-steuerung')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
