import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

function crc32(daten: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of daten) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(typ: string, daten: Buffer): Buffer {
  const typBytes = Buffer.from(typ, 'ascii');
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(Buffer.concat([typBytes, daten])));
  return Buffer.concat([laenge, typBytes, daten, pruefsumme]);
}

/** Kleines lokales Testfoto ohne zusätzliche Binärdatei im Repository. */
function testPng(breite = 240, hoehe = 160): Buffer {
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf.set([8, 6, 0, 0, 0], 8); // RGBA, 8 Bit
  const zeile = Buffer.alloc(1 + breite * 4, 255);
  zeile[0] = 0;
  for (let x = 0; x < breite; x++) {
    zeile[1 + x * 4] = 185 + (x % 40);
    zeile[2 + x * 4] = 195;
    zeile[3 + x * 4] = 205;
  }
  const bild = Buffer.concat(Array.from({ length: hoehe }, () => zeile));
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', kopf),
    pngChunk('IDAT', deflateSync(bild)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function projektPflichtfelder(page: Page) {
  await page.getByRole('button', { name: '1. Projekt' }).click();
  await page.getByLabel('Kunde').fill('Familie Browserprüfung');
  await page.getByLabel('Adresse').fill('Testweg 1, 88299 Leutkirch');
  await page.getByLabel('Erfasser (Vertrieb)').fill('Genrih');
}

async function fotoKalibrieren(
  page: Page,
  dachDirektBelegen = true,
  traufeZeichnen = false,
  fotoGroesse: { breite: number; hoehe: number } = { breite: 240, hoehe: 160 },
) {
  await page.getByRole('button', { name: '2. Dach & Belegung' }).click();
  const dateiauswahl = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto hinzufügen' }).click();
  await (await dateiauswahl).setFiles({
    name: 'dach.png',
    mimeType: 'image/png',
    buffer: testPng(fotoGroesse.breite, fotoGroesse.hoehe),
  });
  await expect(page.getByRole('toolbar', { name: 'Werkzeuge für die Foto-Markierung' })).toBeVisible();
  if (!traufeZeichnen) await page.getByRole('button', { name: /Überspringen/ }).click();
  const foto = page.getByRole('img', { name: /im Foto markieren/ });
  const box = await foto.boundingBox();
  if (!box) throw new Error('Das Kalibrierfoto ist nicht sichtbar.');
  if (traufeZeichnen) {
    for (const x of [0.1, 0.9]) {
      await foto.click({ position: { x: box.width * x, y: box.height * 0.9 } });
    }
    await page.getByRole('toolbar', { name: 'Werkzeuge für die Foto-Markierung' }).hover();
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    await foto.screenshot({ path: resolve('.debug-shots', `traufe-${page.viewportSize()!.width}.png`) });
  }
  for (const [x, y] of [[0.1, 0.9], [0.9, 0.9], [0.85, 0.1], [0.15, 0.1]]) {
    await foto.click({ position: { x: box.width * x, y: box.height * y } });
  }
  await foto.hover({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByTestId('naechste-kante-vorschau')).toHaveCount(0);
  mkdirSync(resolve('.debug-shots'), { recursive: true });
  await foto.screenshot({ path: resolve('.debug-shots', `perspektive-vier-punkte-${page.viewportSize()!.width}.png`) });
  await page.getByRole('button', { name: '4 Ecken übernehmen' }).click();
  if (!dachDirektBelegen) return;
  await page.getByRole('button', { name: /Dach belegen/ }).click();
  await expect(page.getByRole('button', { name: '+ Belegungsbereich zeichnen' })).toBeVisible();
}

async function erwarteGueltigenPdfDownload(page: Page) {
  const link = page.getByRole('button', { name: 'PDF herunterladen' });
  await expect(link).toBeVisible({ timeout: 25_000 });
  const downloadVersprechen = page.waitForEvent('download');
  await link.click();
  const download = await downloadVersprechen;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await download.failure()).toBeNull();
  const pfad = await download.path();
  if (!pfad) throw new Error('Der Browser hat keine heruntergeladene PDF-Datei bereitgestellt.');
  expect(readFileSync(pfad).subarray(0, 5).toString('ascii')).toBe('%PDF-');
}

async function zeichneZweiFelderUndVerschiebe(page: Page) {
  const dach = page.getByRole('img', { name: /Belegungsfläche Dachfläche 1/ });
  await page.getByRole('button', { name: '+ Belegungsbereich zeichnen' }).click();
  await dach.scrollIntoViewIfNeeded();
  const box = await dach.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('Die Belegungsfläche ist nicht sichtbar.');
  const sichtbar = {
    links: Math.max(0, box.x),
    rechts: Math.min(viewport.width - 2, box.x + box.width),
    oben: Math.max(56, box.y),
    unten: Math.min(viewport.height - 2, box.y + box.height),
  };
  const punkt = (x: number, y: number) => ({
    x: sichtbar.links + (sichtbar.rechts - sichtbar.links) * x,
    y: sichtbar.oben + (sichtbar.unten - sichtbar.oben) * y,
  });
  const ziehen = async (start: { x: number; y: number }, ende: { x: number; y: number }) => {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(ende.x, ende.y, { steps: 12 });
    await page.mouse.up();
  };

  await ziehen(punkt(0.12, 0.18), punkt(0.46, 0.82));
  await expect(page.getByText(/1 Feld/).first()).toBeVisible();
  await page.getByRole('button', { name: '+ Feld zeichnen' }).click();
  await dach.scrollIntoViewIfNeeded();
  const erstesFeld = dach.locator('path[fill="rgba(2,132,199,0.06)"]').first();
  const feldBox = await erstesFeld.boundingBox();
  const aktuelleDachBox = await dach.boundingBox();
  if (!feldBox || !aktuelleDachBox) throw new Error('Das erste Feld ist nicht sichtbar.');
  await ziehen(
    { x: feldBox.x + feldBox.width / 2, y: feldBox.y + feldBox.height * 0.02 },
    {
      x: Math.min(viewport.width - 2, aktuelleDachBox.x + aktuelleDachBox.width * 0.92),
      y: Math.min(viewport.height - 2, feldBox.y + feldBox.height * 0.98),
    },
  );
  await expect(page.getByText(/2 Felder/).first()).toBeVisible();
  await dach.press('ArrowRight');
  await expect(dach.locator('path[fill="rgba(2,132,199,0.06)"]')).toHaveCount(2);
}

async function satteldachGaubeAnlegen(page: Page) {
  await page.getByRole('button', { name: '+ Gaube' }).click();
  await page.getByRole('button', { name: 'Satteldachgaube' }).click();
  await page.getByRole('button', { name: 'Im Foto markieren →' }).click();
  const foto = page.getByRole('img', { name: 'Gaube im Dachfoto markieren' });
  const box = await foto.boundingBox();
  if (!box) throw new Error('Das Gaubenfoto ist nicht sichtbar.');
  const punkte = [
    [0.25, 0.80], [0.75, 0.80], [0.75, 0.30], [0.25, 0.30],
    [0.50, 0.22], [0.50, 0.88],
  ];
  for (const [x, y] of punkte) {
    await foto.click({ position: { x: box.width * x!, y: box.height * y! } });
  }
  const anlegen = page.getByRole('button', { name: 'Gaube anlegen & fertig' });
  await expect(anlegen).toBeEnabled();
  await anlegen.click();
  await expect(page.getByRole('button', { name: 'Perspektive von Gaube 1, zweite Dachseite bearbeiten' })).toBeVisible();
}

test('responsive Ebenen und Touch-Ziele überdecken sich nicht', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '2. Dach & Belegung' }).click();
  const pruefung = await page.evaluate(() => {
    const sichtbar = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 1 && rect.height > 1;
    };
    const zuKlein = [...document.querySelectorAll('button, select, input:not([type="hidden"]):not([type="file"])')]
      .filter(sichtbar)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => ({
        text: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 60),
        breite: Math.round(element.getBoundingClientRect().width),
        hoehe: Math.round(element.getBoundingClientRect().height),
      }));
    const mass = document.querySelector('#flaechen-masse-p1');
    const werkzeug = document.querySelector('[role="toolbar"]');
    const kopf = document.querySelector('header');
    return {
      ueberlauf: document.documentElement.scrollWidth > innerWidth + 1,
      zuKlein,
      massPosition: mass ? getComputedStyle(mass).position : null,
      werkzeugPosition: werkzeug ? getComputedStyle(werkzeug).position : null,
      kopfPosition: kopf ? getComputedStyle(kopf).position : null,
    };
  });
  expect(pruefung.ueberlauf).toBe(false);
  expect(pruefung.zuKlein).toEqual([]);
  expect(pruefung.kopfPosition).toBe('sticky');
  expect(pruefung.werkzeugPosition).toBe('relative');
  expect(pruefung.massPosition).toBe(testInfo.project.use.viewport!.width >= 1024 ? 'sticky' : 'relative');
});

test('ein zweites Belegungsfeld lässt sich aus dem ersten heraus aufziehen', async ({ page }) => {
  await page.goto('/');
  await projektPflichtfelder(page);
  await fotoKalibrieren(page);

  const dach = page.getByRole('img', { name: /Belegungsfläche Dachfläche 1/ });
  await dach.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '+ Belegungsbereich zeichnen' }).click();
  await dach.scrollIntoViewIfNeeded();
  const erstesDachBox = await dach.boundingBox();
  const erstesViewport = page.viewportSize();
  if (!erstesDachBox || !erstesViewport) throw new Error('Die Belegungsfläche ist nicht sichtbar.');
  const sichtbar = {
    links: Math.max(0, erstesDachBox.x),
    rechts: Math.min(erstesViewport.width - 2, erstesDachBox.x + erstesDachBox.width),
    oben: Math.max(56, erstesDachBox.y),
    unten: Math.min(erstesViewport.height - 2, erstesDachBox.y + erstesDachBox.height),
  };
  const ersterStart = {
    x: sichtbar.links + (sichtbar.rechts - sichtbar.links) * 0.25,
    y: sichtbar.oben + (sichtbar.unten - sichtbar.oben) * 0.25,
  };
  const erstesEnde = {
    x: sichtbar.links + (sichtbar.rechts - sichtbar.links) * 0.65,
    y: sichtbar.oben + (sichtbar.unten - sichtbar.oben) * 0.70,
  };
  await page.mouse.move(ersterStart.x, ersterStart.y);
  await page.mouse.down();
  await page.mouse.move(erstesEnde.x, erstesEnde.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText(/1 Feld/).first()).toBeVisible();
  const moduleVorher = Number((await page.getByRole('toolbar', { name: 'Werkzeuge für Dachfläche 1' }).textContent())?.match(/(\d+) Module/)?.[1]);

  // Der Start des zweiten Zugs liegt mitten im ersten blauen Rechteck. Nur der
  // ausdrückliche Neu-Modus darf daraus ein weiteres Feld statt einer Bewegung machen.
  await page.getByRole('button', { name: '+ Feld zeichnen' }).click();
  await expect(page.getByRole('button', { name: '+ Feld zeichnen' })).toHaveAttribute('aria-pressed', 'true');
  await dach.scrollIntoViewIfNeeded();
  const erstesFeld = dach.locator('path[fill="rgba(2,132,199,0.06)"]').first();
  const feldBox = await erstesFeld.boundingBox();
  const dachBox = await dach.boundingBox();
  const viewport = page.viewportSize();
  if (!feldBox || !dachBox || !viewport) throw new Error('Das erste Feld ist nicht sichtbar.');
  const start = {
    x: feldBox.x + feldBox.width / 2,
    y: feldBox.y + feldBox.height * 0.02,
  };
  const ende = {
    x: Math.min(viewport.width - 2, dachBox.x + dachBox.width * 0.92),
    // Vertikal im ersten Feld bleiben, damit der nach rechts herausragende Teil
    // in jeder Bildschirmform garantiert mindestens eine Modulreihe erhält.
    y: Math.min(viewport.height - 2, feldBox.y + feldBox.height * 0.98),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(ende.x, ende.y, { steps: 20 });
  await page.mouse.up();

  await expect(page.getByText(/2 Felder/).first()).toBeVisible();
  await expect(dach.locator('path[fill="rgba(2,132,199,0.06)"]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '+ Feld zeichnen' })).toHaveAttribute('aria-pressed', 'false');
  const moduleDanach = Number((await page.getByRole('toolbar', { name: 'Werkzeuge für Dachfläche 1' }).textContent())?.match(/(\d+) Module/)?.[1]);
  expect(moduleDanach).toBeGreaterThan(moduleVorher);
});

test('Foto, Kalibrierung, Bereich und Rückgängig funktionieren zusammen', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const browserFehler: string[] = [];
  page.on('console', (meldung) => {
    if (meldung.type() === 'error') {
      const ort = meldung.location().url;
      browserFehler.push(`${meldung.text()}${ort ? ` @ ${ort}` : ''}`);
    }
  });
  page.on('pageerror', (fehler) => browserFehler.push(fehler.message));
  await page.goto('/');
  await projektPflichtfelder(page);
  await fotoKalibrieren(page);

  const werkzeug = page.getByRole('toolbar', { name: 'Werkzeuge für Dachfläche 1' });
  expect(await werkzeug.evaluate((element) => getComputedStyle(element).position)).toBe(
    testInfo.project.use.viewport!.width >= 1024 ? 'sticky' : 'relative',
  );

  await page.getByRole('button', { name: '+ Belegungsbereich zeichnen' }).click();
  const dach = page.getByRole('img', { name: /Belegungsfläche Dachfläche 1/ });
  await dach.scrollIntoViewIfNeeded();
  const box = await dach.boundingBox();
  if (!box) throw new Error('Die Belegungsfläche ist nicht sichtbar.');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Die Browsergröße ist unbekannt.');
  const links = Math.max(0, box.x);
  const rechts = Math.min(viewport.width, box.x + box.width);
  const oben = Math.max(56, box.y);
  const unten = Math.min(viewport.height, box.y + box.height);
  const start = { x: links + (rechts - links) * 0.2, y: oben + (unten - oben) * 0.2 };
  const ende = { x: links + (rechts - links) * 0.8, y: oben + (unten - oben) * 0.8 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(ende.x, ende.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText(/1 Feld/).first()).toBeVisible();

  // Das ausgewählte Feld über die kalibrierte Dachfläche hinausziehen. Während
  // des Zugs werden nur leichte Konturen aufgebaut; danach kehrt die Detailoptik
  // zurück und der blaue Feldrahmen bleibt tatsächlich außerhalb sichtbar.
  // Mobil wächst die Werkzeugleiste nach der Auswahl und schiebt das SVG nach
  // unten. Deshalb die echte Feldposition erst nach dem Anlegen neu auslesen.
  const feldPfad = dach.locator('path[fill="rgba(2,132,199,0.06)"]').first();
  const feldBox = await feldPfad.boundingBox();
  const aktuelleDachBox = await dach.boundingBox();
  if (!feldBox || !aktuelleDachBox) throw new Error('Das angelegte Feld ist nicht sichtbar.');
  const mitte = { x: feldBox.x + feldBox.width / 2, y: feldBox.y + feldBox.height / 2 };
  const ausserhalb = {
    x: Math.min(viewport.width - 2, aktuelleDachBox.x + aktuelleDachBox.width * 0.97),
    y: mitte.y,
  };
  await page.mouse.move(mitte.x, mitte.y);
  await page.mouse.down();
  await page.mouse.move(ausserhalb.x, ausserhalb.y, { steps: 30 });
  await expect(dach.locator('[data-modul-darstellung="kontur"]').first()).toBeVisible();
  await expect(dach.locator('[data-modul-darstellung="detail"]')).toHaveCount(0);
  await page.mouse.up();
  await expect(dach.locator('[data-modul-darstellung="detail"]').first()).toBeVisible();
  const feldRagtRaus = await dach.locator('path[fill="rgba(2,132,199,0.06)"]').evaluate((pfad) => {
    const d = pfad.getAttribute('d') ?? '';
    const zahlen = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xWerte = zahlen.filter((_, index) => index % 2 === 0);
    const breite = (pfad as SVGPathElement).ownerSVGElement?.viewBox.baseVal.width ?? 0;
    return xWerte.length > 0 && Math.max(...xWerte) > breite;
  });
  expect(feldRagtRaus).toBe(true);

  await dach.press('ArrowRight');
  await dach.press('Shift+ArrowDown');
  await page.getByRole('button', { name: /Feld löschen/ }).click();
  await expect(page.getByText('Noch kein Belegungsbereich angelegt.')).toBeVisible();
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect(page.getByText(/1 Feld/).first()).toBeVisible();

  await page.getByRole('button', { name: '3. Export' }).click();
  const pdfKnopf = page.getByRole('button', { name: 'PDF herunterladen' });
  await expect(pdfKnopf).toBeEnabled();
  if (testInfo.project.name === 'desktop') {
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    const download = page.waitForEvent('download');
    await pdfKnopf.click();
    await (await download).saveAs(resolve('.debug-shots', 'browser-audit-belegungsplan.pdf'));
  }
  await page.locator('summary').filter({ hasText: 'Technische Daten (JSON)' }).click();
  await expect(page.getByRole('button', { name: 'JSON kopieren' })).toBeEnabled();
  expect(browserFehler).toEqual([]);
});

test('nackter PDF-Plan bleibt ohne Kunde, Adresse und Erfasser verfügbar', async (
  { page },
  testInfo,
) => {
  await page.goto('/');
  await fotoKalibrieren(page, true, true);
  const grosserUmriss = page
    .getByTestId('arbeitsbereich-p1')
    .getByTestId('dachflaechen-umriss');
  await expect(grosserUmriss).toHaveCount(1);
  await expect(grosserUmriss).toBeVisible();
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'mobil-hoch') {
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    await page.getByTestId('arbeitsbereich-p1').screenshot({
      path: resolve('.debug-shots', `belegung-grosser-umriss-${testInfo.project.name}.png`),
    });
  }
  await page
    .getByTestId('arbeitsbereich-p1')
    .getByRole('button', { name: 'Automatisch belegen' })
    .click();
  const vorschauRahmen = page.getByTestId('dachflaechen-rahmen');
  await expect(vorschauRahmen).toHaveCount(1);
  await expect(vorschauRahmen).toBeVisible();
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'mobil-hoch') {
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    await page.screenshot({
      path: resolve('.debug-shots', `belegung-preview-rahmen-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: '3. Export' }).click();
  const pdf = page.getByRole('button', { name: 'PDF herunterladen' });
  await expect(pdf).toBeEnabled();
  await expect(page.getByText(/PDF noch gesperrt/)).toHaveCount(0);
  await expect(page.getByTestId('dachflaechen-rahmen')).toHaveCount(0);
  await expect(page.getByTestId('dachflaechen-umriss')).toHaveCount(0);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'mobil-hoch') {
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    await page.screenshot({
      path: resolve('.debug-shots', `export-nackt-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
  if (testInfo.project.name === 'desktop') {
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    const download = page.waitForEvent('download');
    await pdf.click();
    await (await download).saveAs(resolve('.debug-shots', 'browser-audit-nackter-belegungsplan.pdf'));
  }
});

// Diese Tests simulieren nur die Web-Share-Schnittstelle, kein echtes iOS.
test.describe('PDF-Dateiübergabe an iOS (Schnittstellentest)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone) Version/18.0 Mobile/15E148 Safari/604.1', hasTouch: true });

  test('übergibt gültige PDF-Bytes mit aktiver Nutzergeste und bietet bei Fehler einen Download', async ({ page }, testInfo) => {
    test.skip(!['desktop', 'mobil-hoch'].includes(testInfo.project.name));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: ({ files }: ShareData) => files?.[0]?.type === 'application/pdf' });
      Object.defineProperty(navigator, 'share', { value: async ({ files }: ShareData) => {
        const aktiv = navigator.userActivation.isActive;
        const datei = files![0]!;
        document.documentElement.dataset.geteiltePdf = JSON.stringify({
          aktiv, name: datei.name, typ: datei.type,
          kopf: await datei.slice(0, 5).text(), groesse: datei.size,
        });
        throw new DOMException('Test: Dialog gesperrt', 'NotAllowedError');
      } });
    });
    await page.goto('/');
    await fotoKalibrieren(page);
    await page.getByTestId('arbeitsbereich-p1').getByRole('button', { name: 'Automatisch belegen' }).click();
    await page.getByRole('button', { name: '3. Export' }).click();
    await expect(page.getByText(/In Dateien sichern/)).toBeVisible({ timeout: 25_000 });
    await page.screenshot({ path: resolve('.debug-shots', `ios-export-${testInfo.project.name}.png`), fullPage: true });
    await page.getByRole('button', { name: 'PDF herunterladen' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'PDF konnte nicht' })).toBeVisible();
    const datei = JSON.parse(await page.locator('html').getAttribute('data-geteilte-pdf') ?? '{}');
    expect(datei).toMatchObject({ aktiv: true, typ: 'application/pdf', kopf: '%PDF-' });
    expect(datei.name).toMatch(/\.pdf$/);
    expect(datei.groesse).toBeGreaterThan(1000);
    await page.screenshot({ path: resolve('.debug-shots', `ios-export-fehler-${testInfo.project.name}.png`), fullPage: true });
    const heruntergeladen = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Direkter PDF-Download' }).click();
    expect(await (await heruntergeladen).failure()).toBeNull();
  });
});

test.describe('PDF-Ausgabe auf dem iPad', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: () => false }));
  });
  test.use({
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
  });

  test('lädt den vorab erzeugten Plan über einen echten Dateilink', async (
    { page },
    testInfo,
  ) => {
    test.skip(testInfo.project.name !== 'tablet-grenze');
    await page.addInitScript(() => {
      URL.createObjectURL = () => {
        throw new Error('Blob-URLs sind in diesem iOS-Test deaktiviert.');
      };
    });
    await page.goto('/');
    await fotoKalibrieren(page);
    await page
      .getByTestId('arbeitsbereich-p1')
      .getByRole('button', { name: 'Automatisch belegen' })
      .click();
    await page.getByRole('button', { name: '3. Export' }).click();

    await erwarteGueltigenPdfDownload(page);
  });
});

test.describe('PDF-Ausgabe in Chrome auf dem iPad', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: () => false }));
  });
  test.use({
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
  });

  test('lädt den fertigen Plan ohne Blob-URL', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-grenze');
    await page.addInitScript(() => {
      URL.createObjectURL = () => {
        throw new Error('Blob-URLs sind in diesem iOS-WebView-Test deaktiviert.');
      };
    });
    await page.goto('/');
    await fotoKalibrieren(page, true, false, { breite: 1600, hoehe: 1200 });
    await zeichneZweiFelderUndVerschiebe(page);
    await page.getByRole('button', { name: '3. Export' }).click();

    await erwarteGueltigenPdfDownload(page);
  });
});

test.describe('PDF-Ausgabe in der Google-App auf dem iPad', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: () => false }));
  });
  test.use({
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 GSA/384.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
  });

  test('lädt den fertigen Plan ohne Blob-URL', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-grenze');
    await page.addInitScript(() => {
      URL.createObjectURL = () => {
        throw new Error('Blob-URLs sind in diesem iOS-WebView-Test deaktiviert.');
      };
    });
    await page.goto('/');
    await fotoKalibrieren(page);
    await page
      .getByTestId('arbeitsbereich-p1')
      .getByRole('button', { name: 'Automatisch belegen' })
      .click();
    await page.getByRole('button', { name: '3. Export' }).click();

    await erwarteGueltigenPdfDownload(page);
  });
});

test('Dachumriss schließt am Startpunkt und lässt sich erst danach verschieben', async ({ page }, testInfo) => {
  const browserFehler: string[] = [];
  page.on('console', (meldung) => {
    if (meldung.type() === 'error') browserFehler.push(meldung.text());
  });
  page.on('pageerror', (fehler) => browserFehler.push(fehler.message));

  await page.goto('/');
  await fotoKalibrieren(page, false);
  const foto = page.getByRole('img', { name: /im Foto markieren/ });
  const box = await foto.boundingBox();
  if (!box) throw new Error('Das Foto für den Dachumriss ist nicht sichtbar.');
  for (const [x, y] of [[0.15, 0.85], [0.85, 0.85], [0.80, 0.20], [0.20, 0.20], [0.20, 0.225]]) {
    await foto.click({ position: { x: box.width * x, y: box.height * y } });
  }
  // Die letzte Ecke liegt innerhalb der früheren Griff-Trefferzone ihrer Nachbarin.
  await expect(page.getByTestId('umriss-griff')).toHaveCount(5);
  await expect(page.getByTestId('umriss-griff').first()).toHaveCSS('cursor', 'crosshair');
  await foto.click({ position: { x: box.width * 0.15, y: box.height * 0.85 } });
  await expect(page.getByRole('button', { name: /Umriss fertig/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Dachumriss/ }).click();

  const griffe = page.getByTestId('umriss-griff');
  await expect(griffe).toHaveCount(5);
  await expect(griffe.first()).toHaveCSS('cursor', 'grab');
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'mobil-hoch') {
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    await foto.screenshot({ path: resolve('.debug-shots', `umriss-abgeschlossen-${testInfo.project.name}.png`) });
    await foto.hover({ position: { x: box.width / 2, y: box.height / 2 } });
    await foto.screenshot({ path: resolve('.debug-shots', `fadenkreuz-${testInfo.project.name}.png`) });
  }
  const ersterGriff = await griffe.first().boundingBox();
  if (!ersterGriff) throw new Error('Der erste Umrissgriff ist nicht sichtbar.');
  await page.mouse.move(ersterGriff.x + ersterGriff.width / 2, ersterGriff.y + ersterGriff.height / 2);
  await page.mouse.down();
  await page.mouse.move(ersterGriff.x + ersterGriff.width / 2 + 8, ersterGriff.y + ersterGriff.height / 2 + 5, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: /Umriss übernehmen/ }).click();

  await page.getByRole('button', { name: /Dachumriss/ }).click();
  await page.getByRole('button', { name: 'Manuellen Umriss entfernen' }).click();
  await expect(page.getByRole('button', { name: 'Manuellen Umriss entfernen' })).toHaveCount(0);
  await expect(page.getByText(/Kein manueller Dachumriss vorhanden/)).toBeVisible();

  await page.getByRole('button', { name: 'Perspektivrahmen bearbeiten' }).click();
  await expect(page.getByRole('button', { name: '4 Ecken übernehmen' })).toBeEnabled();
  expect(browserFehler).toEqual([]);
});

test('Hauptdach- und Gaubenperspektive bleiben gemeinsam bearbeitbar und löschbar', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const browserFehler: string[] = [];
  page.on('console', (meldung) => {
    if (meldung.type() === 'error') browserFehler.push(meldung.text());
  });
  page.on('pageerror', (fehler) => browserFehler.push(fehler.message));

  await page.goto('/');
  await projektPflichtfelder(page);
  await fotoKalibrieren(page);

  const perspektiveStarten = page.getByRole('button', { name: 'Perspektive bearbeiten', exact: true });
  await perspektiveStarten.click();
  const hauptSvg = page.getByRole('img', { name: /Perspektive von Dachfläche 1 bearbeiten/ });
  const vorher = await page.getByTestId('perspektiv-griffe').locator('polygon').getAttribute('points');
  await hauptSvg.press('ArrowRight');
  const entwurf = await page.getByTestId('perspektiv-griffe').locator('polygon').getAttribute('points');
  expect(entwurf).not.toBe(vorher);
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();

  await perspektiveStarten.click();
  const nachAbbruch = await page.getByTestId('perspektiv-griffe').locator('polygon').getAttribute('points');
  expect(nachAbbruch).toBe(vorher);
  await hauptSvg.press('ArrowRight');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.getByRole('button', { name: /Rückgängig/ }).click();

  await satteldachGaubeAnlegen(page);
  await page.getByRole('button', { name: 'Perspektive von Gaube 1, zweite Dachseite bearbeiten' }).click();
  const gaubenSvg = page.getByRole('img', { name: 'Gaube im Dachfoto markieren' });
  const griffe = page.getByRole('button', { name: /Gaubenpunkt/ });
  await expect(griffe).toHaveCount(6);
  const trefferflaechen = await griffe.evaluateAll((elemente) =>
    elemente.map((element) => ({
      breite: element.getBoundingClientRect().width,
      hoehe: element.getBoundingClientRect().height,
      strich: Number.parseFloat(getComputedStyle(element).strokeWidth),
    })),
  );
  expect(trefferflaechen.every((x) => x.breite >= 44 || x.hoehe >= 44 || x.strich >= 44)).toBe(true);
  const ersterGriff = await griffe.first().boundingBox();
  if (!ersterGriff) throw new Error('Der erste Gaubengriff ist nicht sichtbar.');
  await expect(gaubenSvg.locator('[data-modul-darstellung="vorschau"]').first()).toBeVisible();
  await griffe.first().dispatchEvent('pointerdown', {
    pointerId: 7,
    clientX: ersterGriff.x + ersterGriff.width / 2,
    clientY: ersterGriff.y + ersterGriff.height / 2,
    buttons: 1,
  });
  await griffe.first().dispatchEvent('pointermove', {
    pointerId: 7,
    clientX: ersterGriff.x + ersterGriff.width / 2 + 8,
    clientY: ersterGriff.y + ersterGriff.height / 2 + 5,
    buttons: 1,
  });
  await expect(gaubenSvg.locator('[data-modul-darstellung="kontur"]').first()).toBeVisible();
  expect(await gaubenSvg.locator('clipPath').count()).toBe(0);
  await griffe.first().dispatchEvent('pointerup', {
    pointerId: 7,
    clientX: ersterGriff.x + ersterGriff.width / 2 + 8,
    clientY: ersterGriff.y + ersterGriff.height / 2 + 5,
  });
  await expect(gaubenSvg.locator('[data-modul-darstellung="vorschau"]').first()).toBeVisible();
  await gaubenSvg.press('ArrowRight');
  await page.getByRole('button', { name: 'Markierung übernehmen' }).click();

  const loeschen = page.getByRole('button', { name: 'Gaube 1, zweite Dachseite löschen' });
  page.once('dialog', (dialog) => dialog.dismiss());
  await loeschen.click();
  await expect(loeschen).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await loeschen.click();
  await expect(page.getByRole('button', { name: /Gaube 1.*löschen/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect(page.getByRole('button', { name: 'Gaube 1, zweite Dachseite löschen' })).toBeVisible();
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: '3. Export' }).click();
    const pdf = page.getByRole('button', { name: 'PDF herunterladen' });
    await expect(pdf).toBeEnabled();
    mkdirSync(resolve('.debug-shots'), { recursive: true });
    const download = page.waitForEvent('download');
    await pdf.click();
    await (await download).saveAs(resolve('.debug-shots', 'browser-audit-satteldachgaube.pdf'));
  }
  expect(browserFehler).toEqual([]);
});
