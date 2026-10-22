import { oeffneStartprojekt } from './projekt-einstieg';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { neuesProjekt, neueFlaeche, type Projekt } from '../lib/model';
import { homographie, projiziere, type Ecken } from '../lib/foto-geometrie';

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

test('Neues Feld auf zusätzlicher gedrehter Dachperspektive sofort innen verschieben', async ({ page }, info) => {
  const projekt: Projekt = process.env.PV_QA_PROJECT
    ? JSON.parse(readFileSync(process.env.PV_QA_PROJECT, 'utf8')).projekt : neuesProjekt();
  if (!process.env.PV_QA_PROJECT) {
    // Neutrales Mehrflächenfoto: Ein Feldzug kreuzt die SVG-Beschriftungen A/B/C.
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>').toString('base64');
    projekt.fotos = [{ id: 'foto', name: 'Dachfoto', breitePx: 1600, hoehePx: 900, dataUrl }];
    const ecken: Ecken[] = [
      [[380,618],[1320,632],[1338,445],[370,427]], [[845,870],[850,574],[620,568],[610,882]],
      [[894,226],[895,50],[662,8],[656,199]], [[664,59],[1256,77],[1335,426],[651,418]],
    ];
    projekt.flaechen = ecken.map((punkte,i) => ({ ...neueFlaeche(i+1, ['A','B','C','D'][i]!), breiteM:12, hoeheM:7.7, grunddatenFertig:true, massStatus:'bestaetigt',
      fotoZuordnungen:[{fotoId:'foto',traufePx:null,eckenPx:punkte,perspektiveBestaetigt:true,markierungFertig:true}], felder:[] }));
  }
  const f = projekt.flaechen[3]!; f.felder = [];
  await page.addInitScript(projekt => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./'); await oeffneStartprojekt(page);
  await page.getByLabel('Aktive Dachfläche').selectOption(f.id);
  const svg = page.getByRole('img', { name: /^Belegungsfläche/ });
  const foto = projekt.fotos[0]!;
  const h = homographie(f.breiteM, f.hoeheM, f.fotoZuordnungen![0]!.eckenPx!)!;
  const p = async (x: number, y: number) => {
    const b = (await svg.boundingBox())!, pixel = projiziere(h, [x,y]);
    return { x: b.x + b.width * pixel[0] / foto.breitePx, y: b.y + b.height * pixel[1] / foto.hoehePx };
  };
  await page.getByRole('button', { name: '+ Feld zeichnen', exact: true }).click();
  const a = await p(-.1,-.1), b = await p(12.1,7.8);
  await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{steps:8}); await page.mouse.up();
  await expect(page.getByText('1 von 1 ausgewählt', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
  mkdirSync(shots,{recursive:true});
  await page.screenshot({path:resolve(shots,`${info.project.name}-projekt-nach-zeichnen.png`)});
  const ziel = svg.locator('[data-feld-ebene="flaeche"] path').first();
  const vorher = await ziel.getAttribute('d');
  const c = await p(7,3), d = await p(7.6,3);
  await page.mouse.move(c.x,c.y); await page.mouse.down(); await page.mouse.move(d.x,d.y,{steps:8}); await page.mouse.up();
  await expect(ziel).not.toHaveAttribute('d',vorher!);
  await page.screenshot({path:resolve(shots,`${info.project.name}-projekt-erster-zug.png`)});
});

for (const anlegen of ['zeichnen', 'automatisch'] as const) test(`Neues Feld sofort nach ${anlegen} ohne erneute Auswahl ziehen`, async ({ page, browserName }, info) => {
  mkdirSync(shots, { recursive: true });
  const projekt = neuesProjekt();
  const dataUrl = process.env.PV_QA_PHOTO
    ? `data:image/jpeg;base64,${(await sharp(readFileSync(process.env.PV_QA_PHOTO)).resize(1600, 900).jpeg().toBuffer()).toString('base64')}`
    : 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>').toString('base64');
  projekt.fotos = [{ id: 'foto', name: 'Drohnenfoto', dataUrl, breitePx: 1600, hoehePx: 900 }];
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt', felder: anlegen === 'zeichnen' ? [{ xM: 1, yM: 1, breiteM: 6, hoeheM: 6, quer: false }] : [],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript(projekt => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./'); await oeffneStartprojekt(page);
  const ziehen = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (browserName === 'chromium' && info.project.name.startsWith('mobil')) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
    }
  };
  if (anlegen === 'zeichnen') {
    await page.getByRole('button', { name: '+ Feld zeichnen', exact: true }).click();
    const a = await punkt(page, 2, 2), b = await punkt(page, 8, 6);
    await ziehen(a, b);
  } else {
    const automatisch = page.getByRole('button', { name: 'Automatisch belegen', exact: true });
    await automatisch.first().click();
  }
  await expect(page.getByRole('button', { name: 'Auswählen', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const feldIndex = anlegen === 'zeichnen' ? 1 : 0;
  await expect(page.getByText(`1 von ${feldIndex + 1} ausgewählt`, { exact: true })).toBeVisible();
  if (anlegen !== 'zeichnen') await expect.poll(async () => (await stand(page)).flaechen[0]!.felder!.length).toBe(1);
  const vorher = anlegen === 'zeichnen' ? { xM: 2, yM: 2, breiteM: 6, hoeheM: 4, quer: false } : (await stand(page)).flaechen[0]!.felder![0]!;
  const x = vorher.xM + vorher.breiteM / 2, y = vorher.yM + vorher.hoeheM / 2;
  const a = await punkt(page, x, y), b = await punkt(page, x + .6, y);
  await ziehen(a, b);
  await expect.poll(async () => (await stand(page)).flaechen[0]!.felder?.[feldIndex]?.xM ?? -Infinity).toBeGreaterThan(vorher.xM + .2);
  await page.screenshot({ path: resolve(shots, `${info.project.name}-${anlegen}-sofort-gezogen.png`) });
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  if (anlegen === 'zeichnen') await expect.poll(async () => (await stand(page)).flaechen[0]!.felder![feldIndex]!.xM).toBeCloseTo(vorher.xM, 1);
  else await expect.poll(async () => (await stand(page)).flaechen[0]!.felder).toEqual([vorher]);
});

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
  await oeffneStartprojekt(page);
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
