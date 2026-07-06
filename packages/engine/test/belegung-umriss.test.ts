import { describe, expect, it } from 'vitest';
import { berechneRaster, type BelegungInput } from '../src/belegung';
import type { ModuleType } from '../src/types';

/**
 * Polygon-Umriss + Hindernisse (SPEC §9, 06.07.2026). Synthetisches 1×1-m-Modul
 * für nachrechenbare Geometrie — elektrische Werte sind hier irrelevant, echte
 * Modulmaße kommen weiterhin nur aus dem Katalog.
 */
const TESTMODUL: ModuleType = {
  id: 'test-1x1',
  name: 'TEST 1×1 m (Fixture)',
  lengthMm: 1000,
  widthMm: 1000,
  heightMm: 30,
  weightKg: 20,
  cells: 96,
  pmaxW: 400,
  vocV: 35,
  iscA: 15,
  vmpV: 30,
  impA: 14,
  tempCoeffVocPctPerK: -0.25,
  tempCoeffPmaxPctPerK: -0.28,
  maxSystemVoltageV: 1500,
  maxSeriesFuseA: 30,
  renderSymbol: 'jolywood_niwa_black',
};

function raster(over: Partial<BelegungInput> = {}) {
  return berechneRaster({
    breiteM: 5,
    hoeheM: 3,
    module: TESTMODUL,
    ausrichtung: 'quer',
    randM: 0,
    fugeM: 0,
    ...over,
  });
}

const keys = (r: ReturnType<typeof berechneRaster>) =>
  r.positionen.map((p) => `${p.row}-${p.col}`);

describe('Umriss-Polygon filtert das Raster (SPEC §9)', () => {
  it('ohne Umriss: volles Rechteck 5×3 → 15 Module', () => {
    expect(raster().positionen).toHaveLength(15);
  });

  it('Umriss = Rechteck: identisch zum Fall ohne Umriss', () => {
    const mit = raster({ umrissM: [[0, 0], [5, 0], [5, 3], [0, 3]] });
    expect(keys(mit)).toEqual(keys(raster()));
  });

  it('Walm-Trapez (Traufe 5 m, First 3 m): schräge Grate schneiden die Randspalten weg', () => {
    // First bei y=0 von x=1 bis x=4, Traufe bei y=3 volle Breite
    const r = raster({ umrissM: [[1, 0], [4, 0], [5, 3], [0, 3]] });
    // je Reihe fallen die Spalten weg, deren obere Ecken außerhalb liegen:
    // row0 (y 0–1): Grat links bei x=1…0,67 → col0 raus; rechts 4…4,33 → col4 raus
    // row1 (y 1–2): Grat links 0,67…0,33 → col0 raus; rechts col4 raus
    // row2 (y 2–3): Grat links 0,33…0 → col0 raus; rechts col4 raus
    expect(keys(r)).toEqual(['0-1', '0-2', '0-3', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
  });

  it('6-Ecken-Umriss (Rechteck mit ausgeklinkter Ecke oben rechts)', () => {
    // Ausklinkung 2×1 m oben rechts → row0: col3+col4 raus, sonst alles drin
    const r = raster({
      umrissM: [[0, 0], [3, 0], [3, 1], [5, 1], [5, 3], [0, 3]],
    });
    expect(keys(r)).toEqual(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '1-3', '1-4', '2-0', '2-1', '2-2', '2-3', '2-4']);
  });

  it('Randabstand gilt auch zur Umrisskante (Grat), nicht nur zum Rechteckrand', () => {
    // 10 cm Rand → Nutzfläche 4,8×2,8, Raster 4×2 zentriert (x0=y0=0,5).
    // Im Trapez [1,0]-[4,0]-[5,3]-[0,3] schneiden die Grate die Außenspalten:
    // col0 (x 0,5–1,5): linke obere Ecke außerhalb; col3 (x 3,5–4,5): rechte
    // obere Ecke außerhalb → nur die mittleren 2 Spalten × 2 Reihen bleiben,
    // alle mit ≥ 10 cm Abstand zu jeder Umrisskante.
    const mitRand = raster({ randM: 0.1, umrissM: [[1, 0], [4, 0], [5, 3], [0, 3]] });
    expect(keys(mitRand)).toEqual(['0-1', '0-2', '1-1', '1-2']);
  });

  it('Umriss mit < 3 Punkten wird ignoriert (Rechteck gilt)', () => {
    const r = raster({ umrissM: [[0, 0], [5, 3]] });
    expect(r.positionen).toHaveLength(15);
  });
});

describe('Hindernis-Rechtecke entfernen schneidende Module (SPEC §9)', () => {
  it('Kamin 0,6×0,6 m mittig auf einem Modul → genau dieses Modul fehlt', () => {
    const r = raster({ hindernisseM: [{ xM: 2.2, yM: 1.2, breiteM: 0.6, hoeheM: 0.6 }] });
    expect(r.positionen).toHaveLength(14);
    expect(keys(r)).not.toContain('1-2');
  });

  it('Hindernis über Modulgrenze → beide betroffenen Module fehlen', () => {
    const r = raster({ hindernisseM: [{ xM: 1.8, yM: 1.2, breiteM: 0.6, hoeheM: 0.6 }] });
    expect(keys(r)).not.toContain('1-1');
    expect(keys(r)).not.toContain('1-2');
    expect(r.positionen).toHaveLength(13);
  });

  it('Berührung ohne Überlappung zählt nicht (Hindernis exakt an Modulkante)', () => {
    const r = raster({ hindernisseM: [{ xM: 1.0, yM: 1.0, breiteM: 1.0, hoeheM: 1.0 }] });
    // Hindernis deckt exakt Modul 1-1 ab — Nachbarn berühren nur die Kante
    expect(keys(r)).not.toContain('1-1');
    expect(r.positionen).toHaveLength(14);
  });

  it('Umriss + Hindernis kombiniert', () => {
    const r = raster({
      umrissM: [[1, 0], [4, 0], [5, 3], [0, 3]],
      hindernisseM: [{ xM: 2.2, yM: 0.2, breiteM: 0.6, hoeheM: 0.6 }],
    });
    expect(keys(r)).toEqual(['0-1', '0-3', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
  });
});
