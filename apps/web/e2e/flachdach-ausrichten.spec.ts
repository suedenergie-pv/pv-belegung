import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neuesProjekt, type Projekt } from '../lib/model';
import { oeffneStartprojekt } from './projekt-einstieg';

async function stand(page: Page): Promise<Projekt> {
  await page.waitForTimeout(650);
  return page.evaluate(() => { const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!); return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt; });
}
test('Flachdach: freie unabhängige Ausrichtung, Korrekturen, Drehgriff und Dachrichtung', async ({ page }, info) => {
  test.setTimeout(100_000); page.setDefaultTimeout(12_000);
  const out = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/flachdach-ausrichtung-2026-10-20'); mkdirSync(out, { recursive: true });
  const errors: string[] = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
  const b = (name: string) => page.getByRole('button', { name, exact: true });
  const shot = (name: string) => page.screenshot({ path: resolve(out, `${info.project.name}-${name}.png`) });
  const p = neuesProjekt();
  p.fotos = [{ id: 'foto', name: 'Dachplan', breitePx: 1600, hoehePx: 900,
    dataUrl: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#696d70" d="M0 0h1600v900H0z"/><path d="M96 783H1504V153H96Z" fill="#949a9d" stroke="#ddd" stroke-width="9"/><path d="M96 310H1504M96 470H1504M96 630H1504" stroke="#81888b" stroke-width="4"/></svg>').toString('base64') }];
  Object.assign(p.flaechen[0]!, { art: 'flachdach', breiteM: 18, hoeheM: 10, neigungDeg: 0, randM: 0,
    massStatus: 'bestaetigt', grunddatenFertig: true,
    flachdach: { aufstaenderung: 'ostwest', winkelDeg: 10, richtungSued: 'unten' },
    felder: [{ xM: 1.2, yM: 2, breiteM: 5.8, hoeheM: 5.5, quer: true, leer: ['1-0'] }, { xM: 10, yM: 2, breiteM: 5.8, hoeheM: 5.5, quer: true }],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript(p => { if (!localStorage.getItem('pv-belegung-projekte-v2')) localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt: p, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] })); }, p);
  await page.goto('./'); await oeffneStartprojekt(page);
  await expect(page.getByTestId('flachdach-kompass')).toBeVisible();
  await page.locator('[data-feld-ebene=flaeche][data-feld-index="0"]').click();
  const winkel = page.getByLabel('Felddrehung in Grad');
  await expect(winkel).toHaveValue('0');
  const setze = async (wert: string) => { await winkel.fill(wert); await b('Winkel setzen').click(); };
  await setze('15');
  let neu = await stand(page);
  expect(neu.flaechen[0]!.felder![0]!.drehungDeg).toBe(15); expect(neu.flaechen[0]!.felder![1]!.drehungDeg).toBeUndefined();
  expect(neu.flaechen[0]!.felder![0]!.leer).toEqual(['1-0']);
  await shot('01-feld-15-grad');
  for (const name of ['Feld 5 Grad nach links drehen', 'Feld 5 Grad nach rechts drehen', 'Auf 0° stellen']) {
    const aktion = b(name); await aktion.scrollIntoViewIfNeeded();
    const box = (await aktion.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await aktion.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  }
  await shot('01b-drehaktionen');
  await setze(''); await expect(page.getByRole('alert').filter({ hasText: 'Winkel' })).toBeVisible();
  expect((await stand(page)).flaechen[0]!.felder![0]!.drehungDeg).toBe(15);
  await setze('180'); expect((await stand(page)).flaechen[0]!.felder![0]!.leer).toEqual(['1-0']);
  await b('Auf 0° stellen').click(); await setze('15');
  const zweites = (await stand(page)).flaechen[0]!.felder![1];
  // Reale Maus bzw. Touch-Pointer am runden Griff; keine Zustandsmutation.
  const griff = page.locator('[data-feld-drehen="0"] circle').last();
  await griff.scrollIntoViewIfNeeded();
  const g = (await griff.boundingBox())!, feld = (await page.locator('[data-feld-ebene=flaeche][data-feld-index="0"]').boundingBox())!;
  const cx = feld.x + feld.width / 2, cy = feld.y + feld.height / 2, x = g.x + g.width / 2, y = g.y + g.height / 2;
  const a = Math.PI / 9, nx = cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), ny = cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
  if (info.project.name === 'desktop') {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(nx, ny, { steps: 8 }); await page.mouse.up();
  } else {
    await griff.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 27, pointerType: 'touch', button: 0, clientX: x, clientY: y });
    await griff.evaluate(async (el, { x, y, nx, ny }) => {
      const send = (type: string, x: number, y: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 27, pointerType: 'touch', button: 0, clientX: x, clientY: y }));
      for (let i = 1; i <= 8; i++) { send('pointermove', x + (nx - x) * i / 8, y + (ny - y) * i / 8); await new Promise(requestAnimationFrame); }
    }, { x, y, nx, ny });
    await griff.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 27, pointerType: 'touch', button: 0, clientX: nx, clientY: ny });
  }
  neu = await stand(page); expect(neu.flaechen[0]!.felder![0]!.drehungDeg).not.toBe(15);
  expect(neu.flaechen[0]!.felder![1]).toEqual(zweites); expect(neu.flaechen[0]!.felder![0]!.leer).toEqual(['1-0']);
  await shot('02-drehgriff');
  await b('Auf 0° stellen').click(); await setze('15');
  const vorGroesse = (await stand(page)).flaechen[0]!.felder![0]!;
  const groe = page.locator('[data-feld-griff="e"][data-feld-index="0"]');
  const groeBox = (await groe.boundingBox())!;
  const gx = groeBox.x + groeBox.width / 2, gy = groeBox.y + groeBox.height / 2;
  await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move(gx + 12, gy + 5, { steps: 5 }); await page.mouse.up();
  const nachGroesse = (await stand(page)).flaechen[0]!.felder![0]!;
  expect(nachGroesse.breiteM).not.toBe(vorGroesse.breiteM); expect(nachGroesse.hoeheM).toBe(vorGroesse.hoeheM);
  expect([nachGroesse.xM, nachGroesse.yM]).toEqual([vorGroesse.xM, vorGroesse.yM]);
  expect(nachGroesse.leer).toEqual(vorGroesse.leer); expect(nachGroesse.drehungDeg).toBe(15);
  await b('nach rechts').click();
  expect((await stand(page)).flaechen[0]!.felder![0]!.xM).toBeCloseTo(Math.round((nachGroesse.xM + .1) * 100) / 100, 8);
  await b('3. Kunden-PDF').click();
  const pdfLink = page.locator('a[download]').filter({ hasText: 'PDF herunterladen' });
  await expect(pdfLink).toBeVisible({ timeout: 30000 });
  const event = page.waitForEvent('download'); await pdfLink.click(); const pdf = await event;
  const pdfPfad = resolve(out, `${info.project.name}-gedreht.pdf`); await pdf.saveAs(pdfPfad);
  expect(await pdf.failure()).toBeNull(); expect(readFileSync(pdfPfad).subarray(0, 4).toString()).toBe('%PDF');
  await shot('02b-export'); await b('2. Dach & Belegung').click();
  await b('Module entfernen').click();
  await page.locator('[data-modul-key^="f0:"]:not([data-modul-leer])').first().click();
  expect((await stand(page)).flaechen[0]!.felder![0]!.leer).toHaveLength(2);
  await page.locator('[data-modul-leer=true]').first().click();
  expect((await stand(page)).flaechen[0]!.felder![0]!.leer).toHaveLength(1);
  const vorKompass = (await stand(page)).flaechen[0]!.felder;
  await b('Dachmaße').click();
  await page.getByRole('combobox', { name: 'Südrichtung im Dachplan', exact: true }).selectOption('oben');
  await page.getByLabel(/^Abstand der Modulpaare/).fill('1');
  await b('Maße übernehmen').click(); await expect(page.getByLabel(/^Abstand der Modulpaare/)).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel(/^Abstand der Modulpaare/).fill('2.48');
  await page.getByRole('combobox', { name: 'Aufständerung', exact: true }).scrollIntoViewIfNeeded();
  await shot('03-aufstaenderung'); await b('Maße übernehmen').click();
  expect((await stand(page)).flaechen[0]!.felder).toEqual(vorKompass);
  await b('Alle auswählen').click(); await expect(page.getByPlaceholder('Verschiedene')).toBeVisible();
  await setze('0');
  expect((await stand(page)).flaechen[0]!.felder!.map(f => f.drehungDeg)).toEqual([0, 0]);
  await shot('04-mehrfachauswahl');
  await b('Dachmaße').click(); await page.getByRole('combobox', { name: 'Aufständerung', exact: true }).selectOption('sued-15');
  await expect(page.getByLabel(/^Abstand der Reihen/)).toHaveValue('1.9'); await b('Maße übernehmen').click();
  expect((await stand(page)).flaechen[0]!.flachdach!.winkelDeg).toBe(15);
  await page.reload();
  expect((await stand(page)).flaechen[0]!.felder!.map(f => f.drehungDeg)).toEqual([0, 0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false); expect(errors).toEqual([]);
});
