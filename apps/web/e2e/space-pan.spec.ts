import { oeffneStartprojekt } from './projekt-einstieg';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { neuesProjekt } from '../lib/model';

async function gespeichert(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!).projekte[0].projekt);
}
test('Leertaste schiebt nur die Fotoansicht und erhält Werkzeug, Daten und Touch', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const projekt = neuesProjekt();
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>').toString('base64');
  projekt.fotos = [{ id: 'foto', name: 'Dach', dataUrl, breitePx: 1600, hoehePx: 900 }];
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt',
    felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 6, quer: false }],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript(projekt => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./');
  await oeffneStartprojekt(page);
  const viewport = page.getByTestId('editor-viewport'), transform = page.getByTestId('editor-bild-transform');
  await expect(viewport).toBeVisible();
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  const feld = page.getByRole('button', { name: '+ Feld zeichnen', exact: true });
  await feld.click();
  const original = await gespeichert(page);
  const b = (await viewport.boundingBox())!, x = b.x + b.width * .4, y = b.y + b.height * .4;
  const before = await transform.getAttribute('style');
  if (info.project.name === 'mobil') {
    // Eine einzelne Fingergeste bleibt beim Zeichenwerkzeug, auch nach Space.
    await page.mouse.move(0, 0); await page.keyboard.down('Space');
    await page.touchscreen.tap(x, y); await page.keyboard.up('Space');
    await expect(transform).toHaveAttribute('style', before!);
    expect(await gespeichert(page)).toEqual(original);
  } else {
    await page.mouse.move(x, y); await page.keyboard.down('Space');
    await expect(viewport).toHaveCSS('cursor', 'grab');
    await page.mouse.down(); await page.mouse.move(x + 80, y + 50, { steps: 5 });
    // WebKit can deliver the final move before its React style commit.
    await expect(transform).toHaveAttribute('style', /translate\(80px, 50px\)/);
    await expect(viewport).toHaveCSS('cursor', 'grabbing');
    const moved = await transform.getAttribute('style');
    await page.keyboard.up('Space');
    await page.mouse.move(x + 110, y + 70); await page.mouse.up();
    await expect(transform).toHaveAttribute('style', moved!);
    await expect(feld).toHaveAttribute('aria-pressed', 'true');
    expect(await gespeichert(page)).toEqual(original);
    // Die nächste Mausgeste zeichnet wieder, ohne manuelles Umschalten.
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 140, y + 120, { steps: 5 }); await page.mouse.up();
    await expect.poll(async () => (await gespeichert(page)).flaechen[0].felder.length).toBe(2);
    await page.getByRole('button', { name: /Rückgängig/ }).click();
    await expect.poll(async () => (await gespeichert(page)).flaechen[0].felder.length).toBe(1);
    // Verlorenes Key-up durch einen Fensterwechsel bleibt nicht hängen.
    await page.mouse.move(x, y); await page.keyboard.down('Space');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(viewport).not.toHaveCSS('cursor', 'grab');
    await page.keyboard.up('Space');
    // Eingaben erhalten Leerzeichen auch bei über dem Foto geparkter Maus.
    await page.getByRole('button', { name: 'Fotos', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'Name des Drohnenfotos' });
    await name.fill('Dach'); await page.mouse.move(x, y); await page.keyboard.press('Space');
    await expect(name).toHaveValue('Dach ');
  }
  const shots = resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/space-pan'); mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: resolve(shots, `${info.project.name}.png`) });
  expect(errors).toEqual([]);
});
