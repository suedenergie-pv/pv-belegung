import { describe, expect, it } from 'vitest';
import { berechneRaster, DEFAULT_RAND_M } from '../src/belegung';
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
});
