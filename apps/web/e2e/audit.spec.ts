import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
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

async function fotoKalibrieren(page: Page) {
  await page.getByRole('button', { name: '2. Dach & Belegung' }).click();
  const dateiauswahl = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto hinzufügen' }).click();
  await (await dateiauswahl).setFiles({
    name: 'dach.png',
    mimeType: 'image/png',
    buffer: testPng(),
  });
  await expect(page.getByRole('toolbar', { name: 'Werkzeuge für die Foto-Markierung' })).toBeVisible();
  await page.getByRole('button', { name: /Überspringen/ }).click();
  const foto = page.getByRole('img', { name: /im Foto markieren/ });
  const box = await foto.boundingBox();
  if (!box) throw new Error('Das Kalibrierfoto ist nicht sichtbar.');
  for (const [x, y] of [[0.1, 0.9], [0.9, 0.9], [0.85, 0.1], [0.15, 0.1]]) {
    await foto.click({ position: { x: box.width * x, y: box.height * y } });
  }
  await page.getByRole('button', { name: '4 Ecken übernehmen' }).click();
  await page.getByRole('button', { name: /Dach belegen/ }).click();
  await expect(page.getByRole('button', { name: '+ Belegungsbereich zeichnen' })).toBeVisible();
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

test('Exportsperre springt zum konkreten Pflichtfehler', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3. Export' }).click();
  await expect(page.getByRole('button', { name: 'PDF herunterladen' })).toBeDisabled();
  await page.getByRole('button', { name: 'Zum Fehler' }).first().click();
  await expect(page.getByRole('button', { name: '1. Projekt' })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByLabel('Kunde')).toBeFocused();
});
