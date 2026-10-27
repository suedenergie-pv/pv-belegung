import { expect, type Page } from '@playwright/test';

/** Bestehende Editorprüfungen wählen ihr Projekt jetzt bewusst in der Übersicht. */
export async function oeffneStartprojekt(page: Page) {
  await expect(page.getByRole('heading', { name: 'Meine Projekte' })).toBeVisible();
  const fortsetzen = page.getByRole('link', { name: /Fortsetzen/ });
  if (await fortsetzen.count()) await fortsetzen.click();
  else await page.getByRole('button', { name: '+ Neues Projekt', exact: true }).click();
}

/** Die Orientierung wird im selben Vierpunkt-Schritt ausdrücklich am Bild gewählt. */
export async function waehleUntereKante(page: Page, kante = 1) {
  const ziel = page.getByRole('button', { name: `Kante ${kante} als untere Kante wählen`, exact: true });
  if (await ziel.count()) {
    // Horizontale SVG-Linien haben geometrisch Höhe 0, ihr breiter Stroke ist dennoch klickbar.
    const punkt = await ziel.locator('line').first().evaluate(line => {
      const l = line as SVGLineElement, m = l.getScreenCTM()!;
      const p = new DOMPoint((l.x1.baseVal.value + l.x2.baseVal.value) / 2, (l.y1.baseVal.value + l.y2.baseVal.value) / 2).matrixTransform(m);
      return { x: p.x, y: p.y };
    });
    await page.mouse.click(punkt.x, punkt.y);
  }
}
