import { oeffneStartprojekt } from './projekt-einstieg';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { neuesProjekt } from '../lib/model';

async function punkt(page: Page, xm: number, ym: number) {
  const b = (await page.getByRole('img', { name: /^Belegungsfläche/ }).boundingBox())!;
  return { x: b.x + b.width * (.06 + .88 * xm / 18), y: b.y + b.height * (.87 - .70 * ym / 8) };
}
async function tippe(page: Page, xm: number, ym: number, touch = false) {
  const p = await punkt(page, xm, ym);
  if (touch) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
}
async function felder(page: Page) {
  await expect(page.getByRole('status').filter({ hasText:'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!).projekte[0].projekt.flaechen[0].felder);
}
const browserFehler = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => { expect(browserFehler.get(page) ?? []).toEqual([]); });
const auswahl = (page: Page) => page.getByText('1 von 2 ausgewählt', { exact:true });

test.beforeEach(async ({ page }) => {
  const fehler: string[] = []; browserFehler.set(page, fehler); page.on('pageerror', error => fehler.push(error.message));
  const projekt = neuesProjekt();
  // Neutrale Laufzeit-Fixture; für lokale visuelle QA optional das private Drohnenfoto.
  const dataUrl = process.env.PV_QA_PHOTO
    ? `data:image/jpeg;base64,${(await sharp(readFileSync(process.env.PV_QA_PHOTO)).resize(1600, 900).jpeg({ quality: 85 }).toBuffer()).toString('base64')}`
    : 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>').toString('base64');
  projekt.fotos = [{ id: 'foto', name: 'Drohnenfoto', dataUrl, breitePx: 1600, hoehePx: 900 }];
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt',
    felder: [{ xM: 2, yM: 2, breiteM: 8, hoeheM: 4, quer: false }, { xM: 7, yM: 1, breiteM: 8, hoeheM: 6, quer: false }],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript((projekt) => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./');
  await oeffneStartprojekt(page);

});
test('Ausgewähltes überlapptes Feld behält beim Ziehen Vorrang und Originalindex', async ({ page }, info) => {
  const original = await felder(page);
  await tippe(page, 4, 4, info.project.name === 'mobil');
  await expect(auswahl(page)).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  const p = await punkt(page, 8, 4), q = await punkt(page, 8.8, 4);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 5 }); await page.mouse.up();
  const nachher = await felder(page);
  expect(nachher[1]).toEqual(original[1]);
  expect(nachher[0].xM).toBeGreaterThan(original[0].xM + .5);
  expect(nachher[0].breiteM).toBe(original[0].breiteM);
  // Nach Abwahl gilt wieder die normale Stapelreihenfolge.
  await page.keyboard.press('Escape');
  await tippe(page, 8, 4);
  await expect(page.locator('[data-feld-griff="e"]')).toHaveAttribute('data-feld-index', '1');
});

test('Griff bleibt im Überlappungsbereich erreichbar, auch bei Mehrfachauswahl', async ({ page }, info) => {
  const original = await felder(page);
  await tippe(page, 4, 4, info.project.name === 'mobil');
  await expect(auswahl(page)).toBeVisible();
  const dir = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/feld-ueberlappung'); mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `${info.project.name}-ausgewaehlt.png`) });
  for (const gruppe of [false, true]) {
    if (gruppe) await page.getByRole('button', { name: 'Alle auswählen', exact: true }).click();
    const griff = page.locator('[data-feld-griff="e"][data-feld-index="0"]');
    const b = (await griff.boundingBox())!;
    const p = { x: b.x + b.width / 2 + 10, y: b.y + b.height / 2 };
    // Echte Browser-Treffersuche, nicht dispatchEvent direkt auf den gewünschten Griff.
    expect(await page.evaluate(p => {
      const el = document.elementFromPoint(p.x, p.y);
      return [el?.getAttribute('data-feld-index'), el?.getAttribute('data-feld-griff')];
    }, p)).toEqual(['0', 'e']);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 20, p.y, { steps: 5 }); await page.mouse.up();
    const nachher = await felder(page);
    expect(nachher[1]).toEqual(original[1]);
    expect(nachher[0].xM).toBe(original[0].xM);
    expect(nachher[0].breiteM).toBeGreaterThan(original[0].breiteM);
  }
});
