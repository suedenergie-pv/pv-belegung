import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ordner = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/editor-integration-2026-09-30', process.env.PV_QA_PHOTO ? '.' : 'portable');
async function bildBeleg(page: Page, name: string, vonOben = true) {
  if (vonOben) await page.evaluate(() => scrollTo(0, 0));
  if (!name.endsWith('-export')) {
    // Foto und Bedienleiste bleiben vollständig im Fenster, auch bei langem Inspektor.
    await expect(page.getByTestId('editor-viewport')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Alles anzeigen', exact: true })).toBeInViewport({ ratio: 1 });
    const grenzen = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth + 1, vertikal: document.documentElement.scrollHeight > innerHeight + 1 }));
    expect(grenzen).toEqual({ horizontal: false, vertikal: false });
  }
  await page.screenshot({ path: resolve(ordner, `${name}.png`), fullPage: true });
  await page.screenshot({ path: resolve(ordner, `${name}-viewport.png`) });
}
async function stand(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((e: { id: string }) => e.id === db.aktivId).projekt;
  });
}

// Dasselbe funktionale Szenario läuft mit einem portablen Mini-Foto in CI und
// lokal mit dem privaten Referenzfoto. Keine Kundendatei wird versioniert.
test('Fotoeditor: reale Einrichtung, Zoom, Zwei-Punkt-Feld, Pinch, Korrektur, Export und Reload', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  mkdirSync(ordner, { recursive: true });
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
  await page.getByLabel(/^Traufe/).fill('18');
  await page.getByLabel(/^Sparrenlänge/).fill('8');
  await page.getByRole('button', { name: 'Maße übernehmen', exact: true }).click();
  const fotoPath = process.env.PV_QA_PHOTO;
  const dateiWahl = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto hinzufügen', exact: true }).click();
  await (await dateiWahl).setFiles(fotoPath ? fotoPath : {
    name: 'portables-testfoto.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBbkAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByRole('button', { name: /Überspringen \(/ })).toBeVisible();
  await page.getByRole('button', { name: /Überspringen \(/ }).click();
  const foto = page.getByRole('img', { name: /im Foto markieren/ });
  await foto.scrollIntoViewIfNeeded();
  const box = await foto.boundingBox();
  if (!box) throw new Error('Fotofläche fehlt');
  for (const [x, y] of [[.04, .9], [.945, .9], [.945, .17], [.04, .15]]) {
    await foto.click({ position: { x: box.width * x!, y: box.height * y! } });
  }
  await page.getByRole('button', { name: '4 Ecken übernehmen', exact: true }).click();
  await bildBeleg(page, `${testInfo.project.name}-einrichtung`);
  // Eine reale Aussparung für die Terrasse: zwei Punkte in Fotokoordinaten.
  const aussparung = await foto.boundingBox();
  if (!aussparung) throw new Error('Aussparungsfoto fehlt');
  for (const [x, y] of [[.35, .52], [.72, .81]]) {
    await foto.click({ position: { x: aussparung.width * x!, y: aussparung.height * y! } });
  }
  await page.getByRole('button', { name: 'Aussparungen fertig · Belegen', exact: true }).click();
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await page.getByRole('button', { name: '+ Feld zeichnen', exact: true }).click();
  await page.getByRole('button', { name: 'Mit zwei Punkten zeichnen', exact: true }).click();
  const dach = page.getByRole('img', { name: /Belegungsfläche Dachfläche 1/ });
  await page.getByTestId('editor-viewport').scrollIntoViewIfNeeded();
  // Ein Bereich oben links bleibt auch bei 125% im sichtbaren Bild.
  await dach.click({ position: { x: (await dach.boundingBox())!.width * .15, y: (await dach.boundingBox())!.height * .3 } });
  await dach.click({ position: { x: (await dach.boundingBox())!.width * .45, y: (await dach.boundingBox())!.height * .48 } });
  const erzeugt = await stand(page);
  expect(erzeugt.flaechen[0].felder).toHaveLength(1);
  expect(erzeugt.flaechen[0].hindernisse).toHaveLength(1);
  const originalFeld = erzeugt.flaechen[0].felder[0];
  const zoomVorher = await page.getByTestId('editor-bild-transform').getAttribute('style');
  // Browser Pointer Events samt echtem SVG: die zweite Berührung muss eine
  // begonnenen Feldgeste verwerfen. Keine Modellmutation durch Pinch.
  await dach.evaluate((svg) => {
    const b = svg.getBoundingClientRect();
    const send = (type: string, id: number, x: number, y: number) => svg.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: b.x + b.width * x, clientY: b.y + b.height * y,
    }));
    send('pointerdown', 1, .25, .37); send('pointermove', 1, .27, .37);
    send('pointerdown', 2, .5, .37); send('pointermove', 2, .65, .37);
    send('pointerup', 2, .65, .37); send('pointerup', 1, .27, .37);
  });
  await expect(page.getByTestId('editor-bild-transform')).not.toHaveAttribute('style', zoomVorher!);
  expect((await stand(page)).flaechen[0].felder).toEqual([originalFeld]);
  await page.getByRole('button', { name: 'Alles anzeigen', exact: true }).click();
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await page.getByRole('button', { name: 'Alle auswählen', exact: true }).click();
  await bildBeleg(page, `${testInfo.project.name}-korrektur`);
  const rechts = page.getByRole('button', { name: 'nach rechts', exact: true });
  // Eine normale Locator-Aktion prüft auch die feste untere Werkzeugleiste.
  // scrollIntoViewIfNeeded allein kann den Knopf dahinter stehen lassen.
  await rechts.hover();
  const r = (await rechts.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
  await page.waitForTimeout(560); await page.mouse.up();
  const verschoben = await stand(page);
  expect(verschoben.flaechen[0].felder[0].xM).toBeGreaterThan(originalFeld.xM);
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  expect((await stand(page)).flaechen[0].felder).toEqual([originalFeld]);
  await page.getByRole('button', { name: /Wiederherstellen/ }).click();
  expect((await stand(page)).flaechen[0].felder).toEqual(verschoben.flaechen[0].felder);
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await page.getByRole('button', { name: '3. Export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'PDF herunterladen', exact: true })).toBeEnabled();
  await bildBeleg(page, `${testInfo.project.name}-export`);
  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  await expect(page.getByTestId('editor-bild-transform')).toHaveAttribute('style', /scale\(1.25\)/);
  await stand(page);
  await page.reload();
  await expect(page.getByTestId('editor-bild-transform')).toHaveAttribute('style', /scale\(1\)/);
  expect((await stand(page)).flaechen[0].felder).toEqual(verschoben.flaechen[0].felder);

  // Dachwerkzeuge sind ohne Menü erreichbar; ein Wechsel schützt offene Punkte.
  const dachWerkzeuge = page.getByRole('group', { name: 'Dach bearbeiten' });
  await page.evaluate(() => scrollTo(0, 0));
  for (const name of ['Gauben', 'Umriss', 'Aussparungen']) {
    const knopf = dachWerkzeuge.getByRole('button', { name, exact: true });
    await expect(knopf).toBeInViewport();
    const ziel = (await knopf.boundingBox())!;
    expect(ziel.height).toBeGreaterThanOrEqual(44);
    expect(ziel.width).toBeGreaterThanOrEqual(44);
  }
  await bildBeleg(page, `${testInfo.project.name}-dachwerkzeuge`);
  await dachWerkzeuge.getByRole('button', { name: 'Gauben', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Satteldachgaube', exact: true })).toBeVisible();
  const fotoPosition = await page.getByTestId('editor-viewport').boundingBox();
  await page.getByRole('button', { name: 'Im Foto markieren →', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.getByTestId('editor-viewport').boundingBox()).toEqual(fotoPosition);
  await page.getByRole('heading', { name: 'Gauben', exact: true }).scrollIntoViewIfNeeded();
  await bildBeleg(page, `${testInfo.project.name}-gauben-direkt`, false);
  await dachWerkzeuge.getByRole('button', { name: 'Umriss', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Umriss übernehmen', exact: true })).toBeDisabled();
  await bildBeleg(page, `${testInfo.project.name}-umriss-direkt`, false);
  const markierung = page.getByRole('img', { name: /im Foto markieren/ });
  const punkt = async (x: number, y: number) => {
    const b = (await markierung.boundingBox())!;
    await markierung.click({ position: { x: b.width * x, y: b.height * y } });
  };
  await punkt(.1, .85);
  await dachWerkzeuge.getByRole('button', { name: 'Aussparungen', exact: true }).click();
  const entwurf = page.getByRole('dialog', { name: 'Maßentwurf noch offen' });
  await expect(entwurf).toBeVisible();
  await entwurf.getByRole('button', { name: 'Bleiben', exact: true }).click();
  await expect(page.getByTestId('umriss-griff')).toHaveCount(1);
  await dachWerkzeuge.getByRole('button', { name: 'Aussparungen', exact: true }).click();
  await entwurf.getByRole('button', { name: 'Verwerfen', exact: true }).click();
  expect((await stand(page)).flaechen[0].umrissM).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Aussparungen fertig · Belegen', exact: true })).toBeVisible();
  await dachWerkzeuge.getByRole('button', { name: 'Umriss', exact: true }).click();
  for (const [x, y] of [[.1, .85], [.9, .85], [.9, .2], [.1, .2]]) await punkt(x!, y!);
  await page.getByRole('button', { name: 'Umriss übernehmen', exact: true }).click();
  expect((await stand(page)).flaechen[0].umrissM).toHaveLength(4);
  await dachWerkzeuge.getByRole('button', { name: 'Umriss', exact: true }).click();
  await expect(page.getByTestId('umriss-griff')).toHaveCount(4);
  await page.getByRole('button', { name: 'Auswählen', exact: true }).click();
  await expect(page.getByRole('img', { name: /Belegungsfläche Dachfläche 1/ })).toBeVisible();
  await dachWerkzeuge.getByRole('button', { name: 'Umriss', exact: true }).click();
  await expect(page.getByTestId('umriss-griff')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  expect(fehler).toEqual([]);
});
