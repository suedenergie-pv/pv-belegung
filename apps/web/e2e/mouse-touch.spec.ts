import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.use({ hasTouch: true });
const ordner = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/mouse-touch');
async function mausPunkt(page: Page, foto: Locator, x: number, y: number) {
  const b = (await foto.boundingBox())!;
  await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
}
async function ziehe(page: Page, foto: Locator, x: number, y: number, dx: number, dy: number) {
  const b = (await foto.boundingBox())!;
  await page.mouse.move(b.x + b.width * x, b.y + b.height * y);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * (x + dx), b.y + b.height * (y + dy), { steps: 5 });
  await page.mouse.up();
}

for (const coarse of [false, true]) test(`Maus und Touch wechseln ohne Punktverlust (primär ${coarse ? 'Touch' : 'Maus'})`, async ({ page }, info) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  mkdirSync(ordner, { recursive: true });
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  // Touch-Hardware bleibt vorhanden. Nur der primäre Zeiger variiert.
  await page.addInitScript((coarse) => {
    // Windows-WebKit emuliert Touch-Events, meldet dabei aber maxTouchPoints=0.
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const media = original(query);
      if (query === '(pointer: coarse)') Object.defineProperty(media, 'matches', { value: coarse });
      return media;
    };
  }, coarse);
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
  await page.getByRole('button', { name: 'Maße übernehmen', exact: true }).click();
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  const wahl = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto hinzufügen', exact: true }).click();
  await (await wahl).setFiles(process.env.PV_QA_PHOTO ?? { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  const touchLeiste = page.locator('[data-punkt-steuerung]');
  await expect(touchLeiste).toHaveCount(coarse ? 1 : 0);
  await page.getByRole('button', { name: /Überspringen \(/ }).click();
  const foto = page.getByRole('img', { name: /im Foto markieren/ });
  // Der erste echte Mausklick setzt bereits die erste Ecke, auch bei aktivem Kreuz.
  await mausPunkt(page, foto, .1, .85);
  await expect(touchLeiste).toHaveCount(0);
  await expect(page.getByText(/Ecke 2 von 4/)).toBeVisible();
  // Ein Finger setzt keine zweite Ecke und blendet die feste Bestätigung wieder ein.
  const b = (await foto.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width * .5, b.y + b.height * .5);
  await expect(touchLeiste).toHaveCount(1);
  await expect(page.getByText(/Ecke 2 von 4/)).toBeVisible();
  await page.screenshot({ path: resolve(ordner, `${info.project.name}-${coarse}-touch.png`) });
  await mausPunkt(page, foto, .9, .85);
  await expect(page.getByText(/Ecke 3 von 4/)).toBeVisible();
  await mausPunkt(page, foto, .9, .2);
  await mausPunkt(page, foto, .1, .2);
  // Tastatur bleibt erreichbar; echte Mausbewegung beendet ihren Cursor-Modus.
  await foto.focus(); await page.keyboard.press('ArrowRight');
  await expect(touchLeiste).toHaveCount(1);
  await page.mouse.move(b.x + b.width * .7, b.y + b.height * .6);
  await expect(touchLeiste).toHaveCount(0);
  const ecke = foto.locator('circle[fill="#f97316"]').last();
  const vorher = await ecke.getAttribute('cx');
  await ziehe(page, foto, .1, .2, .03, .02);
  await expect(ecke).not.toHaveAttribute('cx', vorher!);
  await page.screenshot({ path: resolve(ordner, `${info.project.name}-${coarse}-maus.png`) });
  await page.getByRole('button', { name: '4 Ecken übernehmen', exact: true }).click();
  await page.getByRole('button', { name: 'Aussparungen überspringen · Belegen', exact: true }).click();
  // Gaubenpunkte lassen sich trotz Touch-Hardware unmittelbar setzen und ziehen.
  await page.getByRole('group', { name: 'Dach bearbeiten' }).getByRole('button', { name: 'Gauben', exact: true }).click();
  await page.getByRole('button', { name: 'Satteldachgaube', exact: true }).click();
  await page.getByRole('button', { name: 'Im Foto markieren →', exact: true }).click();
  const gaube = page.getByRole('img', { name: 'Gaube im Dachfoto markieren', exact: true });
  for (const [x, y] of [[.3, .75], [.7, .75], [.7, .35], [.3, .35], [.5, .3], [.5, .8]]) await mausPunkt(page, gaube, x!, y!);
  const griff = page.getByRole('button', { name: 'Gaubenpunkt 6', exact: true });
  const vorGaube = await griff.getAttribute('cx');
  await ziehe(page, gaube, .5, .8, .02, 0);
  await expect(griff).not.toHaveAttribute('cx', vorGaube!);
  await page.getByRole('button', { name: 'Gaube anlegen & fertig', exact: true }).click();
  await page.getByRole('button', { name: 'Auswählen', exact: true }).click();
  // Die Hauptdach-Aussparung muss exakt auf der Silhouette beider Seiten liegen.
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  const kontur = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt.flaechen[0].gaubenAussparungen[0];
  });
  expect(kontur.fotoUmrissPx).toHaveLength(6);
  expect(kontur.rechteck.umrissM).toHaveLength(6);
  const path = await page.getByTestId('hindernis-kontur').first().getAttribute('d');
  const pixel = path!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
  expect(pixel).toHaveLength(12);
  kontur.fotoUmrissPx.flat().forEach((p: number, i: number) => expect(pixel[i]).toBeCloseTo(p, 1));
  await page.screenshot({ path: resolve(ordner, `${info.project.name}-${coarse}-gaubenkontur.png`) });
  // Die separate Perspektivkorrektur verwendet dieselbe direkte Mausbedienung.
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await page.getByRole('button', { name: 'Perspektive bearbeiten', exact: true }).click();
  const polygon = page.getByTestId('perspektiv-griffe').locator('polygon');
  const vorPerspektive = await polygon.getAttribute('points');
  const perspektivEcke = page.getByRole('button', { name: 'Perspektive Ecke 1', exact: true });
  await perspektivEcke.hover();
  await expect(touchLeiste).toHaveCount(0);
  const griffBox = (await perspektivEcke.boundingBox())!;
  await page.mouse.move(griffBox.x + griffBox.width / 2, griffBox.y + griffBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(griffBox.x + griffBox.width / 2 + 10, griffBox.y + griffBox.height / 2 - 10, { steps: 5 });
  await page.mouse.up();
  await expect(polygon).not.toHaveAttribute('points', vorPerspektive!);
  await expect(touchLeiste).toHaveCount(0);
  await page.getByTestId('perspektiv-editor-steuerung').getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(fehler).toEqual([]);
});
