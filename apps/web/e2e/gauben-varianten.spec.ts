import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { neuesProjekt, type Projekt } from '../lib/model';
import { oeffneStartprojekt } from './projekt-einstieg';
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

async function stand(page:Page):Promise<Projekt>{
 await page.waitForTimeout(700);
 return page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);return db.projekte.find((x:{id:string})=>x.id===db.aktivId).projekt});
}
for(const [typ,label] of [['flachdach','Flachdachgaube · Stehfalz'],['schleppdach','Schleppgaube'],['walmdach','Walmgaube · Dachseite'],['spitzdach','Spitzgaube · Dachseite']] as const){
 test(typ+': anlegen, eigene Winkel, Kontur, Kopie und Reload',async({page},info)=>{
  test.setTimeout(100000);page.setDefaultTimeout(12000);
  const out=resolve(process.env.PV_QA_SHOTS??'output/gauben-varianten');mkdirSync(out,{recursive:true});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const p=neuesProjekt();p.fotos=[{id:'foto',name:'Gaubendach',breitePx:1600,hoehePx:900,dataUrl:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#956952"/><path d="M0 300H1600M0 600H1600M400 0V900M800 0V900M1200 0V900" stroke="#785541" stroke-width="4"/></svg>').toString('base64')}];
  Object.assign(p.flaechen[0]!,{breiteM:16,hoeheM:9,massStatus:'bestaetigt',grunddatenFertig:true,fotoZuordnungen:[{fotoId:'foto',traufePx:null,eckenPx:[[0,900],[1600,900],[1600,0],[0,0]],perspektiveBestaetigt:true,markierungFertig:true}]});
  await page.addInitScript(p=>{if(!localStorage.getItem('pv-belegung-projekte-v2'))localStorage.setItem('pv-belegung-projekte-v1',JSON.stringify({aktivId:'qa',workflowVersion:2,projekte:[{id:'qa',projekt:p,schritt:1,erstelltAm:Date.now(),geaendertAm:Date.now()}]}))},p);
  const b=(name:string)=>page.getByRole('button',{name,exact:true});
  await page.goto('./');await oeffneStartprojekt(page);
  await page.getByRole('group',{name:'Dach bearbeiten'}).getByRole('button',{name:'Gauben',exact:true}).click();
  await b(label).click();await b('Aufmaß vorhanden').click();
  await page.getByLabel('Breite der belegbaren Fläche').fill('6');await page.getByLabel('Länge Traufe bis First').fill('4');
  if(typ==='walmdach')await page.getByLabel('Obere Breite der Dachseite').fill('3');
  await b('Im Foto markieren →').click();
  for(const [x,y] of [[.2,.8],[.7,.8],[.7,.2],[.2,.2]])await fotoPunkt(page,x!,y!,info.project.name!=='desktop');
  await page.screenshot({path:resolve(out,info.project.name+'-'+typ+'-markierung.png')});
  await b('Gaube anlegen & fertig').click();
  const vorher=await stand(page);const f=vorher.flaechen.find(f=>f.gaubenTyp)!;expect(f.gaubenTyp).toBe(typ);expect(f.art).toBe('dach');expect(f.flachdach).toBeUndefined();
  if(typ==='walmdach'||typ==='spitzdach'){expect(f.fotoBezugsrahmen).toBe(true);expect(f.firstBreiteM).toBe(typ==='spitzdach'?0:3)}
  const card=page.locator('[data-gaubengruppe]').first();
  await card.getByRole('button',{name:'Dachmaße ändern',exact:true}).click();
  await page.getByLabel(/^Neigung der Gaubenseite/).fill('90');await expect(b('Maße übernehmen')).toBeDisabled();
  await page.getByLabel(/^Neigung der Gaubenseite/).fill('42,5');await page.getByLabel(/^Ausrichtung der Gaubenseite/).fill('135');
  await b('Maße übernehmen').click();
  await card.getByRole('button',{name:'Gaube kopieren',exact:true}).click();
  await b('Gaubenkopie anlegen').click();
  const neu=await stand(page);const kinder=neu.flaechen.filter(f=>f.gaubenTyp);
  expect(kinder).toHaveLength(2);expect(kinder.map(f=>f.neigungDeg)).toEqual([42.5,42.5]);expect(kinder.map(f=>f.azimutDeg)).toEqual([135,135]);
  expect(kinder.map(f=>f.gaubenMessung?.qualitaet)).toEqual(['bestaetigt','bestaetigt']);
  expect(neu.flaechen[0]!.gaubenAussparungen).toHaveLength(2);
  await page.screenshot({path:resolve(out,info.project.name+'-'+typ+'-fertig.png')});
  await page.reload();expect((await stand(page)).flaechen.filter(f=>f.gaubenTyp)).toEqual(kinder);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
