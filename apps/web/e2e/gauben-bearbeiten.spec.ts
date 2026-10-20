import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { oeffneStartprojekt } from './projekt-einstieg';
import type { Projekt } from '../lib/model';

async function gespeichert(page: Page): Promise<Projekt> {
  await expect(page.getByRole('status').filter({ hasText: 'In diesem Browser gespeichert' })).toBeVisible();
  return page.evaluate(() => { const db = JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!); return db.projekte.find((p: {id:string}) => p.id === db.aktivId).projekt; });
}
async function fotoPunkt(page: Page, x: number, y: number, touch: boolean) {
  const svg = page.getByRole('img', { name: /im (?:Dach)?foto markieren/i });
  if (!touch) { const b = (await svg.boundingBox())!; await svg.click({position:{x:b.width*x,y:b.height*y}}); return; }
  await bewegeKreuz(page, x, y);
  await page.getByRole('button', {name:'Punkt setzen',exact:true}).click();
}
async function bewegeKreuz(page: Page, x: number, y: number) {
  const k = page.getByTestId('foto-fadenkreuz');
  const vorher = [Number(await k.getAttribute('data-x')), Number(await k.getAttribute('data-y'))];
  const foto = await page.locator('[data-punkt-steuerung] svg[role=img]').evaluate(el=>{
    const s=el as SVGSVGElement, b=s.getBoundingClientRect(); return {w:s.viewBox.baseVal.width,h:s.viewBox.baseVal.height,width:b.width,height:b.height};
  });
  const dx=(x*foto.w-vorher[0]!)/foto.w*foto.width, dy=(y*foto.h-vorher[1]!)/foto.h*foto.height;
  await page.getByTestId('editor-viewport').evaluate((el,{dx,dy})=>{
    const b=el.getBoundingClientRect(), start={x:b.x+b.width/2-dx/2,y:b.y+b.height/2-dy/2};
    const send=(type:string,x:number,y:number)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:17,clientX:x,clientY:y}));
    send('pointerdown',start.x,start.y);
    for(let i=1;i<=5;i++)send('pointermove',start.x+dx*i/5,start.y+dy*i/5);
    send('pointerup',start.x+dx,start.y+dy);
  },{dx,dy});
  await expect.poll(async()=>Math.abs(Number(await k.getAttribute('data-x'))/foto.w-x)).toBeLessThan(.012);
}
async function punkte(page: Page) {
  return page.getByRole('button',{name:/^Gaubenpunkt /}).evaluateAll(els=>els.map(e=>[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))]));
}
async function imFenster(page: Page, name: string) {
  const b=page.getByRole('button',{name,exact:true}); await expect(b).toBeInViewport({ratio:1});
  const r=(await b.boundingBox())!; expect(r.height).toBeGreaterThanOrEqual(44);
  expect(await b.evaluate(e=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
}

test('Gaube: Gruppe bewegen, Form korrigieren, Seitenmaße, Kopie, Historie und Reload', async ({page}, info)=>{
  test.setTimeout(120_000); page.setDefaultTimeout(12_000);
  const touch=!!info.project.use.hasTouch;
  const out=resolve(process.env.PV_QA_SHOTS ?? '.debug-shots/gauben-bearbeitung-2026-10-20'); mkdirSync(out,{recursive:true});
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const shot=async(name:string)=>page.screenshot({path:resolve(out,`${info.project.name}-${name}.png`)});
  await page.goto('./'); await oeffneStartprojekt(page);
  await page.getByRole('button',{name:'2. Dach & Belegung',exact:true}).click();
  await page.getByRole('button',{name:'Dachmaße',exact:true}).click();
  await page.getByLabel(/^Traufe/).fill('18'); await page.getByLabel(/^Sparrenlänge/).fill('8');
  await page.getByRole('button',{name:'Maße übernehmen',exact:true}).click();
  const file=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'Foto hinzufügen',exact:true}).click();
  const png=process.env.PV_QA_PHOTO ? null : await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const g=c.getContext('2d')!;g.fillStyle='#b66e4f';g.fillRect(0,0,1600,900);g.strokeStyle='#783e2e';for(let x=0;x<1600;x+=40){g.beginPath();g.moveTo(x,0);g.lineTo(x,900);g.stroke();}return c.toDataURL('image/png').split(',')[1]!;});
  await (await file).setFiles(process.env.PV_QA_PHOTO ?? {name:'testdach.png',mimeType:'image/png',buffer:Buffer.from(png!,'base64')});
  await page.getByRole('button',{name:/Überspringen \(/}).click();
  for(const [x,y]of[[.04,.9],[.945,.9],[.945,.17],[.04,.15]])await fotoPunkt(page,x!,y!,touch);
  await page.getByRole('button',{name:'4 Ecken übernehmen',exact:true}).click();
  await page.getByRole('button',{name:'Keine Aussparungen – weiter',exact:true}).click();
  const gauben=page.getByRole('group',{name:'Dach bearbeiten'}).getByRole('button',{name:'Gauben',exact:true});
  await gauben.click();
  await page.getByRole('button',{name:'Satteldachgaube',exact:true}).click();
  await page.getByRole('button',{name:'Aufmaß vorhanden',exact:true}).click();
  await page.getByLabel('Breite der belegbaren Fläche').fill('3'); await page.getByLabel('Länge Traufe bis First').fill('2.5');
  await imFenster(page,'Im Foto markieren →'); await page.getByRole('button',{name:'Im Foto markieren →',exact:true}).click();
  for(const[x,y]of[[.3,.75],[.7,.75],[.7,.35],[.3,.35],[.5,.3],[.5,.8]])await fotoPunkt(page,x!,y!,touch);
  await imFenster(page,'Gaube anlegen & fertig');
  await page.getByRole('button',{name:'Gaube anlegen & fertig',exact:true}).click();
  await expect(page.getByText(/1 Gaube angelegt/)).toBeVisible(); await shot('01-uebersicht');
  const original=await gespeichert(page), parent=original.flaechen[0]!, children=original.flaechen.filter(f=>f.gaubenTyp);
  const gruppeId=children[0]!.gaubenGruppeId!;
  const card=()=>page.locator(`[data-gaubengruppe="${gruppeId}"]`);
  await card().getByRole('button',{name:'Position ändern',exact:true}).click();
  await imFenster(page,'Änderungen übernehmen');
  await expect(page.getByRole('button',{name:'Flachdachgaube · Stehfalz',exact:true})).toHaveCount(0);
  const vorher=await punkte(page);
  if(touch){await bewegeKreuz(page,.5,.55);await page.getByRole('button',{name:'Gaube greifen',exact:true}).click();await bewegeKreuz(page,.53,.57);await page.getByRole('button',{name:'Gaube hier ablegen',exact:true}).click();}
  else {const b=(await page.getByRole('img',{name:'Gaube im Dachfoto markieren',exact:true}).boundingBox())!;await page.mouse.move(b.x+b.width*.4,b.y+b.height*.55);await page.mouse.down();await page.mouse.move(b.x+b.width*.43,b.y+b.height*.57,{steps:7});await page.mouse.up();}
  const nachher=await punkte(page), dx=nachher[0]![0]!-vorher[0]![0]!,dy=nachher[0]![1]!-vorher[0]![1]!;
  expect(Math.abs(dx)).toBeGreaterThan(1);
  nachher.forEach((p,i)=>{expect(p[0]!-vorher[i]![0]!).toBeCloseTo(dx,5);expect(p[1]!-vorher[i]![1]!).toBeCloseTo(dy,5);});
  await shot('02-verschieben'); await page.getByRole('button',{name:'Änderungen übernehmen',exact:true}).click();
  const moved=await gespeichert(page);
  children.forEach(f=>{const neu=moved.flaechen.find(x=>x.id===f.id)!;expect(neu.felder).toEqual(f.felder);expect([neu.breiteM,neu.hoeheM]).toEqual([f.breiteM,f.hoeheM]);});
  expect(moved.flaechen[0]!.gaubenAussparungen![0]!.rechteck).not.toEqual(parent.gaubenAussparungen![0]!.rechteck);
  await page.getByRole('button',{name:/Rückgängig/}).click();
  expect((await gespeichert(page)).flaechen).toEqual(original.flaechen);
  await page.getByRole('button',{name:/Wiederherstellen/}).click();
  expect((await gespeichert(page)).flaechen).toEqual(moved.flaechen);
  await card().getByRole('button',{name:'Form korrigieren',exact:true}).click();
  const formVorher=await punkte(page);
  await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('first:0');
  await page.getByRole('button',{name:'First nach rechts',exact:true}).click();
  const first=await punkte(page);expect(first.slice(0,4)).toEqual(formVorher.slice(0,4));
  expect(first[4]![0]).toBeCloseTo(formVorher[4]![0]!+1,5);expect(first[5]![0]).toBeCloseTo(formVorher[5]![0]!+1,5);
  await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('kante:0');
  await page.getByRole('button',{name:'Kante nach unten',exact:true}).click();
  const kante=await punkte(page); expect(kante[0]![1]).toBeCloseTo(first[0]![1]!+1,5);expect(kante[1]![1]).toBeCloseTo(first[1]![1]!+1,5);expect(kante.slice(2)).toEqual(first.slice(2));
  await page.getByRole('combobox',{name:'Gaubenelement'}).selectOption('punkt:0');
  await page.getByRole('button',{name:'Ecke nach links',exact:true}).click();
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
  await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
  expect((await gespeichert(page)).flaechen).toEqual(moved.flaechen);
  await card().getByRole('button',{name:'Rechte Dachmaße ändern',exact:true}).click();
  await page.getByLabel(/^Breite/).fill('3.2');await imFenster(page,'Maße übernehmen');
  await expect.poll(async()=>{const input=(await page.getByLabel(/^Breite/).boundingBox())!,footer=(await page.locator('[data-gauben-mass-abschluss]').boundingBox())!;return input.y+input.height-footer.y;}).toBeLessThanOrEqual(1);
  await shot('04-masse');
  await page.getByRole('button',{name:'Maße übernehmen',exact:true}).click();
  const mass=await gespeichert(page);expect(mass.flaechen.find(f=>f.gaubenSeite==='links')!.breiteM).toBe(3);expect(mass.flaechen.find(f=>f.gaubenSeite==='rechts')!.breiteM).toBe(3.2);
  await card().getByRole('button',{name:'Gaube kopieren',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Gaubenpunkt /})).toHaveCount(6);await imFenster(page,'Gaubenkopie anlegen');await shot('05-kopie');
  await page.getByRole('button',{name:'Gaubenkopie anlegen',exact:true}).click();
  const kopie=await gespeichert(page);expect(kopie.flaechen.filter(f=>f.gaubenTyp)).toHaveLength(4);
  expect(kopie.flaechen.filter(f=>f.gaubenTyp&&f.gaubenGruppeId!==gruppeId).map(f=>f.breiteM)).toEqual([3,3.2]);
  await card().getByRole('button',{name:'Rechte Module bearbeiten',exact:true}).click();
  await expect(page.getByRole('group',{name:'Gaubendachseiten'}).or(page.locator('[aria-label="Gaubendachseiten"]'))).toBeVisible();
  await page.getByRole('button',{name:'Linke Dachseite',exact:true}).click();await page.getByRole('button',{name:'Rechte Dachseite',exact:true}).click();
  await shot('06-module');
  await page.reload();expect((await gespeichert(page)).flaechen).toEqual(kopie.flaechen);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(errors).toEqual([]);
});
