import { describe, expect, it } from 'vitest';
import { regularisiereModulViereck } from './modul-assets';

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
});
