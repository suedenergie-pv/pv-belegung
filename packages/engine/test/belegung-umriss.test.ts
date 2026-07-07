import { describe, expect, it } from 'vitest';
import { berechneRaster, type BelegungInput } from '../src/belegung';
import { trapezUmriss } from '../src/geometrie';
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

// Default: reines Filtern (Optimierung aus), damit die Filter-Tests unbeeinflusst
// bleiben. Die Optimierer-Tests schalten optimierePosition: true explizit an.
function raster(over: Partial<BelegungInput> = {}) {
  return berechneRaster({
    breiteM: 5,
    hoeheM: 3,
    module: TESTMODUL,
    ausrichtung: 'quer',
    randM: 0,
    fugeM: 0,
    optimierePosition: false,
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

describe('trapezUmriss — parametrische Dachform (SPEC §9, 06.07.2026)', () => {
  it('symmetrisches Trapez: Traufe unten voll, First oben zentriert schmaler', () => {
    expect(trapezUmriss(5, 3, 3)).toEqual([
      [1, 0],
      [4, 0],
      [5, 3],
      [0, 3],
    ]);
  });

  it('firstBreiteM = 0 → Dreiecksspitze (Walm), nur 3 Ecken', () => {
    expect(trapezUmriss(6, 4, 0)).toEqual([
      [3, 0],
      [6, 4],
      [0, 4],
    ]);
  });

  it('firstBreiteM wird auf breiteM gedeckelt (kein invertiertes Trapez)', () => {
    expect(trapezUmriss(5, 3, 99)).toEqual([
      [0, 0],
      [5, 0],
      [5, 3],
      [0, 3],
    ]);
  });

  it('als Umriss in berechneRaster (reines Filtern): Trapez schneidet obere Randspalten weg', () => {
    const r = raster({ umrissM: trapezUmriss(5, 3, 3) });
    expect(keys(r)).toEqual(['0-1', '0-2', '0-3', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
  });
});

describe('Positions-Optimierung: ganzes Raster als Block verschieben, Spalten ausgerichtet (SPEC §9)', () => {
  it('verschiebt den ganzen Block, wenn dadurch je Reihe ein Modul mehr passt', () => {
    // Fläche 5,5 breit → 5 Spalten, Slack 0,5, zentriert x0=0,25. Umriss rechts
    // versetzt [0,5 .. 5,5]: zentriert passen nur 4 (col0 links außerhalb); der ganze
    // Block 0,25 nach rechts → 5 Module je Reihe, Spalten bleiben ausgerichtet.
    const r = raster({
      breiteM: 5.5,
      optimierePosition: true,
      umrissM: [[0.5, 0], [5.5, 0], [5.5, 3], [0.5, 3]],
    });
    // 3 Reihen × 5 = 15, alle Reihen an denselben x-Positionen (ausgerichtet)
    expect(r.positionen).toHaveLength(15);
    const reihe0 = r.positionen.filter((p) => p.row === 0).map((p) => Math.round(p.xM * 100) / 100);
    const reihe2 = r.positionen.filter((p) => p.row === 2).map((p) => Math.round(p.xM * 100) / 100);
    expect(reihe0).toEqual([0.5, 1.5, 2.5, 3.5, 4.5]);
    expect(reihe2).toEqual(reihe0); // reihenübergreifend ausgerichtet, kein Versatz
  });

  it('symmetrisches Trapez bleibt zentriert und ausgerichtet (kein Reihen-Versatz)', () => {
    // Alle Reihen an denselben Spalten (1,2,3) — sauberer ausgerichteter Block.
    const r = raster({ optimierePosition: true, umrissM: trapezUmriss(5, 3, 3) });
    expect(keys(r)).toEqual(['0-1', '0-2', '0-3', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
  });

  it('Rechteck (kein Umriss) wird NIE verschoben, auch mit Optimierung an', () => {
    const r = raster({ optimierePosition: true });
    expect(keys(r)).toEqual([
      '0-0', '0-1', '0-2', '0-3', '0-4',
      '1-0', '1-1', '1-2', '1-3', '1-4',
      '2-0', '2-1', '2-2', '2-3', '2-4',
    ]);
  });

  it('schräges Parallelogramm (komplexes Dach): reihenweiser Versatz greift für deutlich mehr Module', () => {
    // Streifen mit 0,5 Versatz je Reihe — ausgerichtet passen nur 6, der Treppen-
    // Versatz (folgt der Schräge) fasst 8. Über der Schwelle → reihenweise.
    const par: [number, number][] = [[0, 0], [2.5, 0], [4.5, 4], [2, 4]];
    const opt = raster({ breiteM: 8, hoeheM: 4, optimierePosition: true, umrissM: par });
    const nurAusgerichtet = raster({ breiteM: 8, hoeheM: 4, optimierePosition: false, umrissM: par });
    expect(nurAusgerichtet.positionen).toHaveLength(6);
    expect(opt.positionen).toHaveLength(8);
    const xrow = (r: number, res: ReturnType<typeof berechneRaster>) =>
      res.positionen.filter((p) => p.row === r).map((p) => Math.round(p.xM * 100) / 100);
    expect(xrow(0, opt)).toEqual([0.5, 1.5]);
    expect(xrow(3, opt)).toEqual([2, 3]); // je Reihe 0,5 nach rechts — sauberer Treppen-Versatz
  });
});
