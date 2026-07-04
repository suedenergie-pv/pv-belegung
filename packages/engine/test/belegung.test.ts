import { describe, expect, it } from 'vitest';
import { berechneRaster } from '../src/belegung';
import { JOLYWOOD_JW_HD96N_R2_460 } from '../src/catalog/modules';

const M = JOLYWOOD_JW_HD96N_R2_460; // 1762 × 1134 mm

describe('Belegungsraster (SPEC §9)', () => {
  it('10 × 6 m, quer: 5 Spalten × 4 Reihen = 20 Module', () => {
    // nutzbar 9,4 × 5,4 m; quer 1,762 × 1,134:
    // floor((9,4+0,02)/1,782) = 5 · floor((5,4+0,02)/1,154) = 4
    const r = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'quer' });
    expect(r.cols).toBe(5);
    expect(r.rows).toBe(4);
    expect(r.positionen).toHaveLength(20);
    expect(r.modulBreiteM).toBeCloseTo(1.762, 6);
    expect(r.modulHoeheM).toBeCloseTo(1.134, 6);
  });

  it('10 × 6 m, hoch: 8 Spalten × 3 Reihen = 24 Module', () => {
    // floor((9,4+0,02)/1,154) = 8 · floor((5,4+0,02)/1,782) = 3
    const r = berechneRaster({ breiteM: 10, hoeheM: 6, module: M, ausrichtung: 'hoch' });
    expect(r.cols).toBe(8);
    expect(r.rows).toBe(3);
    expect(r.positionen).toHaveLength(24);
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
    const r = berechneRaster({ breiteM: 2, hoeheM: 1, module: M, ausrichtung: 'quer' });
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
