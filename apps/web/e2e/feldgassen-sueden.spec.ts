import { expect,test,type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { neuesProjekt,neueFlaeche,type Projekt } from '../lib/model';
import { homographie,projiziere,type Ecken } from '../lib/foto-geometrie';
import { dreheFeld,feldEcken } from '@pv-belegung/engine';
import { oeffneStartprojekt } from './projekt-einstieg';
test.use({hasTouch:true});
const fotos:Ecken[]=[[[80,730],[1120,680],[1050,100],[190,50]],[[1080,180],[950,740],[100,650],[260,60]]];
async function stand(page:Page):Promise<Projekt>{return page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);return db.projekte.find((e:{id:string})=>e.id===db.aktivId).projekt;});}
for(const art of ['sued','ostwest'] as const)for(const [i,ecken] of fotos.entries())test(`${art}: drei Feldgassen und Südpfeil im ${i?'gedrehten':'schrägen'} Foto`,async({page},info)=>{
 test.setTimeout(100_000);page.setDefaultTimeout(12_000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const b=(name:string)=>page.getByRole('button',{name,exact:true});
 const p=neuesProjekt();p.kunde='SüdEnergie Prüfprojekt';p.adresse='Fiktive Halle';p.erfasser='Walter';
 p.fotos=[{id:'foto',name:'Perspektivischer Prüfplan',breitePx:1200,hoehePx:800,dataUrl:'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#e3e6df"/><polygon points="${ecken.map(p=>p.join(',')).join(' ')}" fill="#737c80" stroke="#fff" stroke-width="4"/></svg>`).toString('base64')}];
 Object.assign(p.flaechen[0]!,{art:'flachdach',einsatzort:art==='sued'?'halle':'freiflaeche',breiteM:60,hoeheM:40,neigungDeg:0,randM:.05,massStatus:'bestaetigt',grunddatenFertig:true,
  flachdach:{aufstaenderung:art,winkelDeg:art==='sued'?25:15,pitchM:art==='sued'?4:7,moduleInNeigung:art==='sued'?1:2,modulAusrichtung:'hoch',richtungSued:'unten'},felder:[],
  fotoZuordnungen:[{fotoId:'foto',traufePx:null,eckenPx:ecken,perspektiveBestaetigt:true,markierungFertig:true}]});
 p.flaechen.push({...neueFlaeche(2,'B'),name:'Unverändertes Schrägdach',felder:[{xM:1,yM:1,breiteM:5,hoeheM:3,quer:false}]});
 await page.addInitScript(p=>{if(!localStorage.getItem('pv-belegung-projekte-v2'))localStorage.setItem('pv-belegung-projekte-v1',JSON.stringify({aktivId:'qa',workflowVersion:2,projekte:[{id:'qa',projekt:p,schritt:1,erstelltAm:Date.now(),geaendertAm:Date.now()}]}));},p);
 await page.goto('./');await oeffneStartprojekt(page);
 await b('+ Feld zeichnen').click();await expect(page.getByRole('region',{name:'Südrichtung festlegen'})).toBeVisible();
 const h=homographie(60,40,ecken)!;const bild=page.getByRole('img',{name:/^Belegungsfläche/}).first();
 const punkt=async(p:readonly[number,number])=>{const v=projiziere(h,p),box=await bild.boundingBox();if(!box)throw Error('Bild fehlt');await bild.tap({position:{x:v[0]/1200*box.width,y:v[1]/800*box.height}});};
 const winkel=i?237.5:270,rad=winkel*Math.PI/180;
 await punkt([30,20]);await punkt([30+10*Math.sin(rad),20-10*Math.cos(rad)]);
 await expect(page.getByTestId('sued-pfeil')).toBeVisible();await b('Südrichtung übernehmen').click();
 await expect.poll(async()=>(await stand(page)).flaechen[0]!.flachdach!.suedWinkelDeg).toBeCloseTo(winkel,1);
 // Die Drei-Felder-Szene wird tatsächlich mit der Maus gezeichnet.
 for(let j=0;j<3;j++){
  await b('+ Feld zeichnen').click();const f=dreheFeld({xM:5+j*20,yM:14,breiteM:10,hoeheM:12,quer:true},winkel-180);
  const e=feldEcken(f),a=projiziere(h,e[0]),z=projiziere(h,e[2]),box=await bild.boundingBox();if(!box)throw Error('Bild fehlt');
  const start={x:box.x+a[0]/1200*box.width,y:box.y+a[1]/800*box.height},ende={x:box.x+z[0]/1200*box.width,y:box.y+z[1]/800*box.height};
  if(info.project.name==='desktop'){await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(ende.x,ende.y,{steps:8});await page.mouse.up();}
  else {const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});for(let k=1;k<=8;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(ende.x-start.x)*k/8,y:start.y+(ende.y-start.y)*k/8,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  const gap=page.getByLabel('Freie Gasse im ausgewählten Feld');await expect(gap).toBeVisible();await gap.fill(['0,05','0,8','1,5'][j]!);await b('Abstand übernehmen').click();
  await expect.poll(async()=>(await stand(page)).flaechen[0]!.felder?.[j]?.freieGasseM).toBe([.05,.8,1.5][j]);
 }
 const fertig=await stand(page),felder=fertig.flaechen[0]!.felder!;expect(felder).toHaveLength(3);expect(fertig.flaechen[1]).toEqual(p.flaechen[1]);
 for(const f of felder)expect(f.drehungDeg).toBeCloseTo(winkel-180,1);
 // Erstes Feld separat auswählen; Nachbarn behalten Form, Lage, Neigung und Gasse.
 await b('Auswählen').click();await punkt([10,20]);await expect(page.getByLabel('Freie Gasse im ausgewählten Feld')).toHaveValue('0,05');
 if(art==='sued' && i===0){await page.getByLabel('Freie Gasse im ausgewählten Feld').fill('1,3');await punkt([30,20]);await expect(page.getByRole('dialog')).toBeVisible();await b('Bleiben').click();await expect(page.getByLabel('Freie Gasse im ausgewählten Feld')).toHaveValue('1,3');}
 await page.getByLabel('Freie Gasse im ausgewählten Feld').fill('2');await b('Abstand übernehmen').click();
 await expect.poll(async()=>(await stand(page)).flaechen[0]!.felder![0]!.freieGasseM).toBe(2);
 expect((await stand(page)).flaechen[0]!.felder!.slice(1)).toEqual(felder.slice(1));
 await page.getByRole('button',{name:/Rückgängig/}).click();await expect.poll(async()=>(await stand(page)).flaechen[0]!.felder![0]!.freieGasseM).toBe(.05);
 // Zweite Kalibrierung nur am Kompass: Felder absichtlich nicht mitdrehen.
 await b('Süden ändern').click();await page.getByText('Ohne Klicken einstellen',{exact:true}).click();await page.getByLabel('Südrichtung in Grad').fill('123,5');await b('Richtung anzeigen').click();
 await page.getByRole('checkbox',{name:/vorhandene/}).uncheck();await b('Südrichtung übernehmen').click();
 await expect.poll(async()=>(await stand(page)).flaechen[0]!.flachdach!.suedWinkelDeg).toBe(123.5);expect((await stand(page)).flaechen[0]!.felder).toEqual(felder);
 await b('Süden ändern').click();await bild.focus();await page.keyboard.press('Enter');for(let k=0;k<10;k++)await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');
 await expect(page.getByTestId('sued-pfeil')).toBeVisible();await b('Abbrechen').click();expect((await stand(page)).flaechen[0]!.flachdach!.suedWinkelDeg).toBe(123.5);
 await page.reload();await expect(b('Süden ändern')).toBeVisible();expect((await stand(page)).flaechen[0]!.felder).toEqual(felder);
 expect((await stand(page)).flaechen[1]).toEqual(p.flaechen[1]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(errors).toEqual([]);
 const out=resolve('.release/screenshots/feldgassen-sueden');mkdirSync(out,{recursive:true});await page.screenshot({path:resolve(out,`${info.project.name}-${art}-${i}.png`)});
});
