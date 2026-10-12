import { expect, test, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { neuesProjekt } from '../lib/model';

async function punkt(page: Page, xm: number, ym: number) {
  const b = (await page.getByRole('img', { name: /^Belegungsfläche/ }).boundingBox())!;
  return { x: b.x + b.width * (.06 + .88 * xm / 18), y: b.y + b.height * (.87 - .70 * ym / 8) };
}
async function tippe(page: Page, xm: number, ym: number, touch = false) {
  const p = await punkt(page, xm, ym);
  if (touch) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
}
async function felder(page: Page) {
  await expect(page.getByRole('status').filter({ hasText:'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!).projekte[0].projekt.flaechen[0].felder);
}
const browserFehler = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => { expect(browserFehler.get(page) ?? []).toEqual([]); });
const auswahl = (page: Page) => page.getByText('1 von 2 ausgewählt', { exact:true });

test.beforeEach(async ({ page }) => {
  const fehler: string[] = []; browserFehler.set(page, fehler); page.on('pageerror', error => fehler.push(error.message));
  const projekt = neuesProjekt();
  // Neutrale Laufzeit-Fixture; für lokale visuelle QA optional das private Drohnenfoto.
  const dataUrl = process.env.PV_QA_PHOTO
    ? `data:image/jpeg;base64,${(await sharp(readFileSync(process.env.PV_QA_PHOTO)).resize(1600, 900).jpeg({ quality: 85 }).toBuffer()).toString('base64')}`
    : 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#8d513c" d="M0 0h1600v900H0z"/></svg>').toString('base64');
  projekt.fotos = [{ id: 'foto', name: 'Drohnenfoto', dataUrl, breitePx: 1600, hoehePx: 900 }];
  Object.assign(projekt.flaechen[0]!, {
    breiteM: 18, hoeheM: 8, randM: 0, grunddatenFertig: true, massStatus: 'bestaetigt',
    felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 6, quer: false }, { xM: 12, yM: 1, breiteM: 5, hoeheM: 6, quer: false }],
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[96, 783], [1504, 783], [1504, 153], [96, 153]], perspektiveBestaetigt: true, markierungFertig: true }],
  });
  await page.addInitScript((projekt) => {
    localStorage.setItem('pv-belegung-projekte-v1', JSON.stringify({ aktivId: 'qa', workflowVersion: 2, projekte: [{ id: 'qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, projekt);
  await page.goto('./');

});
test('Freies Foto und grauer Bildrand heben Auswahl auf, auch nach Pfeilaktion und Zoom', async ({ page }, info) => {
  const touch = info.project.name === 'mobil';
  await tippe(page,3.5,4,touch); await expect(auswahl(page)).toBeVisible();
  await tippe(page,9,4,touch); await expect(auswahl(page)).toHaveCount(0);
  await tippe(page,3.5,4,touch);
  await page.getByRole('button',{name:'nach rechts',exact:true}).click();
  const dir=resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/klick-audit'); mkdirSync(dir,{recursive:true});
  await page.screenshot({path:resolve(dir,`${info.project.name}-vor-rausklick.png`)});
  // Nach Screenshot/Scroll den wirklich freien Rand per Hittest bestimmen.
  const p=await page.getByTestId('editor-viewport').evaluate(el => {
    const b=el.getBoundingClientRect();
    const kandidaten=[{x:b.x+b.width/2,y:b.y+4},{x:b.x+b.width/2,y:b.bottom-4},
      {x:b.x+4,y:b.y+b.height/2},{x:b.right-4,y:b.y+b.height/2}];
    return kandidaten.find(p => document.elementFromPoint(p.x,p.y)===el);
  });
  expect(p).toBeTruthy();
  if(!p) throw new Error('Kein freier grauer Bildrand für den Rausklicktest');
  if(touch) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
  await expect(auswahl(page)).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Dachdetails',exact:true})).toHaveAttribute('aria-expanded','false');
  await page.screenshot({path:resolve(dir,`${info.project.name}-nach-rausklick.png`)});
  await page.getByRole('button',{name:'Vergrößern',exact:true}).click();
  await tippe(page,3.5,4,touch); await tippe(page,9,4,touch);
  await expect(auswahl(page)).toHaveCount(0);
});
test('Rechts- und Mittelklick ändern weder Auswahl noch Felder', async ({ page }) => {
  const original=await felder(page);
  const p=await punkt(page,3.5,4);
  for(const button of ['right','middle'] as const) {
    await page.mouse.move(p.x,p.y); await page.mouse.down({button});
    await page.mouse.move(p.x+40,p.y+20,{steps:4}); await page.mouse.up({button});
    expect(await felder(page)).toEqual(original);
    await expect(auswahl(page)).toHaveCount(0);
  }
});
test('Escape beendet Zeichnen, Modulentfernen und Verschieben direkt nach Werkzeugklick', async ({ page }, info) => {
  const original=await felder(page);
  for(const name of ['+ Feld zeichnen','Module entfernen','Foto verschieben']) {
    const mobilePan=name==='Foto verschieben' && info.project.name==='mobil';
    if(mobilePan) await page.getByRole('button',{name:'Mehr',exact:true}).click();
    const tool=page.getByRole('button',{name:mobilePan?'Ansicht verschieben':name,exact:true});
    await tool.click();
    if(mobilePan) await expect(page.getByLabel('Ansicht schrittweise verschieben')).toBeVisible();
    else await expect(tool).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('Escape');
    if(mobilePan) await expect(page.getByLabel('Ansicht schrittweise verschieben')).toHaveCount(0);
    else await expect(tool).toHaveAttribute('aria-pressed','false');
    await expect(page.getByRole('button',{name:'Auswählen',exact:true})).toHaveAttribute('aria-pressed','true');
  }
  expect(await felder(page)).toEqual(original);
});
test('Leichtes Zittern beim Klick verschiebt kein Feld', async ({ page }) => {
  const original=await felder(page);
  const p=await punkt(page,3.5,4);
  await page.mouse.move(p.x,p.y); await page.mouse.down();
  await page.mouse.move(p.x+2,p.y+1); await page.mouse.up();
  await expect(auswahl(page)).toBeVisible();
  expect(await felder(page)).toEqual(original);
});
test('Fensterverlust bricht Feldziehen ohne spätere Geisterbewegung ab', async ({ page }) => {
  const original=await felder(page);
  const p=await punkt(page,3.5,4);
  await page.mouse.move(p.x,p.y); await page.mouse.down();
  await page.mouse.move(p.x+40,p.y+20,{steps:4});
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  expect(await felder(page)).toEqual(original);
  await tippe(page,14.5,4); await expect(auswahl(page)).toBeVisible();
});

test('Auswahlwechsel, Gruppen, Ziehen und Rückgängig bleiben eindeutig', async ({ page }, info) => {
  const touch=info.project.name==='mobil';
  const original=await felder(page);
  await tippe(page,3.5,4,touch);
  await tippe(page,14.5,4,touch);
  await expect(auswahl(page)).toBeVisible();
  await page.getByRole('button',{name:'Alle auswählen',exact:true}).click();
  await expect(page.getByText('2 von 2 ausgewählt',{exact:true})).toBeVisible();
  const p=await punkt(page,3.5,4), q=await punkt(page,4.5,4);
  await page.mouse.move(p.x,p.y); await page.mouse.down();
  await page.mouse.move(q.x,q.y,{steps:5}); await page.mouse.up();
  const bewegt=await felder(page);
  expect(bewegt[0].xM).toBeGreaterThan(original[0].xM+.5);
  expect(bewegt[1].xM-bewegt[0].xM).toBeCloseTo(11,8);
  await page.getByRole('button',{name:/Rückgängig/}).click();
  expect(await felder(page)).toEqual(original);
  await tippe(page,3.5,4,touch);
  await page.getByRole('button',{name:'Bereich schließen',exact:true}).click();
  await expect(auswahl(page)).toHaveCount(0);
  await tippe(page,14.5,4,touch);
  await page.getByRole('button',{name:'Auswählen',exact:true}).click();
  await expect(auswahl(page)).toHaveCount(0);
});
test('Escape verwirft keine Texteingabe und kein halbfertiger Zug bleibt nach Abbruch hängen', async ({ page }) => {
  const original=await felder(page);
  const draw=page.getByRole('button',{name:'+ Feld zeichnen',exact:true});
  await draw.click();
  const p=await punkt(page,8,2), q=await punkt(page,11,6);
  await page.mouse.move(p.x,p.y); await page.mouse.down();
  await page.mouse.move(q.x,q.y,{steps:4}); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await felder(page)).toEqual(original);
  await page.getByRole('button',{name:'Dachdetails',exact:true}).click();
  const input=page.getByRole('spinbutton',{name:/^Traufe/}); await input.fill('19');
  await page.keyboard.press('Escape'); await expect(input).toHaveValue('19');
  expect(await felder(page)).toEqual(original);
});

test('Rechte Maustaste verändert weder Haltepfeile noch Perspektive', async ({ page }) => {
  const original=await felder(page);
  await tippe(page,3.5,4);
  await page.getByRole('button',{name:'nach rechts',exact:true}).click({button:'right'});
  expect(await felder(page)).toEqual(original);
  const perspektive=page.getByRole('button',{name:'Perspektive bearbeiten',exact:true}).filter({visible:true});
  if(!await perspektive.count()) await page.getByRole('button',{name:'Mehr',exact:true}).click();
  await perspektive.click();
  const ecke=page.getByRole('button',{name:'Perspektive Ecke 1',exact:true});
  const vorher=await ecke.getAttribute('cx');
  const b=(await ecke.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down({button:'right'});
  await page.mouse.move(b.x+b.width/2+30,b.y+b.height/2-20,{steps:4}); await page.mouse.up({button:'right'});
  await expect(ecke).toHaveAttribute('cx',vorher!);
});

test('Zweifingergeste auf freiem Foto erhält die Feldauswahl', async ({ page }) => {
  await tippe(page,3.5,4);
  const original=await felder(page);
  const svg=page.getByRole('img',{name:/^Belegungsfläche/});
  const vor=await page.getByTestId('editor-bild-transform').getAttribute('style');
  const p=await punkt(page,9,4);
  // Gleicher Pointerpfad auch für WebKit ohne CDP-Multitouch.
  await svg.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:81,clientX:p.x,clientY:p.y,button:0,bubbles:true});
  await svg.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:82,clientX:p.x+30,clientY:p.y,button:0,bubbles:true});
  await svg.dispatchEvent('pointermove',{pointerType:'touch',pointerId:82,clientX:p.x+60,clientY:p.y,button:-1,bubbles:true});
  await svg.dispatchEvent('pointerup',{pointerType:'touch',pointerId:82,clientX:p.x+60,clientY:p.y,button:0,bubbles:true});
  await svg.dispatchEvent('pointerup',{pointerType:'touch',pointerId:81,clientX:p.x,clientY:p.y,button:0,bubbles:true});
  await expect(page.getByTestId('editor-bild-transform')).not.toHaveAttribute('style',vor!);
  await expect(auswahl(page)).toBeVisible();
  expect(await felder(page)).toEqual(original);
});
