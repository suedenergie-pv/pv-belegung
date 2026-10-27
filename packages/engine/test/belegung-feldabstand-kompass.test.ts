import { describe,it,expect } from 'vitest';
import { MODULES, berechneFelderRaster, feldSchrittmasse, montageFuerFeld, montageGeometrie, feldPunkt, feldPunktLokal, feldEcken, dreheFeld, feldAusPunkten, vollFeldGedreht, suedWinkelAusPunkten, type FelderInput, type BelegungsFeldM } from '../src';
const modul=MODULES[0]!;
const varianten = (['sued','ostwest'] as const).flatMap(art => [0,25,75].flatMap(winkel => [0,37.5,270].flatMap(drehung => [1,2].map(n => ({art,winkel,drehung,n})))));
describe('Unabhängige Tischgassen und Orientierung',()=>{
 it.each(varianten)('$art $winkel° / $drehung° / $n Module: drei unabhängig belegte Felder',({art,winkel,drehung,n})=>{
  const input: FelderInput={breiteM:120,hoeheM:60,module:modul,randM:0,montage:{aufstaenderung:art,winkelDeg:winkel,pitchM:8,moduleInNeigung:n,modulAusrichtung:'hoch'}};
  const felder:BelegungsFeldM[]=[.05,.8,2].map((freieGasseM,i)=>dreheFeld({xM:10+i*35,yM:20,breiteM:18,hoeheM:18,quer:true,freieGasseM,leer:['0-0']},drehung));
  const vorher=JSON.stringify(felder),gesamt=berechneFelderRaster(input,felder);
  const geometrie=montageGeometrie(modul,input.montage!);
  for(let i=0;i<3;i++){
    const feld=felder[i]!,m=montageFuerFeld(input,feld)!;
    expect(m.pitchM-geometrie.footprintM).toBeCloseTo(feld.freieGasseM!,10);
    const einzeln=berechneFelderRaster(input,[feld]).positionen;
    const zusammen=gesamt.positionen.filter(p=>p.feld===i);
    expect(zusammen.map(({feld,...p})=>p)).toEqual(einzeln.map(({feld,...p})=>p));
    expect(zusammen.length).toBeGreaterThan(0);
    expect(zusammen.some(p=>p.row===0&&p.col===0)).toBe(false);
    const sm=feldSchrittmasse(input,true,feld);
    expect(art==='sued'?sm.pitchYM:sm.pitchXM).toBeCloseTo(m.pitchM,10);
    // Nachbarfeld bleibt exakt gleich, wenn die mittlere Gasse wächst.
  }
  const neu=berechneFelderRaster(input,felder.map((f,i)=>i===1?{...f,freieGasseM:4}:f));
  expect(neu.positionen.filter(p=>p.feld!==1)).toEqual(gesamt.positionen.filter(p=>p.feld!==1));
  expect(neu.positionen.filter(p=>p.feld===1).length).toBeLessThanOrEqual(gesamt.positionen.filter(p=>p.feld===1).length);
  expect(JSON.stringify(felder)).toBe(vorher);
 });
 it.each([-1,NaN,Infinity,51])('ungültige Feldgasse %s erzeugt keine falschen Module',freieGasseM=>{
  const input:FelderInput={module:modul,breiteM:10,hoeheM:10,montage:{aufstaenderung:'sued',winkelDeg:25,pitchM:4}};
  expect(berechneFelderRaster(input,[{xM:0,yM:0,breiteM:10,hoeheM:10,quer:true,freieGasseM}]).positionen).toEqual([]);
 });
 it.each([0,37.5,90,183,270,359.5])('gezogene Feld-Diagonale bleibt bei %s° exakt an den Klickpunkten',winkel=>{
  const a=[12,10] as const,b=[21,24] as const,f=feldAusPunkten(a,b,winkel);
  for(const p of [a,b]) expect(feldEcken(f).some(e=>Math.hypot(e[0]-p[0],e[1]-p[1])<1e-9)).toBe(true);
  for(const p of feldEcken(f)){const l=feldPunktLokal(f,p);expect(feldPunkt(f,l)[0]).toBeCloseTo(p[0],10);}
 });
 it.each([0,37.5,90,183,270])('Vollbelegung mit %s° bleibt innerhalb des Flächenrands',winkel=>{
  const input:FelderInput & {ausrichtung:'quer'}={module:modul,breiteM:20,hoeheM:15,randM:.5,ausrichtung:'quer',montage:{aufstaenderung:'ostwest',winkelDeg:15,pitchM:3}};
  const f=vollFeldGedreht(input,winkel),r=berechneFelderRaster(input,[f]);expect(r.positionen.length).toBeGreaterThan(0);
  for(const p of r.positionen)for(const [x,y] of p.eckenM??[[p.xM,p.yM],[p.xM+p.wM,p.yM+p.hM]]){expect(x).toBeGreaterThanOrEqual(.5-1e-8);expect(x).toBeLessThanOrEqual(19.5+1e-8);expect(y).toBeGreaterThanOrEqual(.5-1e-8);expect(y).toBeLessThanOrEqual(14.5+1e-8);}
 });
 it('lehnt unbestimmte Südpfeile ab',()=>{expect(suedWinkelAusPunkten([0,0],[.01,.01])).toBeNull();expect(suedWinkelAusPunkten([NaN,0],[2,3])).toBeNull();});
});
