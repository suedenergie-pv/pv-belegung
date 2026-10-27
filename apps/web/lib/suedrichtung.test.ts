import { describe,it,expect } from 'vitest';
import { feldPunkt,suedWinkelAusPunkten,normalisiereFeldDrehung } from '@pv-belegung/engine';
import { neuesProjekt,mitSuedRichtung,suedWinkelVon,suedFeldDrehung,migriereProjekt,bauePayload,modulById,rasterFuer,vollFeldFuer } from './model';
import { homographie,inverseHomographie,projiziere,type Ecken } from './foto-geometrie';
const fotos:Ecken[]=[[[20,700],[1100,700],[1100,20],[20,20]],[[180,740],[1100,610],[820,70],[330,180]],[[1080,200],[900,750],[80,650],[250,60]]];
describe('Südrichtung in schrägen und gedrehten Fotos',()=>{
 it.each(fotos.flatMap((ecken,i)=>[0,37.5,90,180,213.7,270,359].map(winkel=>({ecken,i,winkel}))))('Foto $i / Süden $winkel° wird aus Foto-Punkten perspektivisch zurückgerechnet',({ecken,winkel})=>{
  const h=homographie(30,20,ecken)!,inv=inverseHomographie(30,20,ecken)!;
  const a=[15,10] as [number,number],b=[15+5*Math.sin(winkel*Math.PI/180),10-5*Math.cos(winkel*Math.PI/180)] as [number,number];
  const ausFoto=suedWinkelAusPunkten(projiziere(inv,projiziere(h,a)),projiziere(inv,projiziere(h,b)))!;
  const delta=Math.abs(ausFoto-winkel);expect(Math.min(delta,360-delta)).toBeLessThan(1e-8);
 });
 it.each(['unten','links','oben','rechts'] as const)('Altstand %s bleibt identisch; Kalibrierung, JSON, Migration und Payload erhalten Feldgassen/Lücken',richtungSued=>{
  const p=neuesProjekt(),f=p.flaechen[0]!;
  Object.assign(f,{art:'flachdach',breiteM:30,hoeheM:30,massStatus:'bestaetigt',flachdach:{aufstaenderung:'sued',winkelDeg:25,pitchM:4,richtungSued},felder:[{xM:5,yM:5,breiteM:10,hoeheM:12,quer:true,freieGasseM:.8,leer:['0-1'],drehungDeg:8}]});
  const m=modulById(p.modulId),alt=rasterFuer(f,m),neu=mitSuedRichtung(f,237.5,true),mitte=feldPunkt(f.felder![0]!,[5,6]);
  expect(rasterFuer(mitSuedRichtung(f,suedWinkelVon(f),false),m)).toEqual(alt);
  feldPunkt(neu.felder![0]!,[5,6]).forEach((v,i)=>expect(v).toBeCloseTo(mitte[i]!,10));
  expect(neu.felder![0]!.freieGasseM).toBe(.8);expect(neu.felder![0]!.leer).toEqual(['0-1']);
  expect(normalisiereFeldDrehung((neu.felder![0]!.drehungDeg??0)-suedFeldDrehung(neu))).toBe(8);
  expect(mitSuedRichtung(f,237.5,false).felder).toBe(f.felder);
  p.flaechen[0]=neu;const gespeichert=migriereProjekt(JSON.parse(JSON.stringify(p)));
  expect(gespeichert.flaechen[0]!.felder).toEqual(neu.felder);expect(suedWinkelVon(gespeichert.flaechen[0]!)).toBe(237.5);
  expect(bauePayload(gespeichert,null)).toMatchObject({flaechen:[{flachdach_montage:{sued_winkel_deg:237.5,sued_bestaetigt:true},belegungsfelder:[{freie_gasse_m:.8,leere_zellen:['0-1']}]}]});
  expect(vollFeldFuer(neu,m).drehungDeg).toBe(suedFeldDrehung(neu));
 });
});
