import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.use({ hasTouch: true });
const ordner = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/tablet-fadenkreuz-2026-10-01', process.env.PV_QA_PHOTO ? '.' : 'portable');

async function kreuz(page: Page) {
  const k = page.getByTestId('foto-fadenkreuz');
  return [Number(await k.getAttribute('data-x')), Number(await k.getAttribute('data-y'))];
}
async function bildMasse(page: Page) {
  return page.locator('[data-punkt-steuerung] svg[role=img]').evaluate((svg) => {
    const s = svg as SVGSVGElement;
    const b = s.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height, w: s.viewBox.baseVal.width, h: s.viewBox.baseVal.height };
  });
}
async function schiebeKreuz(page: Page, x: number, y: number, nativ: boolean) {
  const vorher = await kreuz(page), bild = await bildMasse(page);
  const fenster = (await page.getByTestId('editor-viewport').boundingBox())!;
  const dx = (x * bild.w - vorher[0]!) / bild.w * bild.width;
  const dy = (y * bild.h - vorher[1]!) / bild.h * bild.height;
  // Der Finger startet absichtlich fern vom Kreuz; das Bild funktioniert wie ein Touchpad.
  const start = { x: fenster.x + fenster.width / 2 - dx / 2, y: fenster.y + fenster.height / 2 - dy / 2 };
  if (nativ) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let i = 1; i <= 4; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + dx * i / 4, y: start.y + dy * i / 4, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.getByTestId('editor-viewport').evaluate((node, g) => {
      const send = (type: string, x: number, y: number) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1, clientX: x, clientY: y }));
      send('pointerdown', g.start.x, g.start.y);
      for (let i = 1; i <= 4; i++) send('pointermove', g.start.x + g.dx * i / 4, g.start.y + g.dy * i / 4);
      send('pointerup', g.start.x + g.dx, g.start.y + g.dy);
    }, { start, dx, dy });
  }
  await expect.poll(async () => Math.abs((await kreuz(page))[0]! / bild.w - x)).toBeLessThan(.01);
  await expect.poll(async () => Math.abs((await kreuz(page))[1]! / bild.h - y)).toBeLessThan(.01);
}
async function bestaetigen(page: Page, name = 'Punkt setzen') {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeEnabled();
  // Kein automatisches Scrollen: der Bestätigungsbutton muss bereits frei erreichbar sein.
  await expect(button).toBeInViewport({ ratio: 1 });
  const b = (await button.boundingBox())!, f = (await page.getByTestId('editor-viewport').boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(await button.evaluate((e) => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

test('Fadenkreuz: Finger bewegt nur den Cursor, fester Button setzt Punkte, Pinch verändert nur das Foto', async ({ page, browserName }, info) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  mkdirSync(ordner, { recursive: true });
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.goto('./', { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
  await page.getByRole('button', { name: 'Maße übernehmen', exact: true }).click();
  // Die Geometrie benötigt echte Pixelabstände; ein 1×1-PNG ist kein geeignetes Aufmaß-Foto.
  const testFoto = process.env.PV_QA_PHOTO ? null : await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 900;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#94a3b8'; context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const wahl = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto hinzufügen', exact: true }).click();
  await (await wahl).setFiles(process.env.PV_QA_PHOTO ?? { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(testFoto!, 'base64') });
  await expect(page.getByTestId('foto-fadenkreuz')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fadenkreuz bedienen', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Überspringen \(/ }).click();
  let gesetzt = 0;
  for (const [x, y] of [[.1, .85], [.9, .85], [.9, .2], [.1, .2]]) {
    await schiebeKreuz(page, x!, y!, browserName === 'chromium');
    await bestaetigen(page);
    if (++gesetzt < 4) await expect(page.getByText(`Ecke ${gesetzt + 1} von 4 mit dem Fadenkreuz anvisieren und „Punkt setzen“ drücken (Dach).`)).toBeVisible();
  }
  await page.getByRole('button', { name: '4 Ecken übernehmen', exact: true }).click();
  const fenster = page.getByTestId('editor-viewport');
  // Reiner Tap im Bild setzt keinen Punkt, auch kein nachträglicher Kompatibilitätsklick.
  const b = (await fenster.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width * .6, b.y + b.height * .6);
  await expect(page.getByTestId('naechste-kante-vorschau')).toHaveCount(0);
  await schiebeKreuz(page, .4, .4, browserName === 'chromium');
  await bestaetigen(page);
  await schiebeKreuz(page, .6, .6, browserName === 'chromium');
  await bestaetigen(page);
  await expect(page.getByText(/^Aussparung 1 ·/)).toBeVisible();
  await page.screenshot({ path: resolve(ordner, `${info.project.name}-aussparung.png`) });
  const vorPinch = await page.getByTestId('editor-bild-transform').getAttribute('style');
  await fenster.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const send = (t: string, id: number, x: number) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, clientX: b.x + b.width * x, clientY: b.y + b.height * .5 }));
    send('pointerdown', 1, .3); send('pointermove', 1, .32); send('pointerdown', 2, .6);
    send('pointermove', 2, .75); send('pointerup', 2, .75); send('pointermove', 1, .4); send('pointerup', 1, .4);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.getByTestId('editor-bild-transform')).not.toHaveAttribute('style', vorPinch!);
  const bildNachPinch = await bildMasse(page), kreuzNachPinch = await kreuz(page), viewportNachPinch = (await fenster.boundingBox())!;
  const kreuzX = bildNachPinch.x + kreuzNachPinch[0]! / bildNachPinch.w * bildNachPinch.width;
  const kreuzY = bildNachPinch.y + kreuzNachPinch[1]! / bildNachPinch.h * bildNachPinch.height;
  expect(kreuzX).toBeGreaterThanOrEqual(viewportNachPinch.x - 1);
  expect(kreuzX).toBeLessThanOrEqual(viewportNachPinch.x + viewportNachPinch.width + 1);
  expect(kreuzY).toBeGreaterThanOrEqual(viewportNachPinch.y - 1);
  expect(kreuzY).toBeLessThanOrEqual(viewportNachPinch.y + viewportNachPinch.height + 1);
  await expect(page.getByText(/^Aussparung 1 ·/)).toBeVisible();
  await expect(page.getByText(/^Aussparung 2 ·/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Alles anzeigen', exact: true }).click();
  // Außerhalb des Bildes scrollen, während Kreuz und Bestätigung erreichbar bleiben.
  await page.getByRole('complementary', { name: 'Editor-Einstellungen' }).evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await schiebeKreuz(page, .3, .3, browserName === 'chromium');
  await bestaetigen(page);
  await page.getByRole('group', { name: 'Dach bearbeiten' }).getByRole('button', { name: 'Gauben', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verwerfen', exact: true }).click();
  await page.getByRole('button', { name: 'Satteldachgaube', exact: true }).click();
  await page.getByRole('button', { name: 'Im Foto markieren →', exact: true }).click();
  for (const [x, y] of [[.3, .75], [.7, .75], [.7, .35], [.3, .35], [.5, .3], [.5, .8]]) {
    await schiebeKreuz(page, x!, y!, browserName === 'chromium');
    await bestaetigen(page);
  }
  await expect(page.getByRole('button', { name: 'Gaube anlegen & fertig', exact: true })).toBeEnabled();
  await page.screenshot({ path: resolve(ordner, `${info.project.name}-gaube.png`) });
  // Gegriffene Ecke folgt erst dem Bestätigungsbutton, niemals der Wischgeste.
  await bestaetigen(page, 'Ecke greifen');
  const punkt = page.getByRole('button', { name: 'Gaubenpunkt 6', exact: true });
  const vorher = await punkt.getAttribute('cx');
  await schiebeKreuz(page, .53, .8, browserName === 'chromium');
  expect(await punkt.getAttribute('cx')).toBe(vorher);
  await bestaetigen(page, 'Ecke hier ablegen');
  expect(await punkt.getAttribute('cx')).not.toBe(vorher);
  await page.getByRole('button', { name: 'Gaube anlegen & fertig', exact: true }).click();
  await expect(page.getByText(/1 Gaube angelegt/)).toBeVisible();
  // Auch die nachträgliche Hauptdach-Korrektur bestätigt jede Ecke getrennt.
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await page.getByRole('button', { name: 'Perspektive bearbeiten', exact: true }).click();
  const rahmen = page.getByTestId('perspektiv-griffe').locator('polygon');
  const urspruenglich = await rahmen.getAttribute('points');
  await schiebeKreuz(page, .1, .85, browserName === 'chromium');
  await bestaetigen(page, 'Ecke greifen');
  await schiebeKreuz(page, .13, .82, browserName === 'chromium');
  await expect(rahmen).toHaveAttribute('points', urspruenglich!);
  await bestaetigen(page, 'Ecke hier ablegen');
  await expect(rahmen).not.toHaveAttribute('points', urspruenglich!);
  await page.getByTestId('perspektiv-editor-steuerung').getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await page.getByRole('button', { name: 'Perspektive bearbeiten', exact: true }).click();
  await expect(rahmen).toHaveAttribute('points', urspruenglich!);
  await page.getByTestId('perspektiv-editor-steuerung').getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  expect(fehler).toEqual([]);
});
