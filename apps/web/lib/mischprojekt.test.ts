import { afterEach,describe,expect,it,vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { dreheFeld, MODULES, flachdachMindestPitch } from '@pv-belegung/engine';
import { mischprojekt, MISCHFAELLE, projektFall } from './test/mischprojekt';
import { aktiveModule, bauePayload, hindernisseVon, kwpGesamt, migriereProjekt, modulById, patchFlaechenGeometrie, projektFreigabe, rahmenBreiteVon, rasterFuer, umrissVon, type ProjektDb, type PunktM } from './model';
import { geometrieEntwurfAufStand } from './geometrie-entwurf';
import { ProjektHistorien } from './projekt-historie';
import { komplettExportJson, importiereKomplettExport, speichereProjekte, ladeProjekte } from './speicher';
import { mitMassplan } from './massplan';

// Unabhängiges SAT-Orakel, ohne Kollisionsfunktionen der Engine.
function ueberlappt(a:readonly PunktM[],b:readonly PunktM[]){
 for(const p of [a,b])for(let i=0;i<p.length;i++){
  const u=p[i]!,v=p[(i+1)%p.length]!,nx=-(v[1]-u[1]),ny=v[0]-u[0];
  const pa=a.map(q=>q[0]*nx+q[1]*ny),pb=b.map(q=>q[0]*nx+q[1]*ny);
  if(Math.max(...pa)<=Math.min(...pb)+1e-7 || Math.max(...pb)<=Math.min(...pa)+1e-7)return false;
 }return true;
}
function innen(p:PunktM,poly:readonly PunktM[]){let drin=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i]!,b=poly[j]!;
 if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])drin=!drin;
 }return drin;}
// Auch bei konkaven Umrissen reicht die Prüfung der vier Ecken allein nicht.
function kreuztRand(a:readonly PunktM[],b:readonly PunktM[]){
 const seite=(p:PunktM,q:PunktM,r:PunktM)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const p=a[i]!,q=a[(i+1)%a.length]!,r=b[j]!,t=b[(j+1)%b.length]!;
  if(seite(p,q,r)*seite(p,q,t)<-1e-10&&seite(r,t,p)*seite(r,t,q)<-1e-10)return true;
 }return false;
}
const rect=(x:number,y:number,w:number,h:number):PunktM[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function pruefeProjekt(p:ReturnType<typeof mischprojekt>){
 const m=modulById(p.modulId),payload=bauePayload(p,null) as {kwp:number;flaechen:{id:string;module:{anzahl:number;anzahl_hochkant:number;anzahl_quer:number;anzahl_ost:number;anzahl_west:number}}[]};
 let gesamt=0;
 for(const f of p.flaechen){
  const raster=rasterFuer(f,m),pos=raster.positionen,poly=umrissVon(f)??rect(0,0,rahmenBreiteVon(f),f.hoeheM);
  if(!f.gaubenTyp)expect(pos.length, f.name).toBeGreaterThan(0);
  const ecken=pos.map(z=>z.eckenM??rect(z.xM,z.yM,z.wM,z.hM));
  const grenzen=ecken.map(e=>({l:Math.min(...e.map(p=>p[0])),r:Math.max(...e.map(p=>p[0])),o:Math.min(...e.map(p=>p[1])),u:Math.max(...e.map(p=>p[1]))}));
  for(let i=0;i<ecken.length;i++){
   for(const e of ecken[i]!)expect(innen(e,poly),f.name+' außerhalb').toBe(true);
   expect(kreuztRand(ecken[i]!,poly),f.name+' Rand gekreuzt').toBe(false);
   for(const h of hindernisseVon(f)??[])expect(ueberlappt(ecken[i]!,h.umrissM??rect(h.xM,h.yM,h.breiteM,h.hoeheM)),f.name+' Hindernis').toBe(false);
   for(let j=i+1;j<ecken.length;j++){
    const a=grenzen[i]!,b=grenzen[j]!;
    if(a.r<=b.l+1e-7||b.r<=a.l+1e-7||a.u<=b.o+1e-7||b.u<=a.o+1e-7)continue;
    expect(ueberlappt(ecken[i]!,ecken[j]!),f.name+' Kollision').toBe(false);
   }
  }
  const n=aktiveModule(f,raster);gesamt+=n;
  const ex=payload.flaechen.find(x=>x.id===f.id)!.module;
  expect(ex.anzahl).toBe(n);expect(ex.anzahl_hochkant+ex.anzahl_quer).toBe(n);
  if(f.flachdach?.aufstaenderung==='ostwest')expect(ex.anzahl_ost+ex.anzahl_west).toBe(n);
 }
 expect(kwpGesamt(p)).toBeCloseTo(gesamt*m.pmaxW/1000,8);
 expect(payload.kwp).toBe(Math.round(gesamt*m.pmaxW/10)/100);
 expect(projektFreigabe(p).pdf).toBe(true);
 return payload;
}
afterEach(()=>vi.unstubAllGlobals());
describe('Mehrere Projektfamilien mit gemischten Dachformen und Montagearten',()=>{
 it.each(MISCHFAELLE.flatMap(fall=>[-180,-135,-90,-45,-17.5,0,7.5,15,30,45,89,90,135,179,180,225,270,315,359].map(winkel=>({fall,name:fall.name,winkel}))))('$name mit Felddrehung $winkel° bleibt konsistent',({fall,winkel})=>{
  const p=projektFall(fall);p.flaechen=p.flaechen.map((f,i)=>({...f,felder:f.felder?.map((feld,k)=>({...feld,...dreheFeld(feld,winkel+i*3.5+k*11)}))}));
  const vorher=JSON.stringify(p),payload=pruefeProjekt(p);
  expect(JSON.stringify(p)).toBe(vorher);
  expect(pruefeProjekt(migriereProjekt(JSON.parse(vorher)))).toEqual(payload);
  expect(pruefeProjekt({...p,flaechen:[...p.flaechen].reverse()}).flaechen.slice().reverse()).toEqual(payload.flaechen);
 });
 it.each(MODULES.flatMap(modul=>[0,5,10,12.5,15,20,25,30,35,45,60,75].flatMap((winkel,wi)=>(['unten','links','oben','rechts'] as const).map((richtung,ri)=>({modul,winkel,richtung,wi,ri})))))('Gemischte Montage: $modul.id / $winkel° / $richtung',({modul,winkel,richtung,wi,ri})=>{
  const p=mischprojekt();p.modulId=modul.id;
  p.flaechen=p.flaechen.map((f,i)=>{
   if(f.art!=='flachdach')return f;
   const montage={...f.flachdach!,winkelDeg:winkel,richtungSued:richtung,moduleInNeigung:1+(wi+ri+i)%6,modulAusrichtung:(i%2?'hoch':'quer') as 'hoch'|'quer'};
   montage.pitchM=flachdachMindestPitch(modul,montage)+.5;
   return {...f,flachdach:montage,felder:[{xM:.05,yM:.05,breiteM:f.breiteM-.1,hoeheM:f.hoeheM-.1,quer:false}]};
  });
  pruefeProjekt(p);
 });
 it('Montage-/Maßänderung an einer Fläche lässt Nachbarn, ihre Fotos und Historie vollständig unverändert',()=>{
  const p=mischprojekt(),alt=structuredClone(p),f=p.flaechen[3]!;
  const entwurf={...f,breiteM:38,flachdach:{...f.flachdach!,winkelDeg:25,moduleInNeigung:1}};
  const neu={...p,flaechen:p.flaechen.map(x=>x.id===f.id?geometrieEntwurfAufStand(f,entwurf,x):x)};
  const h=new ProjektHistorien();h.record('mix',p,neu);
  expect(neu.flaechen.filter(x=>x.id!==f.id)).toEqual(alt.flaechen.filter(x=>x.id!==f.id));expect(neu.fotos).toEqual(alt.fotos);
  pruefeProjekt(neu);expect(h.undo('mix',neu)).toEqual(p);expect(h.redo('mix',p)).toEqual(neu);
 });
 it('Komplettexport und Import neben vorhandenem Projekt erhalten alle Flächen, Bilder, Montagearten und Drehungen',async()=>{
  const data=new Map<string,string>();vi.stubGlobal('window',{indexedDB:new IDBFactory(),localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});
  const p=mischprojekt(),db:ProjektDb={aktivId:'mix',workflowVersion:2,projekte:[{id:'mix',projekt:p,schritt:1,erstelltAm:1,geaendertAm:2}]};
  expect((await speichereProjekte(db)).status).toBe('erfolg');
  const geladen=await ladeProjekte();expect(geladen.status).toBe('erfolg');if(geladen.status!=='erfolg')return;
  expect(geladen.db.projekte[0]!.projekt).toEqual(p);
  const importiert=await importiereKomplettExport(komplettExportJson(db),geladen.db);
  expect(importiert.status).toBe('erfolg');if(importiert.status!=='erfolg')return;
  expect(importiert.db.projekte).toHaveLength(2);expect(new Set(importiert.db.projekte.map(e=>e.id)).size).toBe(2);
  expect(importiert.db.projekte.map(e=>e.projekt)).toEqual([p,p]);
  const payload=pruefeProjekt(p);expect(pruefeProjekt(importiert.db.projekte[1]!.projekt)).toEqual(payload);
 });
 it('Änderung eines gemeinsam verwendeten Maßplans darf die Bildunterlage einer anderen Fläche nicht umzeichnen',()=>{
  let p=mischprojekt();const owner=p.flaechen[4]!,foto=p.fotos.find(x=>x.massplanFlaecheId===owner.id)!;
  p={...p,flaechen:p.flaechen.map(f=>f.id==='p6'?{...f,fotoZuordnungen:structuredClone(owner.fotoZuordnungen)}:f)};
  const fremd=structuredClone(p.flaechen[5]!);
  const unveraendert=mitMassplan(p,owner.id);expect(unveraendert.fotos).toEqual(p.fotos);expect(unveraendert.flaechen).toEqual(p.flaechen);
  p={...p,flaechen:p.flaechen.map(f=>f.id===owner.id?patchFlaechenGeometrie(f,{breiteM:48}):f)};
  p=mitMassplan(p,owner.id);
  expect(p.flaechen[5]).toEqual(fremd);expect(p.fotos.find(x=>x.id===foto.id)).toEqual(foto);
  expect(p.flaechen[4]!.fotoZuordnungen![0]!.fotoId).not.toBe(foto.id);
 });
});
