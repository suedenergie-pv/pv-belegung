import { describe, expect, it } from 'vitest';
import { berechneRaster, besterVersatz, DEFAULT_RAND_M } from '../src/belegung';
import { JOLYWOOD_JW_HD96N_R2_460 } from '../src/catalog/modules';

const M = JOLYWOOD_JW_HD96N_R2_460; // 1762 × 1134 mm

describe('Belegungsraster (SPEC §9)', () => {
  it('Default-Randabstand ist 5 cm (Genrih 05.07.2026 — 30 cm kostete Modulreihen)', () => {
    expect(DEFAULT_RAND_M).toBe(0.05);
  });

  it('10 × 6 m, quer: 5 Spalten × 5 Reihen = 25 Module', () => {
    // nutzbar 9,9 × 5,9 m; quer 1,762 × 1,134:
    // floor((9,9+0,02)/1,782) = 5 · floor((5,9+0,02)/1,154) = 5
    const r = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'quer' });
    expect(r.cols).toBe(5);
    expect(r.rows).toBe(5);
    expect(r.positionen).toHaveLength(25);
    expect(r.modulBreiteM).toBeCloseTo(1.762, 6);
    expect(r.modulHoeheM).toBeCloseTo(1.134, 6);
  });

  it('10 × 6 m, hoch: 8 Spalten × 3 Reihen = 24 Module', () => {
    // floor((9,9+0,02)/1,154) = 8 · floor((5,9+0,02)/1,782) = 3
    const r = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'hoch' });
    expect(r.cols).toBe(8);
    expect(r.rows).toBe(3);
    expect(r.positionen).toHaveLength(24);
  });

  it('3 Hochkant-Reihen brauchen 5,43 m Sparrenlänge (3×1,762 + 2×0,02 + 2×0,05)', () => {
    // Genrih-Fall 05.07.: bei 5,40 m fehlen 2,6 cm → 2 Reihen; ab 5,43 m → 3 Reihen
    const knapp = berechneRaster({ breiteM: 10, hoeheM: 5.4, module: M, ausrichtung: 'hoch' });
    expect(knapp.rows).toBe(2);
    const passt = berechneRaster({ breiteM: 10, hoeheM: 5.43, module: M, ausrichtung: 'hoch' });
    expect(passt.rows).toBe(3);
    // mit Rand 3 cm reichen auch 5,40 m
    const kleinerRand = berechneRaster({
      breiteM: 10,
      hoeheM: 5.4,
      module: M,
      ausrichtung: 'hoch',
      randM: 0.03,
    });
    expect(kleinerRand.rows).toBe(3);
  });

  it('alle Module liegen innerhalb der Nutzfläche (Randabstand eingehalten)', () => {
    const r = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'quer' });
    for (const p of r.positionen) {
      expect(p.xM).toBeGreaterThanOrEqual(r.randM - 1e-9);
      expect(p.yM).toBeGreaterThanOrEqual(r.randM - 1e-9);
      expect(p.xM + r.modulBreiteM).toBeLessThanOrEqual(10 - r.randM + 1e-9);
      expect(p.yM + r.modulHoeheM).toBeLessThanOrEqual(6 - r.randM + 1e-9);
    }
  });

  it('zu kleine Fläche → 0 Module (kein negativer Raster)', () => {
    const r = berechneRaster({ breiteM: 1.5, hoeheM: 1, module: M, ausrichtung: 'quer' });
    expect(r.cols).toBe(0);
    expect(r.rows).toBe(0);
    expect(r.positionen).toHaveLength(0);
  });

  it('Rand und Fuge sind konfigurierbar (Admin, SPEC §9)', () => {
    // Rand 0: nutzbar 10 m → floor((10+0,1)/(1,762+0,1)) = 5
    const r = berechneRaster({
      breiteM: 10,
      hoeheM: 6,
      module: M,
      ausrichtung: 'quer',
      randM: 0,
      fugeM: 0.1,
    });
    expect(r.cols).toBe(5);
    expect(r.randM).toBe(0);
    expect(r.fugeM).toBe(0.1);
  });

  it('jede Position trägt Ausrichtung + Maße (Einheitspfad)', () => {
    const quer = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'quer' });
    for (const p of quer.positionen) {
      expect(p.quer).toBe(true);
      expect(p.wM).toBeCloseTo(1.762, 6);
      expect(p.hM).toBeCloseTo(1.134, 6);
    }
    const hoch = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'hoch' });
    for (const p of hoch.positionen) {
      expect(p.quer).toBe(false);
      expect(p.wM).toBeCloseTo(1.134, 6);
      expect(p.hM).toBeCloseTo(1.762, 6);
    }
  });
});

describe('Gemischte Ausrichtung — Bänder (SPEC §9, 07.07.2026)', () => {
  it('baender gleich der Basis = unveränderter Einheitspfad (kein Mix)', () => {
    const ohne = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'hoch' });
    const mitGleich = berechneRaster({
      breiteM: 10,
      hoeheM: 6,
      module: M,
      ausrichtung: 'hoch',
      baender: ['hoch', 'hoch', 'hoch'],
    });
    expect(mitGleich.positionen).toHaveLength(ohne.positionen.length); // 24
    expect(mitGleich.rows).toBe(ohne.rows);
  });

  it('oberstes Band quer bei sonst hoch → gemischte Höhen, weniger Module', () => {
    // Basis hoch (8×3 = 24). Band 0 → quer: quer(5) + hoch(8) + hoch(8) = 21.
    const r = berechneRaster({
      breiteM: 10,
      hoeheM: 6,
      module: M,
      ausrichtung: 'hoch',
      baender: ['quer'],
    });
    expect(r.rows).toBe(3);
    const reihe0 = r.positionen.filter((p) => p.row === 0);
    const rest = r.positionen.filter((p) => p.row > 0);
    expect(reihe0).toHaveLength(5);
    expect(reihe0.every((p) => p.quer && Math.abs(p.hM - 1.134) < 1e-6)).toBe(true);
    expect(rest.every((p) => !p.quer && Math.abs(p.hM - 1.762) < 1e-6)).toBe(true);
    expect(r.positionen).toHaveLength(21);
    expect(r.positionen.length).toBeLessThan(24); // Platz geht verloren
  });

  it('ein hohes (quer→hoch) Band drängt das unterste Band raus', () => {
    // Basis quer (5×5 = 25 Module, 5 Bänder). Band 0 → hoch (höher) → nur 4 Bänder.
    const r = berechneRaster({
      breiteM: 10,
      hoeheM: 6,
      module: M,
      ausrichtung: 'quer',
      baender: ['hoch'],
    });
    expect(r.rows).toBe(4); // von 5 auf 4 Bänder
    const reihe0 = r.positionen.filter((p) => p.row === 0);
    expect(reihe0).toHaveLength(8);
    expect(reihe0.every((p) => !p.quer)).toBe(true);
    expect(r.positionen.filter((p) => p.row > 0).every((p) => p.quer)).toBe(true);
    expect(r.positionen).toHaveLength(23); // hoch(8) + 3× quer(5)
  });

  it('Bänder halten den Randabstand ein', () => {
    const r = berechneRaster({
      breiteM: 10,
      hoeheM: 6,
      module: M,
      ausrichtung: 'hoch',
      baender: ['quer'],
    });
    for (const p of r.positionen) {
      expect(p.xM).toBeGreaterThanOrEqual(r.randM - 1e-9);
      expect(p.yM).toBeGreaterThanOrEqual(r.randM - 1e-9);
      expect(p.xM + p.wM).toBeLessThanOrEqual(10 - r.randM + 1e-9);
      expect(p.yM + p.hM).toBeLessThanOrEqual(6 - r.randM + 1e-9);
    }
  });
});

describe('Manueller Versatz / Nudge (07.07.2026)', () => {
  const basis = { breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'quer' as const };
  // Hindernis, das nur Reihe0/Spalte0 streift (x 0,40..0,65) → 1 Modul entfaellt.
  const hindernis = { xM: 0.4, yM: 0.4, breiteM: 0.25, hoeheM: 0.3 };

  it('Versatz 0 aendert die Standardbelegung (Rechteck) nicht', () => {
    const ohne = berechneRaster(basis);
    const mit0 = berechneRaster({ ...basis, versatzXM: 0, versatzYM: 0 });
    expect(mit0.positionen).toHaveLength(ohne.positionen.length); // 25
  });

  it('Verschieben befreit ein vom Hindernis gestreiftes Modul', () => {
    const voll = berechneRaster(basis).positionen.length; // 25
    const gestreift = berechneRaster({ ...basis, hindernisseM: [hindernis] });
    expect(gestreift.positionen.length).toBe(voll - 1); // 24
    // 10 cm nach rechts → Modul frei, wieder voll belegt
    const verschoben = berechneRaster({ ...basis, hindernisseM: [hindernis], versatzXM: 0.1 });
    expect(verschoben.positionen.length).toBe(voll); // 25
  });

  it('besterVersatz findet die Lage mit den meisten Modulen', () => {
    const input = { ...basis, hindernisseM: [hindernis] };
    const best = besterVersatz(input);
    const voll = berechneRaster(basis).positionen.length; // 25
    const r = berechneRaster({ ...input, versatzXM: best.versatzXM, versatzYM: best.versatzYM });
    expect(r.positionen.length).toBe(voll); // Hindernis umgangen
  });

  it('Versatz bleibt in der Zone (Randabstand eingehalten)', () => {
    const r = berechneRaster({ ...basis, versatzXM: 0.3, versatzYM: -0.2 });
    expect(r.positionen.length).toBeGreaterThan(0);
    for (const p of r.positionen) {
      expect(p.xM).toBeGreaterThanOrEqual(r.randM - 1e-9);
      expect(p.yM).toBeGreaterThanOrEqual(r.randM - 1e-9);
      expect(p.xM + p.wM).toBeLessThanOrEqual(10 - r.randM + 1e-9);
      expect(p.yM + p.hM).toBeLessThanOrEqual(6 - r.randM + 1e-9);
    }
  });
});
