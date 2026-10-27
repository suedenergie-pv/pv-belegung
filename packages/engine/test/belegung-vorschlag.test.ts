import { describe, expect, it } from 'vitest';
import { berechneFelderRaster, vorschlagsFeld, vollFeldGedreht, type FelderInput, type BelegungsFeldM } from '../src/belegung';
import { JOLYWOOD_JW_HD96N_R2_460 as module } from '../src/catalog/modules';
import type { PunktM } from '../src/geometrie';

type VorschlagInput = FelderInput & { ausrichtung: 'hoch' | 'quer' };

/**
 * ERLUS Monaco Umbra, untere echte Dreiecksfläche, Herstelleraufnahme 2880 × 2160.
 * https://www.erlus.com/rooftilemodels?pid=7975 ; Foto/Ableseprotokoll: QA_PLAN.md.
 * Unabhängige 8×8-Rechnung aus sichtbaren Rasterkreuzungen
 * [1680,1752], [1974,1758], [1988,1491], [1688,1490], zehn ganzen Breiten/sechs Reihen.
 * Randpunkte [1238,1790], [2390,1795], [1842,1230], danach Rahmenursprung abgezogen.
 * 19,9/34 cm sind explizite Testannahmen aus dem Herstellerbereich, KEIN Aufmaß.
 * Dieser Test prüft den Rastervorschlag für diese numerische Kontur, keine Kapazität
 * des fotografierten Gebäudes. Bilddaten bleiben außerhalb des Repositorys.
 */
const erlus: VorschlagInput = {
  module, ausrichtung: 'hoch', breiteM: 7.83658899881117, hoeheM: 4.359690726506209,
  umrissM: [[0,4.359690726506209],[7.83658899881117,4.190859586933643],[4.100634666789452,0]],
};
const anzahl = (input: VorschlagInput, feld: BelegungsFeldM) => berechneFelderRaster(input, [feld]).positionen.length;

// Unabhängige Prüfformeln: kein Aufruf des produktiven Polygonfilters.
const kreuz = (a: PunktM, b: PunktM, p: PunktM) =>
  (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function inPolygon(p: PunktM, polygon: readonly PunktM[]): boolean {
  let schnitte = 0;
  for (let i=0;i<polygon.length;i++) {
    const a=polygon[i]!, b=polygon[(i+1)%polygon.length]!;
    if (Math.abs(kreuz(a,b,p))<1e-8 && p[0]>=Math.min(a[0],b[0])-1e-8
      && p[0]<=Math.max(a[0],b[0])+1e-8 && p[1]>=Math.min(a[1],b[1])-1e-8
      && p[1]<=Math.max(a[1],b[1])+1e-8) return true;
    if ((a[1]>p[1])!==(b[1]>p[1])
      && p[0]<a[0]+(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])) schnitte++;
  }
  return schnitte%2===1;
}
function pruefeErgebnis(input: VorschlagInput, feld: BelegungsFeldM) {
  const positionen=berechneFelderRaster(input,[feld]).positionen;
  for (const p of positionen) {
    expect(p.wM).toBe(input.ausrichtung==='hoch'?1.134:1.762);
    expect(p.hM).toBe(input.ausrichtung==='hoch'?1.762:1.134);
    const ecken:PunktM[]=[[p.xM,p.yM],[p.xM+p.wM,p.yM],[p.xM+p.wM,p.yM+p.hM],[p.xM,p.yM+p.hM]];
    for (let i=0;i<4;i++) for (let k=0;k<=20;k++) {
      const a=ecken[i]!,b=ecken[(i+1)%4]!,q:PunktM=[a[0]+(b[0]-a[0])*k/20,a[1]+(b[1]-a[1])*k/20];
      expect(inPolygon(q,input.umrissM!)).toBe(true);
      expect(q[0]).toBeGreaterThanOrEqual((input.randM??0)-1e-8);
      expect(q[1]).toBeGreaterThanOrEqual((input.randM??0)-1e-8);
      expect(q[0]).toBeLessThanOrEqual(input.breiteM-(input.randM??0)+1e-8);
      expect(q[1]).toBeLessThanOrEqual(input.hoeheM-(input.randM??0)+1e-8);
    }
    // Alle Module bleiben im selben globalen Raster; keine Reihenverschiebung.
    expect(p.xM).toBeCloseTo(feld.xM+p.col*(p.wM+.02),10);
    expect(p.yM).toBeCloseTo(feld.yM+p.row*(p.hM+.02),10);
    for (const hi of input.hindernisseM??[]) {
      expect(Math.min(p.xM+p.wM,hi.xM+hi.breiteM)-Math.max(p.xM,hi.xM)>1e-8
        && Math.min(p.yM+p.hM,hi.yM+hi.hoeheM)-Math.max(p.yM,hi.yM)>1e-8).toBe(false);
    }
  }
}

describe('Initialer Belegungsvorschlag: ein ausgerichtetes Raster, begrenzte Suche',()=>{
  it('nutzt im echten ERLUS-Dreieck drei statt zwei unveränderte Hochkantmodule',()=>{
    const basis=vollFeldGedreht(erlus,0), feld=vorschlagsFeld(erlus);
    expect(anzahl(erlus,basis)).toBe(2);
    expect(anzahl(erlus,feld)).toBe(3);
    expect(feld.breiteM).toBe(basis.breiteM);
    expect(feld.hoeheM).toBe(basis.hoeheM);
    expect(feld.quer).toBe(false);
    pruefeErgebnis(erlus,feld);
    // Für dieses Dreieck ist die konvexe Halbraumprüfung aller vier Modulecken exakt.
    for (const p of berechneFelderRaster(erlus,[feld]).positionen)
      for (const q of [[p.xM,p.yM],[p.xM+p.wM,p.yM],[p.xM+p.wM,p.yM+p.hM],[p.xM,p.yM+p.hM]] as PunktM[])
        for (let i=0;i<3;i++) expect(kreuz(erlus.umrissM![i]!,erlus.umrissM![(i+1)%3]!,q)).toBeLessThanOrEqual(1e-8);
  });

  for (const spitze of [0,1.5,4,6.5,8]) for (const ausrichtung of ['hoch','quer'] as const)
    it(`Spitze bei ${spitze} m, ${ausrichtung}: keine verlorenen Module oder Kantenüberschreitungen`,()=>{
      const input:VorschlagInput={module,ausrichtung,breiteM:8,hoeheM:5,randM:.05,umrissM:[[0,5],[8,5],[spitze,0]]};
      const feld=vorschlagsFeld(input);
      expect(anzahl(input,feld)).toBeGreaterThanOrEqual(anzahl(input,vollFeldGedreht(input,0)));
      expect(anzahl(input,feld)).toBeGreaterThan(0);
      pruefeErgebnis(input,feld);
    });

  it('respektiert einen tiefen konkaven Einschnitt und zwei Dachfenster',()=>{
    const input:VorschlagInput={module,ausrichtung:'hoch',breiteM:8,hoeheM:6,randM:.1,
      umrissM:[[0,0],[8,0],[8,6],[5,6],[5,2],[3,2],[3,6],[0,6]],
      hindernisseM:[{xM:.6,yM:.5,breiteM:1,hoeheM:1},{xM:6.1,yM:4,breiteM:.7,hoeheM:.6}]};
    const feld=vorschlagsFeld(input);
    expect(anzahl(input,feld)).toBeGreaterThanOrEqual(anzahl(input,vollFeldGedreht(input,0)));
    expect(anzahl(input,feld)).toBeGreaterThan(0);
    pruefeErgebnis(input,feld);
  });

  it.each([false,true])('behält die Mitte beim Rechteck, expliziter Umriss=%s',explizit=>{
    const input:VorschlagInput={module,ausrichtung:'hoch',breiteM:8,hoeheM:5,
      ...(explizit?{umrissM:[[0,0],[8,0],[8,5],[0,5]] as PunktM[]}: {})};
    expect(vorschlagsFeld(input)).toEqual(vollFeldGedreht(input,0));
  });
  it('behält die Mitte bei Gleichstand ohne ein einziges passendes Modul',()=>{
    const input:VorschlagInput={...erlus,hindernisseM:[{xM:0,yM:0,breiteM:8,hoeheM:5}]};
    expect(vorschlagsFeld(input)).toEqual(vollFeldGedreht(input,0));
  });
  it.each([25,90,180,270])('ändert einen gedrehten Vorschlag mit %s° nicht',winkel=>{
    expect(vorschlagsFeld(erlus,winkel)).toEqual(vollFeldGedreht(erlus,winkel));
  });
  for (const aufstaenderung of ['sued','ostwest'] as const) for (const winkelDeg of [0,15,60])
    it(`${aufstaenderung}, ${winkelDeg}°: Aufständerung einschließlich freier Drehung bleibt unverändert`,()=>{
      const input:VorschlagInput={...erlus,montage:{aufstaenderung,winkelDeg,pitchM:3,modulAusrichtung:'quer',moduleInNeigung:1}};
      for (const drehung of [0,37.5,270]) expect(vorschlagsFeld(input,drehung)).toEqual(vollFeldGedreht(input,drehung));
    });
  it('ist wiederholbar und verändert weder Eingabe noch bestehende manuelle Felder mit Lücken',()=>{
    const input=structuredClone(erlus), vorher=structuredClone(input);
    const manuell:BelegungsFeldM={xM:.23,yM:1.1,breiteM:6.9,hoeheM:2,quer:false,leer:['0-2']};
    const raster=berechneFelderRaster(input,[manuell]);
    const erwartet=vorschlagsFeld(input);
    for(let i=0;i<20;i++) expect(vorschlagsFeld(input)).toEqual(erwartet);
    expect(input).toEqual(vorher);
    expect(berechneFelderRaster(input,[manuell])).toEqual(raster);
    expect(manuell).toEqual({xM:.23,yM:1.1,breiteM:6.9,hoeheM:2,quer:false,leer:['0-2']});
  });
  it('prüft bei 1.900 Zellen nur Mitte und Randlagen ohne Rückschritt',()=>{
    const input:VorschlagInput={module,ausrichtung:'hoch',breiteM:58,hoeheM:68,umrissM:[[0,68],[58,68],[29,0]]};
    const basis=vollFeldGedreht(input,0),feld=vorschlagsFeld(input);
    expect([0,basis.xM,2*basis.xM].some(x=>Math.abs(x-feld.xM)<1e-8)).toBe(true);
    expect([0,basis.yM,2*basis.yM].some(y=>Math.abs(y-feld.yM)<1e-8)).toBe(true);
    expect(anzahl(input,feld)).toBeGreaterThanOrEqual(anzahl(input,basis));
  });
  it('begrenzt zusätzliche Suche ab mehr als 2.000 Rasterzellen',()=>{
    const input:VorschlagInput={module,ausrichtung:'hoch',breiteM:60,hoeheM:70,umrissM:[[0,70],[60,70],[30,0]]};
    expect(vorschlagsFeld(input)).toEqual(vollFeldGedreht(input,0));
  });
  it('begrenzt zusätzliche Suche auch bei vielen Hinderniskanten',()=>{
    const input:VorschlagInput={module,ausrichtung:'hoch',breiteM:20,hoeheM:20,umrissM:[[0,20],[20,20],[10,0]],
      hindernisseM:Array.from({length:50},(_,i)=>({xM:i*.1,yM:5,breiteM:.08,hoeheM:.08}))};
    expect(vorschlagsFeld(input)).toEqual(vollFeldGedreht(input,0));
  });
  it('liefert bei einer zu kleinen Fläche weiterhin ein leeres Feld',()=>{
    const input:VorschlagInput={module,ausrichtung:'hoch',breiteM:1,hoeheM:1,umrissM:[[0,1],[1,1],[.5,0]]};
    expect(vorschlagsFeld(input)).toEqual(vollFeldGedreht(input,0));
    expect(anzahl(input,vorschlagsFeld(input))).toBe(0);
  });
});
