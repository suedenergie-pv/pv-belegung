import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { aktiveModule, modulById, rasterFuer, type Projekt } from '../lib/model';
import { oeffneStartprojekt } from './projekt-einstieg';

// Jeder Dachdatensatz entsteht durch Formulare. Keine vorgebauten Projektstände.
// Alle Maße sind QA-Annahmen; die Fotos sind keine vermessenen Aufmaße.
const storageKey = process.env.PV_PROJECT_STORAGE_KEY ?? 'pv-belegung-projekte-v2';
const out = resolve(process.env.PV_QA_SHOTS ?? '.release/fuenf-dachflaechen/screenshots');
const foto = process.env.PV_REALROOF_DIR ? resolve(process.env.PV_REALROOF_DIR, 'erlus-monaco.jpg') : '';

async function stand(page: Page): Promise<Projekt> {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(key => {
    const db = JSON.parse(localStorage.getItem(key)!);
    return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt;
  }, storageKey);
}

async function tippe(page: Page, ziel: Locator) {
  await ziel.scrollIntoViewIfNeeded();
  await expect(ziel).toBeInViewport({ ratio: .99 });
  const r = (await ziel.boundingBox())!;
  expect(r.height).toBeGreaterThanOrEqual(44);
  // Sichtbarkeit allein reicht nicht: ein Titel oder Fußbereich darf nicht darüberliegen.
  expect(await ziel.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await ziel.click();
}

async function masseOeffnen(page: Page) {
  const name = page.getByLabel(/^Name der Fläche/);
  if (await name.count()) return;
  const direkt = page.getByRole('button', { name: 'Maße sind bereits bekannt', exact: true });
  await tippe(page, await direkt.count() ? direkt : page.getByRole('button', { name: 'Dachmaße', exact: true }));
  await expect(name).toBeVisible();
}

async function neuesProjekt(page: Page) {
  await page.goto('./');
  await oeffneStartprojekt(page);
  await page.getByLabel(/^Kunde/).fill('Fünf Dachseiten · Bedienprüfung');
  await tippe(page, page.getByRole('button', { name: '2. Dach & Belegung', exact: true }));
}

const seiten = [
  { name: 'Hauptdach Süd', art: 'dach', breite: 20, oben: 20, tiefe: 8, richtung: '180' },
  { name: 'Anbau West · eine schräge Seite', art: 'dach', breite: 20, oben: 15.51, tiefe: 7, richtung: '270', links: true },
  { name: 'Walm Ost · Dachspitze', art: 'dach', breite: 12, oben: 0, tiefe: 8, richtung: '90' },
  { name: 'Halle · Ost-West', art: 'halle-flachdach', breite: 30, tiefe: 20 },
  { name: 'Freifläche · Süd', art: 'freiflaeche', breite: 40, tiefe: 25 },
];

test('Fünf Dachseiten von Hand: bekannte Maße, Formen, Belegung, Wechsel, Entwürfe und Wiederöffnen', async ({ page }, info) => {
  mkdirSync(out, { recursive: true }); page.setDefaultTimeout(12_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const shot = (name: string) => page.screenshot({ path: resolve(out, `${info.project.name}-${name}.png`) });
  await neuesProjekt(page);
  for (const [i, dach] of seiten.entries()) {
    const vorher = (await stand(page)).flaechen;
    if (i) {
      // Beide öffentlichen Zugänge benutzen, nicht eine interne Hinzufügen-Funktion.
      if (i % 2) await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption('');
      else {
        const liste = page.getByRole('button', { name: /^Dachflächen/ });
        if (!(await button('+ Dachfläche hinzufügen').isVisible())) await tippe(page, liste);
        await tippe(page, button('+ Dachfläche hinzufügen'));
      }
      await masseOeffnen(page);
      // Keine automatisch übernommenen Maße und kein fremdes Foto.
      await expect(page.getByLabel(/^Breite unten/)).toHaveValue('');
      expect((await stand(page)).flaechen[i]!.fotoZuordnungen ?? []).toHaveLength(0);
      if (i === 1) await shot('01-zweite-dachseite-direkt-masse');
    } else await masseOeffnen(page);
    await page.getByLabel(/^Name der Fläche/).fill(dach.name);
    await page.getByLabel('Art der Fläche', { exact: true }).selectOption(dach.art);
    if (dach.art === 'dach') {
      await page.getByLabel(/^Breite unten/).fill(String(dach.breite));
      await page.getByLabel(/^Breite oben/).fill(String(dach.oben));
      await page.getByLabel(/^Länge auf dem Dach/).fill(String(dach.tiefe));
      if (dach.links) await tippe(page, button('Links gerade'));
      await page.getByLabel('Ausrichtung', { exact: true }).selectOption(dach.richtung!);
    } else {
      await page.getByLabel(/^Breite/).fill(String(dach.breite));
      await page.getByLabel(/^Tiefe/).fill(String(dach.tiefe));
    }
    await tippe(page, button('Maße übernehmen'));
    await tippe(page, button('Belegung vorschlagen'));
    if (dach.art !== 'dach') {
      await page.getByText('Ohne Klicken einstellen', { exact: true }).click();
      await tippe(page, button(i === 3 ? 'Süden Links' : 'Süden Unten'));
      await tippe(page, button('Südrichtung übernehmen'));
      await tippe(page, button('Belegung vorschlagen'));
    }
    const p = await stand(page); const fl = p.flaechen[i]!;
    expect(fl.name).toBe(dach.name); expect(fl.breiteM).toBe(dach.breite); expect(fl.hoeheM).toBe(dach.tiefe);
    expect(fl.massEingabeOffen).toBe(false); expect(fl.massStatus).toBe('bestaetigt');
    if (dach.oben !== undefined && dach.oben !== dach.breite) expect(fl.firstBreiteM).toBe(dach.oben);
    expect(aktiveModule(fl, rasterFuer(fl, modulById(p.modulId)))).toBeGreaterThan(0);
    expect(p.flaechen.slice(0, i)).toEqual(vorher.slice(0, i));
    await tippe(page, button('Auswahl aufheben'));
    await shot(`02-${i + 1}-dachseite-belegt`);
  }
  const fertig = await stand(page);
  expect(fertig.flaechen).toHaveLength(5);
  for (const [i, dach] of seiten.entries()) {
    await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption(fertig.flaechen[i]!.id);
    await tippe(page, button(dach.art === 'freiflaeche' ? 'Flächenmaße' : 'Dachmaße'));
    await expect(page.getByLabel(/^Name der Fläche/)).toHaveValue(dach.name);
    await expect(page.getByLabel(dach.art === 'dach' ? /^Breite unten/ : /^Breite/)).toHaveValue(String(dach.breite));
    await tippe(page, button('Abbrechen'));
  }
  // Ein offener Entwurf bleibt bei Bleiben erhalten, Verwerfen ändert keine andere Seite.
  await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption(fertig.flaechen[1]!.id);
  await tippe(page, button('Dachmaße'));
  await page.getByLabel(/^Breite unten/).fill('22');
  await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption(fertig.flaechen[2]!.id);
  await expect(page.getByRole('dialog')).toBeVisible();
  await tippe(page, page.getByRole('dialog').getByRole('button', { name: 'Bleiben', exact: true }));
  await expect(page.getByLabel(/^Breite unten/)).toHaveValue('22');
  await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption(fertig.flaechen[2]!.id);
  await tippe(page, page.getByRole('dialog').getByRole('button', { name: 'Verwerfen', exact: true }));
  expect((await stand(page)).flaechen).toEqual(fertig.flaechen);
  await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption(fertig.flaechen[1]!.id);
  await tippe(page, button('Dachmaße')); await page.getByLabel(/^Breite unten/).fill('22');
  await tippe(page, button('Maße übernehmen'));
  const geändert = await stand(page);
  expect(geändert.flaechen[1]!.breiteM).toBe(22);
  for (const i of [0, 2, 3, 4]) expect(geändert.flaechen[i]).toEqual(fertig.flaechen[i]);
  await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption(fertig.flaechen[4]!.id);
  // Auch mit Südrichtung und Fotoaktionen muss der aktive Flächenname lesbar bleiben.
  expect((await page.getByLabel('Aktive Dachfläche', { exact: true }).boundingBox())!.width).toBeGreaterThanOrEqual(120);
  await shot('03-fuenf-dachseiten');
  await page.reload();
  expect((await stand(page)).flaechen).toEqual(geändert.flaechen);
  await expect(page.getByLabel('Aktive Dachfläche', { exact: true })).toHaveValue(fertig.flaechen[4]!.id);
  await shot('04-wieder-geoeffnet');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test('Fünf Dachseiten mit Foto zuerst: sofort erkennbare Maße, getrennte Seiten und Wiederöffnen', async ({ page }, info) => {
  test.skip(!foto || !existsSync(foto), 'PV_REALROOF_DIR mit echtem Dachfoto angeben.');
  mkdirSync(out, { recursive: true });
  await neuesProjekt(page);
  const chooser = page.waitForEvent('filechooser');
  await tippe(page, page.getByRole('button', { name: 'Foto hochladen', exact: true }));
  await (await chooser).setFiles(foto);
  const namen = ['Südseite am Hof', 'Westseite mit Kamin', 'Ostseite zum Garten', 'Nordseite', 'Anbau'];
  for (const [i, name] of namen.entries()) {
    const vorher = await stand(page);
    if (i) {
      if (i % 2) await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption('auf-foto');
      else {
        await page.getByLabel('Aktive Dachfläche', { exact: true }).selectOption('');
        expect((await stand(page)).flaechen[i]!.fotoZuordnungen ?? []).toHaveLength(0);
        await page.getByLabel(/^Vorhandenes Foto für/).selectOption(vorher.fotos[0]!.id);
      }
    }
    await expect(page.getByLabel(/^Name der Fläche/)).toBeVisible();
    await page.screenshot({ path: resolve(out, `${info.project.name}-foto-${i + 1}-unmittelbar-nach-foto.png`) });
    // Nach Fotoauswahl ohne weiteren Modus und ohne verstecktes Scrollen anfangen.
    await expect(page.getByLabel(/^Breite unten/)).toBeInViewport({ ratio: .99 });
    await expect(page.getByLabel(/^Länge auf dem Dach/)).toBeInViewport({ ratio: .99 });
    await expect(page.getByLabel(/^Breite unten/)).toHaveValue('');
    await expect(page.getByLabel(/^Länge auf dem Dach/)).toHaveValue('');
    await page.getByLabel(/^Breite unten/).fill(String(20 + i));
    await page.getByLabel(/^Breite oben/).fill(String(i === 2 ? 0 : i === 1 ? 15.51 : 20 + i));
    await page.getByLabel(/^Länge auf dem Dach/).fill(String(8 + i));
    await page.getByLabel(/^Name der Fläche/).fill(name);
    await tippe(page, page.getByRole('button', { name: 'Maße übernehmen', exact: true }));
    const p = await stand(page);
    expect(p.fotos).toHaveLength(1);
    expect(p.flaechen[i]!.fotoZuordnungen?.[0]?.fotoId).toBe(p.fotos[0]!.id);
    expect(p.flaechen[i]!.name).toBe(name);
    expect(p.flaechen[i]!.breiteM).toBe(20 + i); expect(p.flaechen[i]!.hoeheM).toBe(8 + i);
    expect(p.flaechen.slice(0, i)).toEqual(vorher.flaechen.slice(0, i));
  }
  const fertig = await stand(page);
  expect(fertig.flaechen).toHaveLength(5);
  await page.reload();
  expect((await stand(page)).flaechen).toEqual(fertig.flaechen);
  await expect(page.getByLabel('Aktive Dachfläche', { exact: true })).toHaveValue(fertig.flaechen[4]!.id);
  await page.screenshot({ path: resolve(out, `${info.project.name}-foto-fuenf-seiten-wieder-geoeffnet.png`) });
});
