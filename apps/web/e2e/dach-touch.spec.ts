import { test, expect, type Page } from '@playwright/test';
import { neuesProjekt, neueFlaeche, type Projekt } from '../lib/model';

async function stand(page: Page): Promise<Projekt> {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((p: { id: string }) => p.id === db.aktivId).projekt;
  });
}

for (const fall of ['normal', 'browserdialog-gesperrt', 'nach-browser-zurueck'] as const) {
  for (const neu of [false, true]) test(`Entfernen per Fingertipp: ${fall}, ${neu ? 'neu angelegt' : 'beide belegt'}`, async ({ page }, info) => {
    const errors: string[] = [];
    const nativeDialoge: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async dialog => { nativeDialoge.push(dialog.message()); await dialog.dismiss(); });
    if (fall !== 'normal') {
      // Echte Browserrichtlinie statt window.confirm-Mock. Ohne allow-modals
      // bricht der alte Löschpfad still ab; der Anwendungsdialog muss funktionieren.
      // Das reproduziert den Fehlerpfad, nicht eine konkrete iPad-Konfiguration.
      await page.route('**/*', async route => {
        if (route.request().resourceType() !== 'document') return route.continue();
        const response = await route.fetch();
        await route.fulfill({ response, headers: {
          ...response.headers(), 'content-security-policy': 'sandbox allow-same-origin allow-scripts allow-downloads',
        } });
      });
    }
    const projekt = neuesProjekt();
    Object.assign(projekt.flaechen[0]!, { grunddatenFertig: true, massStatus: 'bestaetigt',
      felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 4, quer: false }] });
    if (!neu) projekt.flaechen.push({ ...neueFlaeche(2, 'B'), grunddatenFertig: true, massStatus: 'bestaetigt',
      felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 4, quer: false }] });
    await page.addInitScript(projekt => {
      if (!localStorage.getItem('pv-belegung-projekte-v2')) localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({
        aktivId: 'qa', workflowVersion: 2,
        projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }],
      }));
    }, projekt);
    await page.goto('./');
    await page.getByRole('link', { name: /Fortsetzen/ }).tap();
    const liste = page.locator('details').filter({ has: page.getByLabel('Dachflächen im Projekt') });
    const oeffneListe = async () => {
      if (await liste.getAttribute('open') === null) await liste.locator('summary').tap();
    };
    await oeffneListe();
    if (neu) {
      await page.getByRole('button', { name: '+ Dachfläche hinzufügen', exact: true }).tap();
      await oeffneListe();
    }
    if (fall === 'nach-browser-zurueck') {
      await page.getByRole('button', { name: /Alle Projekte/ }).tap();
      await expect(page.getByRole('heading', { name: 'Meine Projekte' })).toBeVisible();
      await page.goBack();
      await expect(page.getByLabel('Aktive Dachfläche')).toBeVisible();
      await oeffneListe();
    }
    await expect.poll(async () => (await stand(page)).flaechen.length).toBe(2);
    const vorher = await stand(page);
    const zielId = neu ? 'p2' : 'p1';
    const ziel = vorher.flaechen.find(f => f.id === zielId)!;
    const button = page.getByRole('button', { name: `Dachfläche „${ziel.name}“ entfernen`, exact: true });
    await expect(button).toBeEnabled();
    await button.scrollIntoViewIfNeeded();
    const treffer = await button.evaluate(b => {
      const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, trifft: b.contains(document.elementFromPoint(x, y)) };
    });
    expect(treffer.trifft).toBe(true);
    // Ein echter Touchzyklus auf dem sichtbaren Knopf, kein dispatchEvent/click().
    await page.touchscreen.tap(treffer.x, treffer.y);
    const dialog = page.getByRole('dialog', { name: 'Dachfläche entfernen?', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(ziel.name);
    await page.screenshot({ path: info.outputPath('loeschbestaetigung.png') });
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).tap();
    expect((await stand(page)).flaechen).toEqual(vorher.flaechen);
    await button.tap();
    await dialog.getByRole('button', { name: 'Entfernen', exact: true }).tap();
    await expect(dialog).not.toBeVisible();
    const verbleibend = vorher.flaechen.filter(f => f.id !== zielId);
    await expect.poll(async () => (await stand(page)).flaechen).toEqual(verbleibend);
    await expect(page.getByLabel('Aktive Dachfläche')).toHaveValue(verbleibend[0]!.id);
    await page.reload();
    await expect(page.getByLabel('Aktive Dachfläche')).toHaveValue(verbleibend[0]!.id);
    expect((await stand(page)).flaechen).toEqual(verbleibend);
    expect(nativeDialoge).toEqual([]);
    expect(errors).toEqual([]);
  });
}
