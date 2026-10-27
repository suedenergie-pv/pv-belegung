import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { oeffneStartprojekt } from './projekt-einstieg';
import { aktiveModule, rasterFuer, modulById, type Projekt } from '../lib/model';
import { homographie, projiziere, type Punkt } from '../lib/foto-geometrie';

// Nur lokale QA: externe echte Aufnahmen aus PV_REALROOF_DIR. Keine ausgelieferten Demoassets.
// Deckmaße sind explizite Testannahmen, KEIN vermessenes Aufmaß dieses Gebäudes.
const fotoDir = process.env.PV_REALROOF_DIR;
const out=resolve('.release/echte-daecher/neuer-ablauf');
const pentagon={name:'Dachseite mit fünf Ecken',azimut:180,rand:[[279,776],[873,475],[910,172],[811,133],[469,244]],grid:[[710,490.92],[793.25,449.12],[661,237.13],[576.25,268.15]],spalten:5,reihen:10};
const fixtures=[
 {id:'tapio',file:'tapio-bourgoin.jpg',w:1500,h:844,breite:30,laenge:33,faces:[pentagon]},
 {id:'erlus',file:'erlus-monaco.jpg',w:1600,h:1200,breite:19.9,laenge:34,faces:[
  {name:'Pyramide · Südseite',azimut:180,rand:[[1238,1790],[2390,1795],[1842,1230]],grid:[[1680,1752],[1974,1758],[1988,1491],[1688,1490]],spalten:10,reihen:6},
  {name:'Pyramide · Westseite mit Kamin',azimut:270,rand:[[1230,650],[1238,1790],[1842,1230]],grid:[[1270,1088],[1270,1373],[1556,1384],[1556,1095]],spalten:10,reihen:6},
  {name:'Pyramide · Ostseite',azimut:90,rand:[[2390,1795],[2395,644],[1842,1230]],grid:[[2353,1390],[2353,1094],[2097,1100],[2097,1401]],spalten:10,reihen:6},
  {name:'Pyramide · Nordseite',azimut:0,rand:[[2395,644],[1230,650],[1842,1230]],grid:[[1967,720],[1664,718],[1652,1001],[1958,1004]],spalten:10,reihen:6},
  {name:'Anbau · rechteckige Dachseite',azimut:225,rand:[[1212,673],[634,675],[557,1188],[1212,1188]],grid:[[1038,793],[759,795],[739,1054],[1023,1052]],spalten:10,reihen:6},
 ].map(f=>({...f,rand:f.rand.map(p=>p.map(n=>n*1600/2880)),grid:f.grid.map(p=>p.map(n=>n*1600/2880))}))}

];
async function stand(page:Page):Promise<Projekt>{
 await expect(page.getByRole('status').filter({hasText:'In diesem Browser gespeichert'})).toBeVisible();
 return page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);return db.projekte.find((p:{id:string})=>p.id===db.aktivId).projekt;});
}
async function punkt(page:Page,p:number[],aussparung=false){
 const svg=page.getByRole('img',{name:aussparung ? /im Foto markieren/ : 'Dachrand und Ziegel im Foto markieren'});
 const q=await svg.evaluate((el,p)=>{const m=(el as SVGSVGElement).getScreenCTM()!;const v=new DOMPoint(p[0],p[1]).matrixTransform(m);return{x:v.x,y:v.y};},p);
 if(await page.evaluate(()=>navigator.maxTouchPoints>0)){
  const k=page.getByTestId('foto-fadenkreuz');
  const xy=[Number(await k.getAttribute('data-x')),Number(await k.getAttribute('data-y'))];
  const d=await svg.evaluate((el,a)=>{const m=(el as SVGSVGElement).getScreenCTM()!;return{x:m.a*(a.p[0]!-a.xy[0]!)+m.c*(a.p[1]!-a.xy[1]!),y:m.b*(a.p[0]!-a.xy[0]!)+m.d*(a.p[1]!-a.xy[1]!) };},{p,xy});
  const v=(await page.getByTestId('editor-viewport').boundingBox())!;
  const start={x:v.x+v.width/2-d.x/2,y:v.y+v.height/2-d.y/2};
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+d.x*i/5,y:start.y+d.y*i/5,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  const b=page.getByRole('button',{name:/^(Dachecke|Ziegelpunkt|Punkt) setzen$/});await expect(b).toBeInViewport({ratio:1});const r=(await b.boundingBox())!;await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
 }else await page.mouse.click(q.x,q.y);
}
async function aktion(page:Page,name:string){
 const b=page.getByRole('button',{name,exact:true});await expect(b).toBeInViewport({ratio:1});
 expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);await b.click();
}
for(const fixture of fixtures)for(const winkel of [0,90,180,270])test(`${fixture.id} · Echter Dachrand, Ziegelraster und Reload · Foto ${winkel}°`,async({page},info)=>{
 test.skip(!fotoDir,'PV_REALROOF_DIR mit lokaler echter Dachaufnahme angeben.');
 test.setTimeout(120000);page.setDefaultTimeout(12000);mkdirSync(out,{recursive:true});
 const fehler:string[]=[];page.on('pageerror',e=>fehler.push(e.message));
 await page.goto('./');await oeffneStartprojekt(page);await page.getByLabel(/^Kunde/).fill('Echtes Dachfoto · Maße und Richtung sind Testannahmen');
 await page.getByRole('button',{name:'2. Dach & Belegung',exact:true}).click();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Foto hochladen',exact:true}).click();
 const bytes=await sharp(readFileSync(resolve(fotoDir!,fixture.file))).resize({width:fixture.w}).rotate(winkel).jpeg().toBuffer();
 await(await chooser).setFiles({name:fixture.id+'-QA.jpg',mimeType:'image/jpeg',buffer:bytes});
 const rot=([x,y]:number[])=>winkel===90?[fixture.h-y!,x!]:winkel===180?[fixture.w-x!,fixture.h-y!]:winkel===270?[y!,fixture.w-x!]:[x!,y!];
 const faces=fixture.faces;
 for(const [idx,f]of faces.entries()){
  const nachbarn=(await stand(page)).flaechen.slice(0,idx);
  if(idx)await page.getByLabel('Aktive Dachfläche').selectOption('auf-foto');
  await page.getByRole('button',{name:'Alles anzeigen',exact:true}).click();
  await page.getByRole('button',{name:'Dachrand nachzeichnen',exact:true}).click();
  await page.getByLabel('Name der Fläche',{exact:true}).fill(f.name);
  await page.getByText('Neigung und Himmelsrichtung',{exact:true}).click();
  await page.getByRole('combobox',{name:'Ausrichtung',exact:true}).selectOption(String(f.azimut));
  await page.getByText('Neigung und Himmelsrichtung',{exact:true}).click();
  const fokus=page.getByRole('button',{name:'Bild vergrößern',exact:true});
  if(await fokus.isVisible()) {await fokus.click();await expect(page.getByRole('button',{name:'Eingaben anzeigen',exact:true})).toBeVisible();}
  for(const p of f.rand)await punkt(page,rot(p));
  await page.screenshot({path:resolve(out,`${fixture.id}-${info.project.name}-${winkel}-${idx}-dachrand.png`)});
  await aktion(page,'Dachrand fertig – weiter');
  await expect(page.getByLabel('Deckbreite (cm)',{exact:true})).toHaveValue('');
  if(await fokus.isVisible())await fokus.click();
  if(info.project.name==='mobil' && winkel===0 && fixture.id==='tapio')for(let z=0;z<4;z++)await page.getByRole('button',{name:'Vergrößern',exact:true}).click();
  for(const p of f.grid)await punkt(page,rot(p));
  await page.screenshot({path:resolve(out,`${fixture.id}-${info.project.name}-${winkel}-${idx}-ziegel-fokus.png`)});
  const eingaben=page.getByRole('button',{name:'Eingaben anzeigen',exact:true});if(await eingaben.isVisible())await eingaben.click();
  for(const [label,value]of [['Abstände quer',f.spalten],['Reihen nach oben',f.reihen],['Deckbreite (cm)',fixture.breite],['Decklänge (cm)',fixture.laenge]]as const)await page.getByLabel(label,{exact:true}).fill(String(value));
  await page.screenshot({path:resolve(out,`${fixture.id}-${info.project.name}-${winkel}-${idx}-ziegelraster.png`)});
  await aktion(page,'Dachmaße prüfen');await expect(page.getByRole('button',{name:'Dachfläche übernehmen',exact:true})).toBeDisabled();
  await page.getByLabel('Deckmaße geprüft; Ziegelfeld und Dachrand gehören zu derselben Dachseite',{exact:true}).check();
  await page.screenshot({path:resolve(out,`${fixture.id}-${info.project.name}-${winkel}-${idx}-dachpruefung.png`)});
  await aktion(page,'Dachfläche übernehmen');
  let p=await stand(page);const fl=p.flaechen[idx]!;
  expect(fl.azimutDeg).toBe(f.azimut);
  expect(p.flaechen.slice(0,idx)).toEqual(nachbarn);
  expect(p.fotos).toHaveLength(1);
  expect(fl.umrissM).toHaveLength(f.rand.length);expect(fl.fotoZuordnungen![0]!.referenzMessung!.ziegel).toEqual({spalten:f.spalten,reihen:f.reihen,deckbreiteCm:fixture.breite,decklaengeCm:fixture.laenge});
  const h=homographie(fl.breiteM,fl.hoeheM,fl.fotoZuordnungen![0]!.eckenPx!)!;
  for(const q of f.rand.map(rot)){expect(Math.min(...fl.umrissM!.map(a=>{const v=projiziere(h,a as Punkt);return Math.hypot(v[0]-q[0]!,v[1]-q[1]!);}))).toBeLessThan(5);}
  if(fixture.id==='erlus' && idx===1){
   await punkt(page,rot([1300*1600/2880,850*1600/2880]),true);
   await punkt(page,rot([1450*1600/2880,1040*1600/2880]),true);
   expect((await stand(page)).flaechen[idx]!.hindernisse).toHaveLength(1);
   await aktion(page,'Weiter zur Modulplatzierung');
  }else await aktion(page,'Keine Aussparungen – weiter');
  await aktion(page,'Belegung vorschlagen');
  p=await stand(page);expect(aktiveModule(p.flaechen[idx]!,rasterFuer(p.flaechen[idx]!,modulById(p.modulId)))).toBeGreaterThan(0);
 }
 if(fixture.id==='erlus'){
  const fl=(await stand(page)).flaechen;
  const dist=(i:number,a:number,b:number)=>Math.hypot(fl[i]!.umrissM![a]![0]-fl[i]!.umrissM![b]![0],fl[i]!.umrissM![a]![1]-fl[i]!.umrissM![b]![1]);
  // Unabhängig gezählte Felder, kein Anpassen an die Nachbarseite. Ablese-/Verlegeunsicherheit.
  for(const [i,a,j,b]of [[0,0,1,1],[0,1,2,0],[1,0,3,1],[2,1,3,0]]){
    const l=dist(i!,a!,2),r=dist(j!,b!,2);expect(Math.abs(l-r)/Math.max(l,r)).toBeLessThan(.08);
  }
 }
 await page.getByRole('button',{name:'Auswahl aufheben',exact:true}).click();
 await page.getByRole('button',{name:'Alles anzeigen',exact:true}).click();
 await page.screenshot({path:resolve(out,`${fixture.id}-${info.project.name}-${winkel}-belegung.png`)});
 const vorher=await stand(page);await page.reload();expect((await stand(page)).flaechen).toEqual(vorher.flaechen);
 if(info.project.name==='desktop' && winkel===0){
  await page.getByRole('button',{name:'3. Kunden-PDF',exact:true}).click();
  const pdfButton=page.getByRole('button',{name:'PDF herunterladen',exact:true});
  await expect(pdfButton).toBeEnabled({timeout:30000});
  await page.screenshot({path:resolve(out,`${fixture.id}-desktop-export.png`),fullPage:true});
  const download=page.waitForEvent('download');await pdfButton.click();
  const pdf=await download;expect(await pdf.failure()).toBeNull();await pdf.saveAs(resolve(out,`${fixture.id}-suedenergie-belegungsplan.pdf`));
 }
 expect(fehler).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
