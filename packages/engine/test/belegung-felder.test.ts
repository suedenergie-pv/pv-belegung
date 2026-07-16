import { describe, expect, it } from 'vitest';
import {
  berechneFelderRaster,
  posKey,
  vollFeld,
  type BelegungsFeldM,
  type FelderInput,
} from '../src/belegung';
import { rechteckeUeberlappen, trapezUmriss } from '../src/geometrie';
import { JOLYWOOD_JW_HD96N_R2_460 } from '../src/catalog/modules';

/**
 * Belegungsfelder (16.07.2026, Genrih): der Nutzer zieht Rechtecke, die sich mit
 * Modulen füllen — kein Optimierer, keine automatische Vollbelegung. Modul
 * 1762 × 1134 mm; quer = 1,762 × 1,134 m, Fuge 0,02 m, Rand 0,05 m.
 */
const M = JOLYWOOD_JW_HD96N_R2_460;
const dach: FelderInput = { breiteM: 10, hoeheM: 6, module: M };

/** Feldgröße, die exakt cols × rows Module fasst (quer). */
const groesseQuer = (cols: number, rows: number) => ({
  breiteM: cols * 1.762 + (cols - 1) * 0.02,
  hoeheM: rows * 1.134 + (rows - 1) * 0.02,
});

const feld = (xM: number, yM: number, cols: number, rows: number): BelegungsFeldM => ({
  xM,
  yM,
  ...groesseQuer(cols, rows),
  quer: true,
});

/** Paarweise Modul-Überlappungen im Ergebnis (muss immer 0 sein). */
const ueberlappungen = (positionen: { xM: number; yM: number; wM: number; hM: number }[]) => {
  let n = 0;
  for (let i = 0; i < positionen.length; i++) {
    for (let j = i + 1; j < positionen.length; j++) {
      const a = positionen[i]!;
      const b = positionen[j]!;
      if (
        rechteckeUeberlappen(
          { xM: a.xM, yM: a.yM, breiteM: a.wM, hoeheM: a.hM },
          { xM: b.xM, yM: b.yM, breiteM: b.wM, hoeheM: b.hM },
        )
      ) {
        n++;
      }
    }
  }
  return n;
};

describe('berechneFelderRaster — Grundfall', () => {
  it('Feld für 2×2 Module (quer) füllt sich mit genau 4 Modulen an den erwarteten Ecken', () => {
    const r = berechneFelderRaster(dach, [feld(3, 2, 2, 2)]);
    expect(r.positionen).toHaveLength(4);
    const soll = [
      [3, 2],
      [4.782, 2],
      [3, 3.154],
      [4.782, 3.154],
    ];
    for (const [i, [x, y]] of soll.entries()) {
      expect(r.positionen[i]!.xM).toBeCloseTo(x!, 6);
      expect(r.positionen[i]!.yM).toBeCloseTo(y!, 6);
      expect(r.positionen[i]!.feld).toBe(0);
      expect(r.positionen[i]!.wM).toBeCloseTo(1.762, 6);
      expect(r.positionen[i]!.hM).toBeCloseTo(1.134, 6);
    }
    expect(r.positionen.map(posKey)).toEqual(['f0:0-0', 'f0:0-1', 'f0:1-0', 'f0:1-1']);
  });

  it('ohne Felder ist die Fläche leer (neue Fläche startet unbelegt)', () => {
    expect(berechneFelderRaster(dach, []).positionen).toHaveLength(0);
  });

  it('zu kleines Feld fasst kein Modul', () => {
    const r = berechneFelderRaster(dach, [{ xM: 3, yM: 2, breiteM: 1, hoeheM: 1, quer: true }]);
    expect(r.positionen).toHaveLength(0);
  });
});

describe('berechneFelderRaster — Zone (Rand/Umriss/Hindernis)', () => {
  it('Feld über den linken Rand hinaus: nur die innenliegenden Spalten bleiben', () => {
    // Spalte 0 läge bei x = −1 (außerhalb), Spalte 1 bei x = 0,782 (drin)
    const r = berechneFelderRaster(dach, [feld(-1, 2, 2, 2)]);
    expect(r.positionen).toHaveLength(2);
    expect(r.positionen.every((p) => p.xM >= 0.05)).toBe(true);
    expect(r.positionen.every((p) => p.col === 1)).toBe(true);
  });

  it('Feld komplett außerhalb → keine Module (Feld bleibt aber gültig)', () => {
    expect(berechneFelderRaster(dach, [feld(-5, 2, 2, 2)]).positionen).toHaveLength(0);
  });

  it('Trapez-Umriss filtert Module, die nicht komplett drinliegen', () => {
    const voll = berechneFelderRaster(dach, [feld(0.05, 0.05, 5, 5)]);
    const imTrapez = berechneFelderRaster({ ...dach, umrissM: trapezUmriss(10, 6, 4) }, [
      feld(0.05, 0.05, 5, 5),
    ]);
    expect(voll.positionen.length).toBe(25);
    expect(imTrapez.positionen.length).toBeGreaterThan(0);
    expect(imTrapez.positionen.length).toBeLessThan(voll.positionen.length);
  });

  it('Hindernis entfernt die schneidenden Module', () => {
    const ohne = berechneFelderRaster(dach, [feld(3, 2, 2, 2)]);
    const mit = berechneFelderRaster(
      { ...dach, hindernisseM: [{ xM: 3.5, yM: 2.5, breiteM: 0.2, hoeheM: 0.2 }] },
      [feld(3, 2, 2, 2)],
    );
    expect(ohne.positionen).toHaveLength(4);
    expect(mit.positionen).toHaveLength(3);
    expect(mit.positionen.some((p) => p.row === 0 && p.col === 0)).toBe(false);
  });
});

describe('berechneFelderRaster — überlappende Felder', () => {
  const a = feld(1, 1, 2, 2);
  const b = feld(2.5, 1.5, 2, 2);

  it('nie zwei Module übereinander — das frühere Feld gewinnt', () => {
    const nurB = berechneFelderRaster(dach, [b]);
    expect(nurB.positionen).toHaveLength(4); // B allein hätte Platz

    const beide = berechneFelderRaster(dach, [a, b]);
    expect(ueberlappungen(beide.positionen)).toBe(0);
    // Alle Module von A sind da, B tritt zurück
    expect(beide.positionen.filter((p) => p.feld === 0)).toHaveLength(4);
    expect(beide.positionen.filter((p) => p.feld === 1)).toHaveLength(0);
  });

  it('Reihenfolge zählt: dasselbe Paar umgekehrt lässt B gewinnen', () => {
    const r = berechneFelderRaster(dach, [b, a]);
    expect(ueberlappungen(r.positionen)).toBe(0);
    expect(r.positionen.filter((p) => p.feld === 0)).toHaveLength(4); // = B
  });
});

describe('berechneFelderRaster — gelöschte Zellen (leer)', () => {
  it('leere Zelle entfällt und bleibt beim Verschieben des Felds dieselbe Zelle', () => {
    const mitLuecke: BelegungsFeldM = { ...feld(3, 2, 2, 2), leer: ['0-1'] };
    const r = berechneFelderRaster(dach, [mitLuecke]);
    expect(r.positionen).toHaveLength(3);
    expect(r.positionen.some((p) => p.row === 0 && p.col === 1)).toBe(false);

    // Feld um 0,37 m verschoben → Loch wandert MIT (Zell-Identität, keine Geometrie)
    const verschoben = berechneFelderRaster(dach, [{ ...mitLuecke, xM: 3.37 }]);
    expect(verschoben.positionen).toHaveLength(3);
    expect(verschoben.positionen.some((p) => p.row === 0 && p.col === 1)).toBe(false);
    expect(verschoben.positionen[0]!.xM).toBeCloseTo(3.37, 6);
  });

  it('leere Zellen zurückholen = leer entfernen', () => {
    expect(berechneFelderRaster(dach, [feld(3, 2, 2, 2)]).positionen).toHaveLength(4);
  });
});

describe('berechneFelderRaster — gemischte Ausrichtung je Feld', () => {
  it('Feld quer + Feld hoch nebeneinander: Maße je Position korrekt', () => {
    const quer: BelegungsFeldM = { xM: 0.5, yM: 0.5, breiteM: 1.762, hoeheM: 1.134, quer: true };
    const hoch: BelegungsFeldM = { xM: 3, yM: 0.5, breiteM: 1.134, hoeheM: 1.762, quer: false };
    const r = berechneFelderRaster(dach, [quer, hoch]);
    expect(r.positionen).toHaveLength(2);
    const [q, h] = r.positionen as [(typeof r.positionen)[0], (typeof r.positionen)[0]];
    expect(q.quer).toBe(true);
    expect(q.wM).toBeCloseTo(1.762, 6);
    expect(q.hM).toBeCloseTo(1.134, 6);
    expect(h.quer).toBe(false);
    expect(h.wM).toBeCloseTo(1.134, 6);
    expect(h.hM).toBeCloseTo(1.762, 6);
  });
});

describe('vollFeld — „Automatisch füllen"', () => {
  it('10 × 6 quer → ein zentriertes Feld mit exakt 25 Modulen (wie die alte Vollbelegung)', () => {
    const f = vollFeld({ ...dach, ausrichtung: 'quer' });
    const r = berechneFelderRaster(dach, [f]);
    expect(r.positionen).toHaveLength(25);
    // zentriert: gleicher Abstand links wie rechts
    expect(f.xM - 0.05).toBeCloseTo(10 - 0.05 - (f.xM + f.breiteM), 6);
  });

  it('10 × 6 hoch → 24 Module (8 × 3, wie berechneRaster)', () => {
    const f = vollFeld({ ...dach, ausrichtung: 'hoch' });
    expect(berechneFelderRaster(dach, [f]).positionen).toHaveLength(24);
  });

  it('zu kleine Fläche → Feld der Größe 0 (UI legt dann keins an)', () => {
    const f = vollFeld({ breiteM: 1, hoeheM: 1, module: M, ausrichtung: 'quer' });
    expect(f.breiteM).toBe(0);
    expect(f.hoeheM).toBe(0);
  });
});
