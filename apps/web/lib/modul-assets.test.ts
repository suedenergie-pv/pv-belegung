import { describe, expect, it } from 'vitest';
import { modulMatrixNetz, regularisiereModulViereck } from './modul-assets';

describe('Foto-Modulprojektion', () => {
  it('entfernt den trapezförmigen Gummizug bei gleichem Mittelpunkt', () => {
    const original = [
      [10, 10],
      [90, 18],
      [112, 82],
      [2, 70],
    ] as const;
    const [tl, tr, br, bl] = regularisiereModulViereck(...original);

    const mitte = (punkte: readonly (readonly [number, number])[]) => [
      punkte.reduce((sum, p) => sum + p[0], 0) / punkte.length,
      punkte.reduce((sum, p) => sum + p[1], 0) / punkte.length,
    ];

    expect(mitte([tl, tr, br, bl])).toEqual(mitte(original));
    expect(tl[0] + br[0]).toBeCloseTo(tr[0] + bl[0]);
    expect(tl[1] + br[1]).toBeCloseTo(tr[1] + bl[1]);
  });

  it('zerlegt eine starke Gaubenperspektive in ein feines statt ein diagonales Netz', () => {
    const teile = modulMatrixNetz([60, 60], [190, 60], [205, 180], [45, 180], false, 3, 4);
    expect(teile).toHaveLength(3 * 4 * 2);
    expect(teile.every((teil) => teil.matrix.startsWith('matrix('))).toBe(true);
    expect(teile.every((teil) => teil.clip.split(' ').length === 3)).toBe(true);
  });

  it('deckt das Zielviereck lückenlos mit gemeinsamen Netzpunkten ab', () => {
    const ziel = [[60, 60], [190, 75], [205, 180], [45, 170]] as const;
    const teile = modulMatrixNetz(...ziel, false, 2, 2);
    const punkte = teile.flatMap((teil) => teil.clip.split(' '));
    const enthaelt = ([x, y]: readonly [number, number]) => punkte.some((p) => {
      const [px, py] = p.split(',').map(Number);
      return Math.abs(px! - x) < 1e-8 && Math.abs(py! - y) < 1e-8;
    });
    for (const ecke of ziel) expect(enthaelt(ecke)).toBe(true);
    // Jedes innere Zellkreuz wird von allen angrenzenden Dreiecken identisch geteilt.
    const haeufigkeit = new Map<string, number>();
    punkte.forEach((p) => haeufigkeit.set(p, (haeufigkeit.get(p) ?? 0) + 1));
    expect(Math.max(...haeufigkeit.values())).toBeGreaterThanOrEqual(6);
  });

  it('dreht Querformate über exakt dieselben vier Zielecken und lehnt ungültige Netze ab', () => {
    const ziel = [[10, 20], [100, 25], [110, 90], [5, 80]] as const;
    const punkte = modulMatrixNetz(...ziel, true, 2, 2).flatMap((teil) => teil.clip.split(' '));
    const numerisch = punkte.map((p) => p.split(',').map(Number));
    for (const [x, y] of ziel) {
      expect(numerisch.some(([px, py]) => Math.abs(px! - x) < 1e-8 && Math.abs(py! - y) < 1e-8)).toBe(true);
    }
    expect(modulMatrixNetz(...ziel, false, 0, 2)).toEqual([]);
    expect(modulMatrixNetz(...ziel, false, 2.5, 2)).toEqual([]);
  });
});
