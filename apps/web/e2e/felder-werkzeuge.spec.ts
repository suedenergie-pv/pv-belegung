import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { neuesProjekt, type Projekt } from '../lib/model';

const shots = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/feld-tools');
async function stand(page: Page): Promise<Projekt> {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt;
  });
}
async function punkt(page: Page, xm: number, ym: number) {
  const svg = page.getByRole('img', { name: /^Belegungsfläche/ });
  const b = (await svg.boundingBox())!;
  return { x: b.x + b.width * (.06 + .88 * xm / 18), y: b.y + b.height * (.87 - .70 * ym / 8) };
}
async function antippen(page: Page, xm: number, ym: number, touch: boolean) {
  const p = await punkt(page, xm, ym);
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

test('Einzelauswahl, bewusste Gruppe und Module ohne Feldauswahl', async ({ page }, info) => {
  test.setTimeout(90_000);
  mkdirSync(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const projekt = neuesProjekt();
  // Neutrale Laufzeit-Fixture; für lokale visuelle QA optional das private Drohnenfoto.
  const dataUrl = process.env.PV_QA_PHOTO
    ? `data:image/jpeg;base64,${(await sharp(readFileSync(process.env.PV_QA_PHOTO)).resize(1600, 900).jpeg({ quality: 85 }).toBuffer()).toString('base64')}`
    : 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>').toString('base64');
  projekt.fotos = [{ id: 'foto', name: 'Drohnenfoto', dataUrl, breitePx: 1600, hoehePx: 900 }];
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt',
    felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 6, quer: false }, { xM: 12, yM: 1, breiteM: 5, hoeheM: 6, quer: false }],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript((projekt) => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./');
  const touch = info.project.name !== 'desktop';
  const kompakt = info.project.name.startsWith('mobil');
  await expect(page.getByTestId('flaechen-status')).toContainText('2 Felder');
  await antippen(page, 3.5, 4, touch);
  await antippen(page, 14.5, 4, touch);
  await expect(page.getByText('1 von 2 ausgewählt')).toBeVisible();
  await page.getByRole('button', { name: 'nach rechts', exact: true }).click();
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder!.map((f) => f.xM)).toEqual([1, 12.1]);

  const multi = page.getByRole('button', { name: kompakt ? 'Mehrere Felder auswählen' : 'Mehrfachauswahl', exact: true });
  await multi.click();
  await antippen(page, 3.5, 4, touch);
  await expect(page.getByText('2 von 2 ausgewählt')).toBeVisible();
  await multi.click();
  // Ausschalten beendet den Toggle-Modus, erhält aber die gebildete Gruppe.
  const von = await punkt(page, 3.5, 4), nach = await punkt(page, 4, 4);
  await page.mouse.move(von.x, von.y); await page.mouse.down();
  await page.mouse.move(nach.x, nach.y, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder![0]!.xM).toBeGreaterThan(1.1);
  const bewegt = (await stand(page)).flaechen[0]!.felder!;
  // WebKit quantisiert reale Pointerkoordinaten auf CSS-Pixel. Beide Felder
  // müssen exakt denselben Weg gehen, maximal ein Bildpixel vom Soll entfernt.
  const pixelInM = 18 / (.88 * (await page.getByRole('img', { name: /^Belegungsfläche/ }).boundingBox())!.width);
  expect(Math.abs(bewegt[0]!.xM - 1.5)).toBeLessThan(pixelInM + .005);
  expect(bewegt[1]!.xM - bewegt[0]!.xM).toBeCloseTo(11.1, 8);
  await expect(page.getByText('2 von 2 ausgewählt')).toBeVisible();
  await antippen(page, 14.5, 4, touch);
  await expect(page.getByText('1 von 2 ausgewählt')).toBeVisible();
  await page.screenshot({ path: resolve(shots, `${info.project.name}-auswahl.png`) });
  if (!touch) {
    await page.getByRole('button', { name: 'Alle auswählen', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('2 von 2 ausgewählt')).toHaveCount(0);
  }
  await antippen(page, 9, 4, touch);
  await expect(page.getByText('1 von 2 ausgewählt')).toHaveCount(0);

  // Direkt erreichbare Aktion, keine Auswahl und kein Mehr-Menü.
  const entfernen = page.getByRole('button', { name: 'Module entfernen', exact: true });
  await expect(entfernen).toBeVisible();
  await entfernen.click();
  for (const feld of [0, 1]) {
    const modul = page.locator(`[data-modul-key^="f${feld}:"]:not([data-modul-leer])`).first();
    if (touch) await modul.tap(); else await modul.click();
  }
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder!.map((f) => f.leer?.length ?? 0)).toEqual([1, 1]);
  await page.screenshot({ path: resolve(shots, `${info.project.name}-module.png`) });
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder!.map((f) => f.leer?.length ?? 0)).toEqual([1, 0]);
  await entfernen.click();
  const geist = page.locator('[data-modul-leer=true]').first();
  if (touch) await geist.tap(); else await geist.click();
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder!.map((f) => f.leer?.length ?? 0)).toEqual([0, 0]);

  const layout = await entfernen.evaluate((button) => {
    const b = button.getBoundingClientRect(), canvas = document.querySelector('[data-testid=editor-viewport]')!.getBoundingClientRect();
    return { w: b.width, h: b.height, rechts: b.right, unten: b.bottom, vw: innerWidth, vh: innerHeight, canvasH: canvas.height, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(layout.w).toBeGreaterThanOrEqual(44); expect(layout.h).toBeGreaterThanOrEqual(44);
  expect(layout.rechts).toBeLessThanOrEqual(layout.vw); expect(layout.unten).toBeLessThanOrEqual(layout.vh);
  expect(layout.canvasH).toBeGreaterThan(100); expect(layout.overflow).toBe(false);
  expect(errors).toEqual([]);
});
