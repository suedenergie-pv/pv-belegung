import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {neuesProjekt,type Projekt} from '../lib/model';
import {homographie,projiziere,type Ecken} from '../lib/foto-geometrie';
import {oeffneStartprojekt} from './projekt-einstieg';
const shots='.release/screenshots/usability-kundentermin';
const fotos:Ecken[]=[[[100,700],[1100,700],[1100,100],[100,100]],[[170,690],[1110,620],[1010,130],[100,70]]];
async function seed(page:Page,p:Projekt){

 await page.addInitScript(p=>{if(!localStorage.getItem('pv-belegung-projekte-v2'))localStorage.setItem('pv-belegung-projekte-v1',JSON.stringify({aktivId:'qa-usability',workflowVersion:2,projekte:[{id:'qa-usability',projekt:p,schritt:1,erstelltAm:Date.now(),geaendertAm:Date.now()}]}));},p);await page.goto('./');await oeffneStartprojekt(page);}
async function saved(page:Page){return page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pv-belegung-projekte-v2')!);return db.projekte.find((x:{id:string})=>x.id===db.aktivId).projekt;});}
for(const [i,ecken] of fotos.entries())test(`Kleines Fenster: ${i?'perspektivisch':'gerade'}, Zoom und genaue Eckkorrektur`,async({page},info)=>{
 test.setTimeout(100_000);mkdirSync(shots,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const p=neuesProjekt();p.kunde='Prüfung kleines Dachfenster';
 const h=homographie(20,8,ecken)!;const fenster=[[9.8,3.8],[10.2,3.8],[10.2,4.2],[9.8,4.2]].map(p=>projiziere(h,p as [number,number]));
 p.fotos=[{id:'bild',name:'Synthetischer Prüfplan',breitePx:1200,hoehePx:800,dataUrl:'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#ddd7cb"/><polygon points="${ecken.map(p=>p.join(',')).join(' ')}" fill="#a66b50"/><polygon points="${fenster.map(p=>p.join(',')).join(' ')}" fill="#244451" stroke="#fff" stroke-width="3"/><text x="100" y="35" font-size="20">Synthetischer Prüfplan · 40 × 40 cm Dachfenster</text></svg>`).toString('base64')}];
 Object.assign(p.flaechen[0]!,{breiteM:20,hoeheM:8,massStatus:'bestaetigt',grunddatenFertig:true,massEingabeOffen:false,hindernisse:[{xM:9.8,yM:3.8,breiteM:.4,hoeheM:.4}],fotoZuordnungen:[{fotoId:'bild',traufePx:null,eckenPx:ecken,perspektiveBestaetigt:true,markierungFertig:false}]});
 await seed(page,p);const b=(name:string)=>page.getByRole('button',{name,exact:true});
 await b('Aussparung 1 bearbeiten').click();await expect(page.getByTestId('aussparung-griff')).toHaveCount(4);
 const griff=page.getByTestId('aussparung-griff').first();const dot=griff.locator('[data-griff-sichtbar]');
 await expect(griff.locator('text')).toHaveCount(0);
 const read=async()=>dot.evaluate(node=>{const c=node as SVGCircleElement;const m=c.getScreenCTM()!;return {diameter:2*c.r.baseVal.value*Math.hypot(m.a,m.b),radius:c.r.baseVal.value,scale:Math.hypot(m.a,m.b)};});
 const initial=await read();expect(initial.diameter).toBeLessThanOrEqual(10.1);
 const points=await page.getByTestId('aussparung-kontur').getAttribute('points');
 await page.screenshot({path:`${shots}/${info.project.name}-${i}-100.png`});
 for(let j=0;j<6;j++)await b('Vergrößern').click();
 await expect(page.getByLabel('Zoom 381 Prozent')).toBeVisible();
 await expect.poll(async()=>(await read()).diameter).toBeLessThan(initial.diameter);
 const zoomed=await read();expect(zoomed.diameter).toBeGreaterThanOrEqual(7);expect(zoomed.radius).toBeLessThan(initial.radius/3);
 const hit=await griff.locator('[data-griff-ziel]').evaluate(n=>{const c=n as SVGCircleElement;return 2*c.r.baseVal.value*Math.hypot(c.getScreenCTM()!.a,c.getScreenCTM()!.b);});expect(hit).toBeCloseTo(44,0);
 await expect(page.getByTestId('aussparung-kontur')).toHaveAttribute('points',points!);
 expect((await saved(page)).flaechen[0].hindernisse).toEqual(p.flaechen[0]!.hindernisse);
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await page.screenshot({path:`${shots}/${info.project.name}-${i}-381.png`});
 const box=await dot.boundingBox();expect(box).not.toBeNull();
 const start={x:box!.x+box!.width/2,y:box!.y+box!.height/2};
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-12,start.y+8,{steps:8});await page.mouse.up();
 await expect(page.getByTestId('aussparung-kontur')).not.toHaveAttribute('points',points!);
 await b('Änderungen übernehmen').click();
 await expect.poll(async()=>(await saved(page)).flaechen[0].hindernisse[0].umrissM?.length).toBe(4);
 const after=(await saved(page)).flaechen[0].hindernisse;
 await page.reload();await expect(page.getByTestId('aussparung-kontur')).toHaveCount(1);
 expect((await saved(page)).flaechen[0].hindernisse).toEqual(after);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(errors).toEqual([]);
});
for(const zuerst of ['First','Traufe'])test(`20-m-Trapezdach: ${zuerst} zuerst, 15,51 m First gespeichert und geladen`,async({page},info)=>{
 const p=neuesProjekt();Object.assign(p.flaechen[0]!,{massStatus:'bestaetigt',massEingabeOffen:false,grunddatenFertig:true});await seed(page,p);
 const b=(name:string)=>page.getByRole('button',{name,exact:true});await b('Dachmaße').click();
 const first=page.getByLabel(/^Breite oben/),traufe=page.getByLabel(/^Breite unten/);
 if(zuerst==='First'){await first.fill('15,51');await expect(page.getByText(/eingetragene Breite unten \(10 m\)/)).toBeVisible();await traufe.fill('20');}else{await traufe.fill('20');await first.fill('15,51');}
 await expect(first).toHaveAttribute('aria-invalid','false');
 mkdirSync(shots,{recursive:true});await first.scrollIntoViewIfNeeded();await page.screenshot({path:`${shots}/${info.project.name}-20m-${zuerst}.png`});
 await b('Maße übernehmen').click();await expect.poll(async()=>(await saved(page)).flaechen[0].firstBreiteM).toBe(15.51);
 await page.reload();await b('Dachmaße').click();await expect(first).toHaveValue('15.51');await expect(traufe).toHaveValue('20');
});


test.describe('Präzise Fingerbedienung',()=>{
 test.use({hasTouch:true});
 test('Kleine Aussparung: Ecke mit Fadenkreuz greifen und bei Zoom versetzen',async({page},info)=>{
  test.setTimeout(90_000);
  const p=neuesProjekt(), ecken=fotos[0]!;
  p.fotos=[{id:'touch',name:'Neutraler Prüfplan',breitePx:1200,hoehePx:800,dataUrl:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#a66b50"/></svg>').toString('base64')}];
  Object.assign(p.flaechen[0]!,{breiteM:20,hoeheM:8,massStatus:'bestaetigt',massEingabeOffen:false,grunddatenFertig:true,hindernisse:[{xM:9.8,yM:3.8,breiteM:.4,hoeheM:.4}],fotoZuordnungen:[{fotoId:'touch',traufePx:null,eckenPx:ecken,perspektiveBestaetigt:true,markierungFertig:false}]});
  await seed(page,p);const b=(name:string)=>page.getByRole('button',{name,exact:true});await b('Aussparung 1 bearbeiten').tap();
  for(let n=0;n<10;n++)await b('Vergrößern').tap();
  await expect(page.getByLabel('Zoom 800 Prozent')).toBeVisible();
  const svg=page.getByRole('img',{name:/im Foto markieren/});
  const kreuz=page.getByTestId('foto-fadenkreuz');
  const ziel=page.getByTestId('aussparung-griff').first().locator('[data-griff-sichtbar]');
  const h=await ziel.evaluate(n=>{const c=n as SVGCircleElement;return [c.cx.baseVal.value,c.cy.baseVal.value]});
  const cursor=await kreuz.evaluate(n=>[Number(n.getAttribute('data-x')),Number(n.getAttribute('data-y'))]);
  const screen=await svg.boundingBox();const viewport=page.getByTestId('editor-viewport');
  const frame=await viewport.boundingBox();
  const cdp=await page.context().newCDPSession(page);
  const swipe=async(dx:number,dy:number)=>{
   const start={x:frame!.x+frame!.width/2,y:frame!.y+frame!.height/2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
   for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/6,y:start.y+dy*i/6,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await swipe((h[0]!-cursor[0]!)/1200*screen!.width,(h[1]!-cursor[1]!)/800*screen!.height);
  await expect(b('Ecke greifen').filter({visible:true})).toBeEnabled();await b('Ecke greifen').filter({visible:true}).tap();
  await swipe(-12,8);await b('Ecke hier ablegen').filter({visible:true}).tap();
  await b('Änderungen übernehmen').tap();
  await expect.poll(async()=>(await saved(page)).flaechen[0].hindernisse[0].umrissM?.length).toBe(4);
  await cdp.detach();
 });
});
