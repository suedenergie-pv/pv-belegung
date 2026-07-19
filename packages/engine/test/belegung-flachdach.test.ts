import { describe, expect, it } from 'vitest';
import {
  berechneFelderRaster,
  feldSchrittmasse,
  leerePositionen,
  vollFeld,
  type BelegungsFeldM,
  type FelderInput,
  type FlachdachMontage,
} from '../src/belegung';
import { rechteckeUeberlappen } from '../src/geometrie';
import { JOLYWOOD_JW_HD96N_R2_460 } from '../src/catalog/modules';

/**
 * Flachdach-Aufständerung (16.07.2026), System PROFINESS Flat (Montageanleitung
 * 05/2025 im Repo, Modulrahmen 1050–1170 mm, nur QUER):
 * - Ost-West 10°: Paar-Pitch 2,48 m (2er-Gestell 2,48 / 4er 4,96 → bündig)
 * - Süd 10°: Reihen-Pitch 1,80 m (Querschnitte 1,55/3,35/5,15/6,95)
 * - Süd 15°: Reihen-Pitch 1,90 m (1,50/3,39/5,29)
 * Modul Jolywood 1762 × 1134 mm; Fußabdruck-Tiefe = 1,134·cos(winkel).
 */
const M = JOLYWOOD_JW_HD96N_R2_460;
const TIEFE_10 = 1.134 * Math.cos((10 * Math.PI) / 180); // ≈ 1,1168 m

const OW: FlachdachMontage = { aufstaenderung: 'ostwest', winkelDeg: 10, pitchM: 2.48 };
const SUED10: FlachdachMontage = { aufstaenderung: 'sued', winkelDeg: 10, pitchM: 1.8 };

const dachOW: FelderInput = { breiteM: 12, hoeheM: 8, module: M, montage: OW };
const dachSued: FelderInput = { breiteM: 12, hoeheM: 8, module: M, montage: SUED10 };

describe('Flachdach Ost-West (PROFINESS Flat, 10°)', () => {
  it('Feld für 2 Paare × 2 Reihen → 8 Module, Paar-Pitch exakt 2,48 m', () => {
    // Paar-Bautiefe = 2·1,1168 + 0,05 ≈ 2,284 m; 2 Paare brauchen 2,48 + 2,284
    const feld: BelegungsFeldM = { xM: 1, yM: 1, breiteM: 4.96, hoeheM: 3.6, quer: true };
    const r = berechneFelderRaster(dachOW, [feld]);
    expect(r.positionen).toHaveLength(8); // 2 Paare × 2 Module × 2 Reihen
    // Ost-Module der beiden Paare liegen exakt 2,48 m auseinander
    const ostReihe0 = r.positionen.filter((p) => p.seite === 'ost' && p.row === 0);
    expect(ostReihe0).toHaveLength(2);
    expect(ostReihe0[1]!.xM - ostReihe0[0]!.xM).toBeCloseTo(2.48, 6);
    // Fußabdruck = projizierte Modulbreite, Länge = volle Modullänge
    expect(ostReihe0[0]!.wM).toBeCloseTo(TIEFE_10, 4);
    expect(ostReihe0[0]!.hM).toBeCloseTo(1.762, 6);
  });

  it('jedes Paar hat Ost- und West-Seite, getrennt durch den Firstspalt', () => {
    const feld: BelegungsFeldM = { xM: 1, yM: 1, breiteM: 2.48, hoeheM: 1.8, quer: true };
    const r = berechneFelderRaster(dachOW, [feld]);
    expect(r.positionen).toHaveLength(2);
    const [west, ost] = r.positionen;
    expect(west!.seite).toBe('west');
    expect(ost!.seite).toBe('ost');
    expect(ost!.xM - (west!.xM + west!.wM)).toBeCloseTo(0.05, 6); // Firstspalt
  });

  it('keine Modul-Überlappungen, leer-Zellen wirken je Einzelmodul', () => {
    const feld: BelegungsFeldM = {
      xM: 1, yM: 1, breiteM: 4.96, hoeheM: 3.6, quer: true,
      leer: ['0-0'], // West-Modul des ersten Paars, erste Reihe
    };
    const r = berechneFelderRaster(dachOW, [feld]);
    expect(r.positionen).toHaveLength(7);
    expect(r.positionen.some((p) => p.row === 0 && p.col === 0)).toBe(false);
    for (let i = 0; i < r.positionen.length; i++) {
      for (let j = i + 1; j < r.positionen.length; j++) {
        const a = r.positionen[i]!;
        const b = r.positionen[j]!;
        expect(
          rechteckeUeberlappen(
            { xM: a.xM, yM: a.yM, breiteM: a.wM, hoeheM: a.hM },
            { xM: b.xM, yM: b.yM, breiteM: b.wM, hoeheM: b.hM },
          ),
        ).toBe(false);
      }
    }
    // Geist der leer-Zelle erscheint an der West-Position
    const geister = leerePositionen(dachOW, [feld]);
    expect(geister).toHaveLength(1);
    expect(geister[0]!.seite).toBe('west');
  });

  it('Kompasswahl dreht das Raster und ordnet Ost/West richtig zu', () => {
    const feldHorizontal: BelegungsFeldM = {
      xM: 1,
      yM: 1,
      breiteM: 2.48,
      hoeheM: 1.8,
      quer: true,
    };
    const nachOben = berechneFelderRaster(
      { ...dachOW, montage: { ...OW, richtungSued: 'oben' } },
      [feldHorizontal],
    ).positionen;
    expect(nachOben.map((p) => p.seite)).toEqual(['ost', 'west']);

    const feldVertikal: BelegungsFeldM = {
      xM: 1,
      yM: 1,
      breiteM: 1.8,
      hoeheM: 2.48,
      quer: true,
    };
    const nachRechts = berechneFelderRaster(
      { ...dachOW, montage: { ...OW, richtungSued: 'rechts' } },
      [feldVertikal],
    ).positionen;
    expect(nachRechts.map((p) => p.seite)).toEqual(['ost', 'west']);
    expect(nachRechts[0]!.yM).toBeLessThan(nachRechts[1]!.yM);
    expect(nachRechts[0]!.wM).toBeCloseTo(1.762, 6);
    expect(nachRechts[0]!.hM).toBeCloseTo(TIEFE_10, 4);

    const nachLinks = berechneFelderRaster(
      { ...dachOW, montage: { ...OW, richtungSued: 'links' } },
      [feldVertikal],
    ).positionen;
    expect(nachLinks.map((p) => p.seite)).toEqual(['west', 'ost']);
  });

  it('vollFeld O/W: 12×8-Dach mit 0,60 m Rand → 4 Paare × 4 Reihen = 32 Module', () => {
    // Nutz 10,8 × 6,8: Paare = 1+floor((10,8−2,284)/2,48) = 4; Reihen = floor(6,82/1,782) = 3
    const f = vollFeld({ ...dachOW, randM: 0.6, ausrichtung: 'quer' });
    const r = berechneFelderRaster({ ...dachOW, randM: 0.6 }, [f]);
    const paare = new Set(r.positionen.map((p) => Math.floor(p.col / 2))).size;
    const reihen = new Set(r.positionen.map((p) => p.row)).size;
    expect(paare).toBe(4);
    expect(reihen).toBe(3);
    expect(r.positionen).toHaveLength(4 * 2 * 3);
  });
});

describe('Flachdach Süd (PROFINESS Flat, 10°/15°)', () => {
  it('Reihen-Pitch 1,80 m: Feldtiefe 1,12 m = 1 Reihe, 2,92 m = 2 Reihen', () => {
    const eine: BelegungsFeldM = { xM: 1, yM: 1, breiteM: 5.4, hoeheM: 1.12, quer: true };
    expect(new Set(berechneFelderRaster(dachSued, [eine]).positionen.map((p) => p.row)).size).toBe(1);
    const zwei: BelegungsFeldM = { ...eine, hoeheM: TIEFE_10 + 1.8 };
    const r = berechneFelderRaster(dachSued, [zwei]);
    expect(new Set(r.positionen.map((p) => p.row)).size).toBe(2);
    const y = [...new Set(r.positionen.map((p) => p.yM))].sort((a, b) => a - b);
    expect(y[1]! - y[0]!).toBeCloseTo(1.8, 6); // Gestell-Pitch, nicht Modulmaß
  });

  it('Module liegen quer mit projizierter Tiefe (cos 10°)', () => {
    const feld: BelegungsFeldM = { xM: 1, yM: 1, breiteM: 5.4, hoeheM: 1.12, quer: true };
    const p = berechneFelderRaster(dachSued, [feld]).positionen[0]!;
    expect(p.wM).toBeCloseTo(1.762, 6);
    expect(p.hM).toBeCloseTo(TIEFE_10, 4);
    expect(p.seite).toBeUndefined();
  });

  it('Südrichtung rechts dreht Reihen-Pitch und Modulfußabdruck in die x-Achse', () => {
    const feld: BelegungsFeldM = { xM: 1, yM: 1, breiteM: 3, hoeheM: 1.8, quer: true };
    const r = berechneFelderRaster(
      { ...dachSued, montage: { ...SUED10, richtungSued: 'rechts' } },
      [feld],
    );
    const x = [...new Set(r.positionen.map((p) => p.xM))].sort((a, b) => a - b);
    expect(x[1]! - x[0]!).toBeCloseTo(1.8, 6);
    expect(r.positionen[0]!.wM).toBeCloseTo(TIEFE_10, 4);
    expect(r.positionen[0]!.hM).toBeCloseTo(1.762, 6);
  });

  it('15° baut flacher (cos 15°) und braucht mehr Pitch', () => {
    const sued15: FlachdachMontage = { aufstaenderung: 'sued', winkelDeg: 15, pitchM: 1.9 };
    const feld: BelegungsFeldM = { xM: 1, yM: 1, breiteM: 5.4, hoeheM: 5, quer: true };
    const r = berechneFelderRaster({ ...dachSued, montage: sued15 }, [feld]);
    expect(r.positionen[0]!.hM).toBeCloseTo(1.134 * Math.cos((15 * Math.PI) / 180), 4);
    const y = [...new Set(r.positionen.map((p) => p.yM))].sort((a, b) => a - b);
    expect(y[1]! - y[0]!).toBeCloseTo(1.9, 6);
  });

  it('Hindernis (Lichtkuppel) entfernt die schneidenden Module', () => {
    const mitKuppel: FelderInput = {
      ...dachSued,
      hindernisseM: [{ xM: 3, yM: 2.5, breiteM: 1, hoeheM: 1 }],
    };
    const feld: BelegungsFeldM = { xM: 0.6, yM: 0.6, breiteM: 10.8, hoeheM: 6.8, quer: true };
    const ohne = berechneFelderRaster(dachSued, [feld]).positionen.length;
    const mit = berechneFelderRaster(mitKuppel, [feld]).positionen.length;
    expect(mit).toBeLessThan(ohne);
  });
});

describe('feldSchrittmasse — Einrasten beim Größenziehen', () => {
  it('flach: Modulmaß + Fuge, 1 Spalte je Schritt', () => {
    const sm = feldSchrittmasse({ module: M }, true);
    expect(sm.pitchXM).toBeCloseTo(1.782, 6);
    expect(sm.pitchYM).toBeCloseTo(1.154, 6);
    expect(sm.colsJeSchrittX).toBe(1);
    expect(sm.rowsJeSchrittY).toBe(1);
  });

  it('Süd: y-Schritt = Gestell-Pitch (nicht Modulmaß!)', () => {
    const sm = feldSchrittmasse({ module: M, montage: SUED10 }, true);
    expect(sm.pitchXM).toBeCloseTo(1.782, 6);
    expect(sm.pitchYM).toBeCloseTo(1.8, 6);
    expect(sm.colsJeSchrittX).toBe(1);
    expect(sm.rowsJeSchrittY).toBe(1);
  });

  it('Ost-West: x-Schritt = Paar-Pitch 2,48, ein Schritt = 2 Zell-Spalten', () => {
    const sm = feldSchrittmasse({ module: M, montage: OW }, true);
    expect(sm.pitchXM).toBeCloseTo(2.48, 6);
    expect(sm.pitchYM).toBeCloseTo(1.782, 6);
    expect(sm.colsJeSchrittX).toBe(2);
    expect(sm.rowsJeSchrittY).toBe(1);
  });

  it('gedrehtes Ost-West: y-Schritt = Paar-Pitch, zwei Zell-Zeilen je Schritt', () => {
    const sm = feldSchrittmasse({ module: M, montage: { ...OW, richtungSued: 'rechts' } }, true);
    expect(sm.pitchXM).toBeCloseTo(1.782, 6);
    expect(sm.pitchYM).toBeCloseTo(2.48, 6);
    expect(sm.colsJeSchrittX).toBe(1);
    expect(sm.rowsJeSchrittY).toBe(2);
  });

  it('Beweis der Invariante: Feld links um einen Schritt gewachsen → alte O/W-Module stehen exakt', () => {
    const feld: BelegungsFeldM = { xM: 4, yM: 1, breiteM: 4.96, hoeheM: 1.8, quer: true };
    const vorher = berechneFelderRaster(dachOW, [feld]).positionen;
    const sm = feldSchrittmasse({ module: M, montage: OW }, true);
    const gewachsen: BelegungsFeldM = { ...feld, xM: 4 - sm.pitchXM, breiteM: 4.96 + sm.pitchXM };
    const nachher = berechneFelderRaster(dachOW, [gewachsen]).positionen;
    expect(nachher.length).toBe(vorher.length + 2); // ein Paar mehr
    for (const p of vorher) {
      expect(nachher.some((q) => Math.abs(q.xM - p.xM) < 1e-9 && Math.abs(q.yM - p.yM) < 1e-9)).toBe(true);
    }
  });
});

describe('Fassade = flache Belegung mit 90° (kein Engine-Sonderfall)', () => {
  it('Fassaden-Fläche belegt wie ein Schrägdach (Raster mit Fuge)', () => {
    // 8 m breite, 3 m hohe Wand, Module quer
    const wand: FelderInput = { breiteM: 8, hoeheM: 3, module: M };
    const feld: BelegungsFeldM = { xM: 0.05, yM: 0.05, breiteM: 7.9, hoeheM: 2.9, quer: true };
    const r = berechneFelderRaster(wand, [feld]);
    expect(r.positionen).toHaveLength(4 * 2); // floor(7,92/1,782)=4 × floor(2,92/1,154)=2
  });
});
