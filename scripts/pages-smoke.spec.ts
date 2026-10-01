import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function gespeichertesProjekt(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);
    return db.projekte.find((entry: { id: string }) => entry.id === db.aktivId).projekt;
  });
}

test('Pages-Artefakt: Basepath, Assets, Foto-Belegung, PDF ohne Kundendaten und Reload', async ({ page, request }, info) => {
  const pageErrors: string[] = [], failedRequests: string[] = [], badResponses: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (req) => failedRequests.push(`${req.url()}: ${req.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  // Relativer Einstieg ist absichtlich vom Basepath der Release-Config abhängig.
  const response = await page.goto('./', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/pv-belegung/');
  const origin = new URL(page.url()).origin;
  expect((await request.get(`${origin}/`)).status()).toBe(404);
  expect((await request.get(`${origin}/pv-belegung/api/debug-shot/`)).status()).toBe(404);
  expect((await request.get(`${origin}/pv-belegung/does-not-exist/`)).status()).toBe(404);

  const assets = await page.locator('script[src], link[rel=stylesheet][href]').evaluateAll((elements) => elements.map((element) => element.getAttribute('src') ?? element.getAttribute('href')!));
  expect(assets.length).toBeGreaterThan(1);
  for (const asset of assets) {
    expect(asset).toMatch(/^\/pv-belegung\/_next\//);
    const result = await request.get(new URL(asset, origin).href);
    expect(result.status(), asset).toBe(200);
    expect(result.headers()['content-type'], asset).toMatch(/javascript|css/);
  }
  expect((await request.get(`${origin}${assets[0]!.replace('/pv-belegung', '')}`)).status()).toBe(404);

  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  await page.getByRole('button', { name: 'Dachdetails', exact: true }).click();
  await page.getByRole('button', { name: 'Maße übernehmen', exact: true }).click();
  // Öffentliche neutrale Laufzeit-Fixture; kein Kundendokument und kein privates Foto.
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#9aa8af'; context.fillRect(0, 0, 1600, 900);
    context.fillStyle = '#814732'; context.fillRect(100, 100, 1400, 700);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Foto hinzufügen', exact: true }).click();
  await (await chooser).setFiles({ name: 'pages-smoke.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await page.getByRole('button', { name: /Überspringen \(/ }).click();
  const photo = page.getByRole('img', { name: /im Foto markieren/ });
  await photo.scrollIntoViewIfNeeded();
  const bounds = await photo.boundingBox();
  if (!bounds) throw new Error('Foto-Arbeitsfläche fehlt.');
  for (const [x, y] of [[.1, .85], [.9, .85], [.9, .15], [.1, .15]]) {
    await photo.click({ position: { x: bounds.width * x!, y: bounds.height * y! } });
  }
  await page.getByRole('button', { name: '4 Ecken übernehmen', exact: true }).click();
  await page.getByRole('button', { name: /Aussparungen.*Belegen/ }).click();
  await page.getByRole('button', { name: 'Automatisch belegen', exact: true }).click();
  const before = await gespeichertesProjekt(page);
  expect(before.flaechen[0].massStatus).toBe('bestaetigt');
  expect(before.flaechen[0].felder).toHaveLength(1);
  expect(before.fotos).toHaveLength(1);
  await expect(page.getByTestId('flaechen-status')).toContainText(/[1-9]\d* Module/);
  const moduleStatus = await page.getByTestId('flaechen-status').textContent();
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Rand cm', exact: true })).toHaveValue('0');

  await page.getByRole('button', { name: '3. Export', exact: true }).click();
  const preview = page.locator('[data-export-vorschau]');
  await expect(preview).toHaveCount(1);
  const decoded = await preview.locator('svg image').first().evaluate((element) => new Promise<boolean>((resolve) => {
    const image = new Image(); image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.src = (element as SVGImageElement).href.baseVal;
  }));
  expect(decoded).toBe(true);
  await page.screenshot({ path: `.release/screenshots/${info.project.name}-export.png`, fullPage: true });
  const pdfButton = page.getByRole('button', { name: 'PDF herunterladen', exact: true });
  await expect(pdfButton).toBeEnabled({ timeout: 30_000 });
  const downloading = page.waitForEvent('download');
  await pdfButton.click();
  const pdf = await downloading;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await pdf.failure()).toBeNull();
  const pdfPath = await pdf.path();
  expect(pdfPath).not.toBeNull();
  const bytes = readFileSync(pdfPath!);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10_000);
  expect(bytes.subarray(-30).toString('ascii')).toContain('%%EOF');

  await page.getByRole('button', { name: '2. Dach & Belegung', exact: true }).click();
  await gespeichertesProjekt(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloaded = await gespeichertesProjekt(page);
  expect(reloaded.flaechen).toEqual(before.flaechen);
  expect(reloaded.fotos).toEqual(before.fotos);
  await expect(page.getByTestId('flaechen-status')).toHaveText(moduleStatus!);
  await expect(page.getByRole('img', { name: /Belegungsfläche Dachfläche 1/ })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/pv-belegung/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(badResponses).toEqual([]);
});
