import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { neuesProjekt, neueFlaeche, neueGaubenFlaeche, type Projekt } from '../lib/model';

const shots = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/dach-pdf');
async function fixture(anzahl = 1): Promise<Projekt> {
  const projekt = neuesProjekt();
  const input = process.env.PV_QA_PHOTO ? readFileSync(process.env.PV_QA_PHOTO)
    : Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>');
  const dataUrl = `data:image/jpeg;base64,${(await sharp(input).resize(1600, 900).jpeg().toBuffer()).toString('base64')}`;
  projekt.fotos = Array.from({ length: anzahl }, (_, i) => ({ id: `foto-${i}`, name: `Drohnenfoto ${i + 1}`, dataUrl, breitePx: 1600, hoehePx: 900 }));
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt',
    felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 6, quer: false }],
    fotoZuordnungen: projekt.fotos.map((foto) => ({ fotoId: foto.id, traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true })),
  });
  return projekt;
}
async function lade(page: Page, projekt: Projekt, schritt: number) {
  await page.addInitScript(({ projekt, schritt }) => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, { projekt, schritt });
  await page.goto('./');
}
async function stand(page: Page): Promise<Projekt> {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt;
  });
}
async function oeffneListe(page: Page) {
  const liste = page.locator('details').filter({ has: page.getByLabel('Dachflächen im Projekt') });
  if (await liste.getAttribute('open') === null) await liste.locator('summary').click();
}

test('Dach direkt entfernen: Abbruch, Gauben, Fotos, Strings und Rückgängig', async ({ page }, info) => {
  mkdirSync(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const projekt = await fixture();
  const dach = projekt.flaechen[0]!;
  projekt.flaechen.push(neueFlaeche(2, 'B'));
  for (const [i, seite] of (['links', 'rechts'] as const).entries()) {
    const gaube = neueGaubenFlaeche(i + 3, 'A', 'satteldach', dach.id, seite, 'g1');
    Object.assign(gaube, { massStatus: 'bestaetigt', fotoZuordnungen: structuredClone(dach.fotoZuordnungen), felder: [{ xM: 0, yM: 0, breiteM: 3, hoeheM: 2.5, quer: false }] });
    projekt.flaechen.push(gaube);
  }
  dach.gaubenAussparungen = [{ gaubenGruppeId: 'g1', rechteck: { xM: 7, yM: 2, breiteM: 3, hoeheM: 2, umrissM: [[7, 2], [10, 2], [10, 4], [7, 4]] } }];
  projekt.mppts = [[{ id: 's1', flaecheId: dach.id, anzahl: 4 }, { id: 's2', flaecheId: projekt.flaechen[2]!.id, anzahl: 2 }, { id: 's3', flaecheId: 'p2', anzahl: 3 }]];
  await lade(page, projekt, 1);
  await expect(page.getByTestId('flaechen-status')).toBeVisible();
  await expect.poll(async () => (await stand(page)).flaechen.length).toBe(4);
  const vorher = await stand(page);
  await oeffneListe(page);
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Gaube „Satteldachgaube links“ entfernen', exact: true }).click();
  await expect.poll(async () => (await stand(page)).flaechen.length).toBe(2);
  expect((await stand(page)).flaechen[0]!.gaubenAussparungen).toEqual([]);
  expect((await stand(page)).fotos).toEqual(vorher.fotos);
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect.poll(async () => (await stand(page)).flaechen).toEqual(vorher.flaechen);
  await oeffneListe(page);
  const entfernen = page.getByRole('button', { name: 'Dachfläche „Dachfläche 1“ entfernen', exact: true });
  await entfernen.scrollIntoViewIfNeeded();
  const b = (await entfernen.boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: resolve(shots, `${info.project.name}-entfernen.png`) });
  await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
  await page.getByLabel('Traufe', { exact: false }).fill('19');
  await oeffneListe(page);
  await entfernen.click();
  const entwurf = page.getByRole('dialog', { name: 'Maßentwurf noch offen' });
  await expect(entwurf).toBeVisible();
  await entwurf.getByRole('button', { name: 'Bleiben', exact: true }).click();
  await expect(page.getByLabel('Traufe', { exact: false })).toHaveValue('19');
  expect((await stand(page)).flaechen).toEqual(vorher.flaechen);
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await oeffneListe(page);
  page.once('dialog', async d => { expect(d.message()).toContain('2 zugehörigen Gaubenflächen'); await d.dismiss(); });
  await entfernen.click();
  expect((await stand(page)).flaechen).toEqual(vorher.flaechen);
  page.once('dialog', d => d.accept());
  await entfernen.click();
  await expect.poll(async () => (await stand(page)).flaechen.map(f => f.id)).toEqual(['p2']);
  expect((await stand(page)).fotos).toEqual(vorher.fotos);
  expect((await stand(page)).mppts).toEqual([[{ id: 's3', flaecheId: 'p2', anzahl: 3 }]]);
  await expect(page.getByLabel('Aktive Dachfläche')).toHaveValue('p2');
  await oeffneListe(page);
  await expect(page.getByRole('button', { name: 'Dachfläche „Dachfläche 2“ entfernen' })).toBeDisabled();
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect.poll(async () => (await stand(page)).flaechen).toEqual(vorher.flaechen);
  expect((await stand(page)).mppts).toEqual(vorher.mppts);
  expect((await stand(page)).fotos).toEqual(vorher.fotos);
  await page.getByRole('button', { name: /Wiederherstellen/ }).click();
  await expect.poll(async () => (await stand(page)).flaechen.length).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

for (const anzahl of [1, 2, 3, 4, 6]) test(`Echter PDF-Download mit ${anzahl} Bildern`, async ({ page }, info) => {
  test.skip(!['desktop', 'mobil-hoch'].includes(info.project.name), 'PDF-Matrix auf Desktop und Smartphone');
  mkdirSync(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const projekt = await fixture(anzahl);
  await lade(page, projekt, 2);
  const link = page.locator('a[download]').filter({ hasText: 'PDF herunterladen' });
  await expect(link).toBeVisible({ timeout: 30000 });
  const download = page.waitForEvent('download');
  await link.click();
  const datei = await download;
  await datei.saveAs(resolve(shots, `${info.project.name}-${anzahl}.pdf`));
  expect(await datei.failure()).toBeNull();
  const pdf = readFileSync(resolve(shots, `${info.project.name}-${anzahl}.pdf`)), text = pdf.toString('latin1');
  expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(Math.ceil(anzahl / 2));
  expect(errors).toEqual([]);
});
