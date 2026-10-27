import { describe, expect, it } from 'vitest';
import { berechneFelderRaster, feldSchrittmasse, flachdachMindestPitch, montageGeometrie, modulEcken, posKey, vollFeld, type FlachdachMontage } from '../src/belegung';
import { JOLYWOOD_JW_HD96N_R2_460 as M } from '../src/catalog/modules';
import { polygonImUmriss, konvexePolygoneUeberlappen, rechteckeUeberlappen } from '../src/geometrie';

const faelle = (['sued', 'ostwest'] as const).flatMap(aufstaenderung =>
  (['hoch', 'quer'] as const).flatMap(modulAusrichtung =>
    ([0, 5, 10, 12.5, 15, 20, 25, 30, 35, 45, 60, 75]).flatMap(winkelDeg =>
      ([1, 2, 3, 4, 5, 6]).flatMap(moduleInNeigung =>
        (['unten', 'links', 'oben', 'rechts'] as const).map(richtungSued =>
          ({ aufstaenderung, modulAusrichtung, winkelDeg, moduleInNeigung, richtungSued }))))));
describe('Halle und Freifläche: unabhängige geometrische Testmatrix', () => {
  it.each(faelle)('$aufstaenderung $modulAusrichtung $winkelDeg° ×$moduleInNeigung Süden $richtungSued', m => {
    // Analytischer Referenzfall mit exakt drei Tischen und vier Modulen nebeneinander.
    // Absichtlich keine Engine-Hilfsfunktion für erwartete Abmessung oder Modulzahl.
    const cos = Math.cos(m.winkelDeg * Math.PI / 180);
    const l = (m.modulAusrichtung === 'hoch' ? M.lengthMm : M.widthMm) / 1000;
    const q = (m.modulAusrichtung === 'hoch' ? M.widthMm : M.lengthMm) / 1000;
    const n = m.moduleInNeigung, seiten = m.aufstaenderung === 'ostwest' ? 2 : 1;
    const tisch = (n * l + (n - 1) * .02) * cos;
    const footprint = seiten * tisch + (seiten - 1) * .05;
    const pitchM = footprint + .8;
    const montage: FlachdachMontage = { ...m, pitchM };
    const profil = montageGeometrie(M, montage, .02);
    const sin = Math.sin(m.winkelDeg * Math.PI / 180);
    expect(profil.modulHoeheM).toBeCloseTo(l * sin, 10);
    expect(profil.schrittHoeheM).toBeCloseTo((l + .02) * sin, 10);
    expect(profil.hoeheM).toBeCloseTo((n * l + (n - 1) * .02) * sin, 10);
    const suedVertikal = m.richtungSued === 'oben' || m.richtungSued === 'unten';
    const vertikal = m.aufstaenderung === 'sued' ? suedVertikal : !suedVertikal;
    const b = 4 * q + 3 * .02 + .001, h = 2 * pitchM + footprint + .001;
    const input = { module: M, breiteM: vertikal ? b : h, hoeheM: vertikal ? h : b, randM: 0, fugeM: .02, montage };
    const feld = { xM: 0, yM: 0, breiteM: input.breiteM, hoeheM: input.hoeheM, quer: true };
    const r = berechneFelderRaster(input, [feld]);
    expect(r.positionen).toHaveLength(3 * 4 * n * seiten);
    expect(new Set(r.positionen.map(posKey)).size).toBe(r.positionen.length);
    for (const p of r.positionen) {
      expect(p.wM * p.hM).toBeCloseTo(M.lengthMm * M.widthMm / 1e6 * cos, 8);
      expect(p.xM).toBeGreaterThanOrEqual(0); expect(p.yM).toBeGreaterThanOrEqual(0);
      expect(p.xM + p.wM).toBeLessThanOrEqual(input.breiteM + 1e-8);
      expect(p.yM + p.hM).toBeLessThanOrEqual(input.hoeheM + 1e-8);
    }
    if (seiten === 2) {
      expect(r.positionen.filter(p => p.seite === 'ost')).toHaveLength(r.positionen.length / 2);
      expect(r.positionen.filter(p => p.seite === 'west')).toHaveLength(r.positionen.length / 2);
    }
    const schritt = feldSchrittmasse(input, true);
    expect(vertikal ? schritt.pitchYM : schritt.pitchXM).toBeCloseTo(pitchM);
    expect(vertikal ? schritt.rowsJeSchrittY : schritt.colsJeSchrittX).toBe(n * seiten);
    const loch = r.positionen[Math.floor(r.positionen.length / 2)]!;
    const mitLoch = berechneFelderRaster(input, [{ ...feld, leer: [`${loch.row}-${loch.col}`] }]);
    expect(mitLoch.positionen).toHaveLength(r.positionen.length - 1);
    expect(mitLoch.positionen.some(p => posKey(p) === posKey(loch))).toBe(false);
    expect(berechneFelderRaster(input, [vollFeld({ ...input, ausrichtung: 'hoch' })]).positionen).toHaveLength(r.positionen.length);
  });
});

describe('Montagetische: Grenzen, Fugen und große Anlagen', () => {
  it.each([-1, 76, 90, NaN, Infinity])('weist unzulässigen Winkel %s ohne Schleife oder Platzierung ab', winkelDeg => {
    const montage = { aufstaenderung: 'sued' as const, winkelDeg, pitchM: 3 };
    expect(montageGeometrie(M, montage).gueltig).toBe(false);
    expect(berechneFelderRaster({ module: M, breiteM: 20, hoeheM: 20, montage }, [{ xM: 0, yM: 0, breiteM: 20, hoeheM: 20, quer: true }]).positionen).toEqual([]);
  });
  it.each([0, -1, 1.5, 7, Infinity])('weist ungültige Tischgröße %s ab', moduleInNeigung => {
    expect(montageGeometrie(M, { aufstaenderung: 'ostwest', winkelDeg: 10, moduleInNeigung }).gueltig).toBe(false);
  });
  it('projiziert Fugen mit und überlappt auch bei zu kleinem importiertem Pitch nie', () => {
    const montage: FlachdachMontage = { aufstaenderung: 'ostwest', winkelDeg: 35, pitchM: .1, moduleInNeigung: 3, modulAusrichtung: 'hoch' };
    const input = { module: M, breiteM: 24, hoeheM: 12, randM: .1, fugeM: .04, montage };
    const r = berechneFelderRaster(input, [vollFeld({ ...input, ausrichtung: 'hoch' })]);
    expect(r.positionen.length).toBeGreaterThan(40);
    const rect = (p: typeof r.positionen[number]) => ({ xM: p.xM, yM: p.yM, breiteM: p.wM, hoeheM: p.hM });
    for (let i = 0; i < r.positionen.length; i++) for (let j = i + 1; j < r.positionen.length; j++) {
      expect(rechteckeUeberlappen(rect(r.positionen[i]!), rect(r.positionen[j]!))).toBe(false);
    }
    expect(flachdachMindestPitch(M, montage, .04)).toBeCloseTo(2 * (3 * 1.762 + 2 * .04) * Math.cos(35 * Math.PI / 180) + .05, 10);
  });
  it('füllt große Hallen/Freiflächen ohne Spread-Stacküberlauf', () => {
    const input = { module: M, breiteM: 600, hoeheM: 500, randM: 0, montage: { aufstaenderung: 'sued' as const, winkelDeg: 25, pitchM: 5, moduleInNeigung: 2, modulAusrichtung: 'hoch' as const } };
    const feld = vollFeld({ ...input, ausrichtung: 'hoch' });
    expect(feld.breiteM).toBeLessThanOrEqual(600);
    expect(feld.hoeheM).toBeLessThanOrEqual(500);
    expect(Number.isFinite(feld.xM + feld.yM)).toBe(true);
  });
});

describe('Mehrreihige Tische: freie Drehung und Hindernisse', () => {
  const winkel = [-180,-91,-45,-15,0,7.5,35,89,135,180];
  it.each(winkel.flatMap(drehungDeg=>(['sued','ostwest'] as const).flatMap(aufstaenderung=>([10,25,45]).map(winkelDeg=>({drehungDeg,aufstaenderung,winkelDeg})))))('$aufstaenderung $winkelDeg° gedreht $drehungDeg° bleibt im Plan und kollisionsfrei',fall=>{
    const umriss:[number,number][]=[[0,0],[30,0],[30,20],[22,20],[22,30],[0,30]];
    const hindernis:[number,number][]=[[12,12],[16,12],[16,16],[12,16]];
    const montage:FlachdachMontage={aufstaenderung:fall.aufstaenderung,winkelDeg:fall.winkelDeg,pitchM:8,moduleInNeigung:2,modulAusrichtung:'hoch'};
    const input={breiteM:30,hoeheM:30,module:M,randM:0,umrissM:umriss,hindernisseM:[{xM:12,yM:12,breiteM:4,hoeheM:4}],montage};
    const feld={xM:7,yM:7,breiteM:16,hoeheM:16,quer:false,drehungDeg:fall.drehungDeg,leer:['0-0']};
    const r=berechneFelderRaster(input,[feld,{...feld,xM:10,yM:9}]);
    expect(r.positionen.length).toBeGreaterThan(10);
    for(const p of r.positionen){
      const e=modulEcken(p);
      expect(polygonImUmriss(e,umriss,0)).toBe(true);
      expect(konvexePolygoneUeberlappen(e,hindernis)).toBe(false);
    }
    for(let i=0;i<r.positionen.length;i++)for(let j=i+1;j<r.positionen.length;j++){
      expect(konvexePolygoneUeberlappen(modulEcken(r.positionen[i]!),modulEcken(r.positionen[j]!))).toBe(false);
    }
  });
});
