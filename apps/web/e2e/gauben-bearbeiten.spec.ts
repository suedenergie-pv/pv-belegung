import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { oeffneStartprojekt } from './projekt-einstieg';
import { neuesProjekt, type Projekt } from '../lib/model';

const speicherKey = process.env.PV_PROJECT_STORAGE_KEY ?? 'pv-belegung-projekte-v2';

async function gespeichert(page: Page): Promise<Projekt> {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(key => { const db = JSON.parse(localStorage.getItem(key)!); return db.projekte.find((p: {id:string}) => p.id === db.aktivId).projekt; }, speicherKey);
}
async function tippe(page: Page, knopf: Locator) {
  await knopf.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await knopf.tap();
  else await knopf.click();
}
async function fotoPunkt(page: Page, x: number, y: number, touch: boolean) {
  const svg = page.getByRole('img', { name: /im (?:Dach)?foto markieren/i });
  if (!touch) { const b = (await svg.boundingBox())!; await svg.click({position:{x:b.width*x,y:b.height*y}}); return; }
  await bewegeKreuz(page, x, y);
  await tippe(page, page.getByRole('button', {name:'Punkt setzen',exact:true}));
}
async function bewegeKreuz(page: Page, x: number, y: number) {
  const k = page.getByTestId('foto-fadenkreuz');
  const vorher = [Number(await k.getAttribute('data-x')), Number(await k.getAttribute('data-y'))];
  const d = await page.locator('[data-punkt-steuerung] svg[role=img]').evaluate((el, { x, y, vorher }) => {
    const s = el as SVGSVGElement, m = s.getScreenCTM()!, w = s.viewBox.baseVal.width, h = s.viewBox.baseVal.height;
    return { x: m.a * (x * w - vorher[0]!) + m.c * (y * h - vorher[1]!), y: m.b * (x * w - vorher[0]!) + m.d * (y * h - vorher[1]!), w, h };
  }, { x, y, vorher });
  const v = (await page.getByTestId('editor-viewport').boundingBox())!;
  const start = { x: v.x + v.width / 2 - d.x / 2, y: v.y + v.height / 2 - d.y / 2 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + d.x * i / 6, y: start.y + d.y * i / 6, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
  await expect.poll(async () => Math.hypot(Number(await k.getAttribute('data-x')) - x * d.w, Number(await k.getAttribute('data-y')) - y * d.h)).toBeLessThan(2);
}
async function punkte(page: Page) {
  return page.getByRole('button',{name:/^Gaubenpunkt /}).evaluateAll(els=>els.map(e=>[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))]));
}
async function imFenster(page: Page, name: string) {
  const b=page.getByRole('button',{name,exact:true}); await expect(b).toBeInViewport({ratio:.99});
  const r=(await b.boundingBox())!; expect(r.height).toBeGreaterThanOrEqual(44);
  expect(await b.evaluate(e=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
}

test('Gaube: Gruppe bewegen, Form korrigieren, Seitenmaße, Kopie, Historie und Reload', async ({page}, info)=>{
  test.setTimeout(120_000); page.setDefaultTimeout(12_000);
  const touch=!!info.project.use.hasTouch;
  const out=resolve(process.env.PV_QA_SHOTS ?? '.release/gauben-bearbeiten/screenshots'); mkdirSync(out,{recursive:true});
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const shot=async(name:string)=>page.screenshot({path:resolve(out,`${info.project.name}-${name}.png`)});
  // Geprüftes Hauptdach als Ausgangspunkt. Der vollständige Gaubenablauf folgt in der UI.
  // Synthetische Geometrie-Fixierung; echte Dachfotos werden separat in gauben-realfoto geprüft.
  const projekt = neuesProjekt();
  projekt.kunde = 'Gaubenbearbeitung · kontrollierte Testgeometrie';
  projekt.fotos = [{ id: 'foto', name: 'QA-Hauptdach', breitePx: 1600, hoehePx: 900,
    dataUrl: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#956952"/><path d="M0 300H1600M0 600H1600M400 0V900M800 0V900M1200 0V900" stroke="#785541" stroke-width="4"/></svg>').toString('base64') }];
  Object.assign(projekt.flaechen[0]!, { breiteM: 18, hoeheM: 8, massStatus: 'bestaetigt', grunddatenFertig: true,
    fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[0, 900], [1600, 900], [1600, 0], [0, 0]], perspektiveBestaetigt: true, markierungFertig: true }] });
  await page.addInitScript(({ projekt, key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key.replace('-v2', '-v1'), JSON.stringify({ aktivId: 'gauben-bearbeiten-qa', workflowVersion: 2, projekte: [{ id: 'gauben-bearbeiten-qa', projekt, schritt: 1, erstelltAm: Date.now(), geaendertAm: Date.now() }] }));
  }, { projekt, key: speicherKey });
  await page.goto('./'); await oeffneStartprojekt(page);
  const gauben=page.getByRole('group',{name:'Dach bearbeiten'}).getByRole('button',{name:'Gauben',exact:true});
  await tippe(page, gauben);
  await tippe(page, page.getByRole('button',{name:'Zwei Dachseiten',exact:true}));
  await tippe(page, page.getByRole('button',{name:'Aufmaß vorhanden',exact:true}));
  await page.getByLabel('Breite der belegbaren Fläche').fill('3'); await page.getByLabel('Tiefe auf dem Gaubendach').fill('2.5');
  await imFenster(page,'Im Foto markieren →'); await tippe(page, page.getByRole('button',{name:'Im Foto markieren →',exact:true}));
  for(const[x,y]of[[.3,.75],[.7,.75],[.7,.35],[.3,.35],[.5,.3],[.5,.8]])await fotoPunkt(page,x!,y!,touch);
  await imFenster(page,'Gaube anlegen & fertig');
  await tippe(page, page.getByRole('button',{name:'Gaube anlegen & fertig',exact:true}));
  await expect(page.getByText(/1 Gaube angelegt/)).toBeVisible(); await shot('01-uebersicht');
  const original=await gespeichert(page), parent=original.flaechen[0]!, children=original.flaechen.filter(f=>f.gaubenTyp);
  const gruppeId=children[0]!.gaubenGruppeId!;
  const card=()=>page.locator(`[data-gaubengruppe="${gruppeId}"]`);
  await tippe(page, card().getByRole('button',{name:'Position ändern',exact:true}));
  await imFenster(page,'Änderungen übernehmen');
  await expect(page.getByRole('button',{name:'Flach / leicht geneigt',exact:true})).toHaveCount(0);
  const vorher=await punkte(page);
  if(touch){await bewegeKreuz(page,.5,.55);await tippe(page, page.getByRole('button',{name:'Gaube greifen',exact:true}));await bewegeKreuz(page,.53,.57);await tippe(page, page.getByRole('button',{name:'Gaube hier ablegen',exact:true}));}
  else {const b=(await page.getByRole('img',{name:'Gaube im Dachfoto markieren',exact:true}).boundingBox())!;await page.mouse.move(b.x+b.width*.4,b.y+b.height*.55);await page.mouse.down();await page.mouse.move(b.x+b.width*.43,b.y+b.height*.57,{steps:7});await page.mouse.up();}
  const nachher=await punkte(page), dx=nachher[0]![0]!-vorher[0]![0]!,dy=nachher[0]![1]!-vorher[0]![1]!;
  expect(Math.abs(dx)).toBeGreaterThan(1);
  nachher.forEach((p,i)=>{expect(p[0]!-vorher[i]![0]!).toBeCloseTo(dx,5);expect(p[1]!-vorher[i]![1]!).toBeCloseTo(dy,5);});
  await shot('02-verschieben'); await tippe(page, page.getByRole('button',{name:'Änderungen übernehmen',exact:true}));
  const aufgaben=page.getByRole('group',{name:'Gaube bearbeiten',exact:true});
  await expect(aufgaben.getByRole('button',{name:'Verschieben',exact:true})).toHaveAttribute('aria-pressed','true');
  const moved=await gespeichert(page);
  children.forEach(f=>{const neu=moved.flaechen.find(x=>x.id===f.id)!;expect(neu.felder).toEqual(f.felder);expect([neu.breiteM,neu.hoeheM]).toEqual([f.breiteM,f.hoeheM]);});
  expect(moved.flaechen[0]!.gaubenAussparungen![0]!.rechteck).not.toEqual(parent.gaubenAussparungen![0]!.rechteck);
  await tippe(page, page.getByRole('button',{name:/Rückgängig/}));
  expect((await gespeichert(page)).flaechen).toEqual(original.flaechen);
  await expect.poll(() => punkte(page)).toEqual(vorher);
  await tippe(page, page.getByRole('button',{name:/Wiederherstellen/}));
  expect((await gespeichert(page)).flaechen).toEqual(moved.flaechen);
  await expect.poll(() => punkte(page)).toEqual(nachher);
  await tippe(page, aufgaben.getByRole('button',{name:'Umriss',exact:true}));
  const formVorher=await punkte(page);
  await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('first:0');
  await tippe(page, page.getByRole('button',{name:'First nach rechts',exact:true}));
  const first=await punkte(page);expect(first.slice(0,4)).toEqual(formVorher.slice(0,4));
  expect(first[4]![0]).toBeCloseTo(formVorher[4]![0]!+1,5);expect(first[5]![0]).toBeCloseTo(formVorher[5]![0]!+1,5);
  await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('kante:0');
  await tippe(page, page.getByRole('button',{name:'Kante nach unten',exact:true}));
  const kante=await punkte(page); expect(kante[0]![1]).toBeCloseTo(first[0]![1]!+1,5);expect(kante[1]![1]).toBeCloseTo(first[1]![1]!+1,5);expect(kante.slice(2)).toEqual(first.slice(2));
  await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('punkt:0');
  await tippe(page, page.getByRole('button',{name:'Ecke nach links',exact:true}));
  expect((await punkte(page)).slice(1)).toEqual(kante.slice(1));
  await page.getByLabel('Module im Foto anzeigen').uncheck();await shot('03-form');
  if (!touch) {
    await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('first:0');
    const svg=page.getByRole('img',{name:'Gaube im Dachfoto markieren',exact:true});
    for(let i=0;i<40;i++)await svg.press('Shift+ArrowRight');
    await expect(page.getByRole('button',{name:'Änderungen übernehmen',exact:true})).toBeDisabled();
    await expect(page.getByRole('alert').filter({hasText:/First|Gaubenseiten|überlapp/})).toBeVisible();
    await shot('03b-ungueltiger-first');
  }
  await tippe(page, page.getByRole('button',{name:'Änderungen verwerfen',exact:true}));
  expect((await gespeichert(page)).flaechen).toEqual(moved.flaechen);
  await tippe(page, aufgaben.getByRole('button',{name:'Maße & Neigung',exact:true}));
  await tippe(page, page.getByRole('group',{name:'Dachseite der Gaube',exact:true}).getByRole('button',{name:'Rechte Dachseite',exact:true}));
  await page.getByLabel(/^Breite/).fill('3.2');await imFenster(page,'Maße übernehmen');
  await expect.poll(async()=>{const input=(await page.getByLabel(/^Breite/).boundingBox())!,footer=(await page.locator('[data-gauben-mass-abschluss]').boundingBox())!;return input.y+input.height-footer.y;}).toBeLessThanOrEqual(1);
  await shot('04-masse');
  await tippe(page, page.getByRole('button',{name:'Maße übernehmen',exact:true}));
  await expect(aufgaben.getByRole('button',{name:'Maße & Neigung',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel(/^Breite/)).toHaveValue('3.2');
  const mass=await gespeichert(page);expect(mass.flaechen.find(f=>f.gaubenSeite==='links')!.breiteM).toBe(3);expect(mass.flaechen.find(f=>f.gaubenSeite==='rechts')!.breiteM).toBe(3.2);
  await tippe(page, page.getByRole('button',{name:'← Alle Gauben',exact:true}));
  await tippe(page, card().getByRole('button',{name:'Gaube kopieren',exact:true}));
  await expect(page.getByRole('button',{name:/^Gaubenpunkt /})).toHaveCount(6);await imFenster(page,'Gaubenkopie anlegen');await shot('05-kopie');
  await tippe(page, page.getByRole('button',{name:'Gaubenkopie anlegen',exact:true}));
  const kopie=await gespeichert(page);expect(kopie.flaechen.filter(f=>f.gaubenTyp)).toHaveLength(4);
  expect(kopie.flaechen.filter(f=>f.gaubenTyp&&f.gaubenGruppeId!==gruppeId).map(f=>f.breiteM)).toEqual([3,3.2]);
  await tippe(page, card().getByRole('button',{name:'Rechte Module bearbeiten',exact:true}));
  await expect(page.getByRole('group',{name:'Gaubendachseiten'}).or(page.locator('[aria-label="Gaubendachseiten"]'))).toBeVisible();
  await tippe(page, page.getByRole('button',{name:'Linke Dachseite',exact:true}));await tippe(page, page.getByRole('button',{name:'Rechte Dachseite',exact:true}));
  await shot('06-module');
  await page.reload();expect((await gespeichert(page)).flaechen).toEqual(kopie.flaechen);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(errors).toEqual([]);
});
