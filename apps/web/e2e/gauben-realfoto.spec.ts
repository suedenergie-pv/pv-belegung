import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { polygonUeberlapptHindernis } from '@pv-belegung/engine';
import { neuesProjekt, modulById, rasterFuer, vollFeldFuer, type Projekt } from '../lib/model';
import type { Ecken, Punkt } from '../lib/foto-geometrie';
import { oeffneStartprojekt } from './projekt-einstieg';

// Echte Aufnahme, nur lokale QA. Quelle und sichtbare Ecken: .release/gauben-real/QUELLEN.md.
// Primärquelle: https://ahmann-wirth.de/projekt/baugenossenschaft-ibbenbueren-dachdeckung-flachdachabdichtung-zinkarbeiten
// Bild: https://ahmann-wirth.de/files/aw/referenzen/gewerbe/baugenossenschaft-ibbenbueren-dacharbeiten/baugenossenschaft-ibbenbueren-flachdachgaube-abdichtung.jpg
// Alle Meter-/Winkelwerte sind Testannahmen, keine Vermessung oder Kapazitätsaussage.
const fotoPfad = resolve(process.env.PV_REALDORMER_PHOTO ?? '.release/gauben-real/baugenossenschaft-ibbenbueren-flachdachgaube-abdichtung.jpg');
// Die gleiche Prüfung kann gegen einen anderen lokalen, ungeschützten Build laufen.
const speicherKey = process.env.PV_PROJECT_STORAGE_KEY ?? 'pv-belegung-projekte-v2';
const out = resolve(process.env.PV_QA_SHOTS ?? '.release/gauben-real/screenshots');
const hauptdach: Ecken = [[519,396],[1017,845],[1109,716],[553,297]];
const gaube: Ecken = [[670,564],[753,632],[792,601],[715,534]];

async function stand(page: Page): Promise<Projekt> {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(key => {
    const db = JSON.parse(localStorage.getItem(key)!);
    return db.projekte.find((p: {id: string}) => p.id === db.aktivId).projekt;
  }, speicherKey);
}
async function tippe(page: Page, b: Locator) {
  await b.scrollIntoViewIfNeeded();
  const trifft = () => b.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
  // scrollIntoView berücksichtigt den festen Formulartitel nicht. Falls nötig wie
  // ein Nutzer im Formular nachscrollen; keine DOM-Events oder erzwungenen Klicks.
  for (let versuch = 0; versuch < 4 && !(await trifft()); versuch++) {
    const scroll = await b.evaluate(el => {
      const s = el.closest('[data-inspektor-inhalt]'); if (!s) return null;
      const r = s.getBoundingClientRect(), ziel = el.getBoundingClientRect();
      const kopf = el.closest('[aria-label="Editor-Einstellungen"]')?.firstElementChild;
      const oben = kopf && getComputedStyle(kopf).position === 'sticky' ? Math.max(r.top, kopf.getBoundingClientRect().bottom) : r.top;
      const delta = Math.min(50, (r.bottom - oben) / 2);
      return { x: r.x + r.width / 2, y: (oben + r.bottom) / 2, delta: ziel.y + ziel.height / 2 < oben ? delta : -delta };
    });
    if (!scroll) break;
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: scroll.x, y: scroll.y - scroll.delta / 2, id: 1 }] });
      for (let i = 1; i <= 5; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: scroll.x, y: scroll.y - scroll.delta / 2 + scroll.delta * i / 5, id: 1 }] });
        await page.waitForTimeout(30);
      }
      // Finger vor dem Loslassen anhalten, damit der nächste Tap kein Scrollfling stoppt.
      await page.waitForTimeout(80);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
      await page.waitForTimeout(150);
    } else { await page.mouse.move(scroll.x, scroll.y); await page.mouse.wheel(0, -scroll.delta); }
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  // Subpixel-Rundung an Scrollkanten zulassen, höchstens 1 %; reale Klickmitte unten prüfen.
  await expect(b).toBeInViewport({ ratio: .99 });
  const r = (await b.boundingBox())!;
  expect(r.height).toBeGreaterThanOrEqual(44);
  expect(await trifft()).toBe(true);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await b.click();
}
async function setzeFotoPunkt(page: Page, p: Punkt) {
  const svg = page.getByRole('img', { name: 'Gaube im Dachfoto markieren', exact: true });
  if (!(await page.evaluate(() => navigator.maxTouchPoints > 0))) {
    const q = await svg.evaluate((el, p) => { const q = new DOMPoint(p[0], p[1]).matrixTransform((el as SVGSVGElement).getScreenCTM()!); return { x: q.x, y: q.y }; }, p);
    await page.mouse.click(q.x, q.y); return;
  }
  const kreuz = page.getByTestId('foto-fadenkreuz');
  const aktuell = [Number(await kreuz.getAttribute('data-x')), Number(await kreuz.getAttribute('data-y'))];
  const d = await svg.evaluate((el, a) => { const m = (el as SVGSVGElement).getScreenCTM()!; return { x: m.a * (a.p[0] - a.aktuell[0]!) + m.c * (a.p[1] - a.aktuell[1]!), y: m.b * (a.p[0] - a.aktuell[0]!) + m.d * (a.p[1] - a.aktuell[1]!) }; }, { p, aktuell });
  const v = (await page.getByTestId('editor-viewport').boundingBox())!;
  const start = { x: v.x + v.width / 2 - d.x / 2, y: v.y + v.height / 2 - d.y / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + d.x * i / 5, y: start.y + d.y * i / 5, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect.poll(async () => Math.hypot(Number(await kreuz.getAttribute('data-x')) - p[0], Number(await kreuz.getAttribute('data-y')) - p[1])).toBeLessThan(2);
  await tippe(page, page.getByRole('button', { name: 'Punkt setzen', exact: true }));
}

test('Echtes Gaubendach: Anlegen, Maße, Umriss, Module und Reload', async ({ page }, info) => {
  test.skip(!existsSync(fotoPfad), 'PV_REALDORMER_PHOTO auf die lokale echte Aufnahme setzen.');
  page.setDefaultTimeout(12_000); mkdirSync(out, { recursive: true });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const b = (name: string) => page.getByRole('button', { name, exact: true });
  const shot = (name: string) => page.screenshot({ path: resolve(out, `${info.project.name}-${name}.png`) });
  const projekt = neuesProjekt();
  projekt.kunde = 'Echtes Gaubenfoto · Maße und Richtung sind Testannahmen';
  projekt.fotos = [{ id: 'foto', name: 'Ahmann-Wirth · echte Drohnenaufnahme', breitePx: 1600, hoehePx: 1200, dataUrl: 'data:image/jpeg;base64,' + readFileSync(fotoPfad).toString('base64') }];
  Object.assign(projekt.flaechen[0]!, { name: 'Hauptdach · Testannahme 32 × 8 m', breiteM: 32, hoeheM: 8, massStatus: 'bestaetigt', grunddatenFertig: true,
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: hauptdach, perspektiveBestaetigt: true, markierungFertig: true }] });
  projekt.flaechen[0]!.felder = [vollFeldFuer(projekt.flaechen[0]!, modulById(projekt.modulId))];
  await page.addInitScript(({ projekt, key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key.replace('-v2', '-v1'), JSON.stringify({ aktivId: 'gauben-qa', workflowVersion: 2, projekte: [{ id: 'gauben-qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, { projekt, key: speicherKey });
  await page.goto('./'); await oeffneStartprojekt(page);
  const vorher = await stand(page);
  await tippe(page, page.getByRole('group', { name: 'Dach bearbeiten', exact: true }).getByRole('button', { name: 'Gauben', exact: true }));
  await expect(page.getByRole('group', { name: 'Gaubentyp', exact: true }).getByRole('button')).toHaveCount(2);
  await tippe(page, b('Flach / leicht geneigt')); await tippe(page, b('Aufmaß vorhanden'));
  await page.getByLabel(/^Dachneigung der Gaube/).fill('5');
  await page.getByLabel(/^Breite der belegbaren Fläche/).fill('6');
  await page.getByLabel(/^Tiefe auf dem Gaubendach/).fill('3');
  await tippe(page, b('Im Foto markieren →'));
  const fokus = b('Bild vergrößern'); if (await fokus.isVisible()) await tippe(page, fokus);
  for (const p of gaube) await setzeFotoPunkt(page, p);
  await expect(page.getByRole('button', { name: /^Gaubenpunkt / })).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Maßentwurf noch offen', exact: true })).toHaveCount(0);
  if (info.project.name !== 'desktop') await expect(b('Eingaben anzeigen')).toBeVisible();
  if (info.project.name === 'mobil') {
    // Die Fotoarbeit nutzt den freien Raum; kein leerer Formularblock im Bildfokus.
    expect((await page.getByTestId('editor-viewport').boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height * .7);
  }
  await shot('01-gaube-markiert');
  if (await b('Eingaben anzeigen').isVisible()) await tippe(page, b('Eingaben anzeigen'));
  await tippe(page, b('Gaube anlegen & fertig'));
  const angelegt = await stand(page), kind = angelegt.flaechen.find(f => f.gaubenTyp)!;
  expect(kind.gaubenTyp).toBe('flachdach'); expect(kind.art).toBe('dach'); expect(kind.flachdach).toBeUndefined();
  expect([kind.breiteM, kind.hoeheM, kind.neigungDeg]).toEqual([6, 3, 5]);
  const h = angelegt.flaechen[0]!.gaubenAussparungen![0]!.rechteck;
  expect(h.umrissM).toHaveLength(4);
  const modul = modulById(angelegt.modulId), key = (p: { xM: number; yM: number }) => `${p.xM},${p.yM}`;
  const altModule = rasterFuer(vorher.flaechen[0]!, modul).positionen;
  const neuModule = new Set(rasterFuer(angelegt.flaechen[0]!, modul).positionen.map(key));
  for (const p of altModule) {
    const poly: Punkt[] = [[p.xM,p.yM],[p.xM+p.wM,p.yM],[p.xM+p.wM,p.yM+p.hM],[p.xM,p.yM+p.hM]];
    expect(neuModule.has(key(p))).toBe(!polygonUeberlapptHindernis(poly, h));
  }
  const card = page.locator(`[data-gaubengruppe="${kind.gaubenGruppeId}"]`);
  await tippe(page, card.getByRole('button', { name: 'Dachmaße ändern', exact: true }));
  await page.getByLabel(/^Neigung der Gaubenseite/).fill('7,5');
  await tippe(page, b('Maße übernehmen'));
  const aufgaben = page.getByRole('group', { name: 'Gaube bearbeiten', exact: true });
  await expect(aufgaben.getByRole('button', { name: 'Maße & Neigung', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel(/^Neigung der Gaubenseite/)).toHaveValue('7.5');
  await shot('02-masse-gespeichert');
  await tippe(page, aufgaben.getByRole('button', { name: 'Umriss', exact: true }));
  await page.getByRole('combobox', { name: 'Gaubenelement', exact: true }).selectOption('punkt:0');
  await tippe(page, b('Ecke nach links')); await tippe(page, b('Änderungen übernehmen'));
  await expect(aufgaben.getByRole('button', { name: 'Umriss', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await shot('03-umriss-gespeichert');
  await tippe(page, aufgaben.getByRole('button', { name: 'Module', exact: true }));
  const fertig = await stand(page);
  expect(fertig.flaechen.find(f => f.id === kind.id)!.neigungDeg).toBe(7.5);
  expect(fertig.flaechen[0]!.felder).toEqual(vorher.flaechen[0]!.felder);
  expect(rasterFuer(fertig.flaechen.find(f => f.id === kind.id)!, modul).positionen.length).toBeGreaterThan(0);
  await shot('04-module'); await page.reload();
  expect((await stand(page)).flaechen).toEqual(fertig.flaechen);
  expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});
