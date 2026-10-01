import { describe, expect, it } from 'vitest';
import { berechneFelderRaster, JOLYWOOD_JW_HD96N_R2_460, leerePositionen, rechteckUeberlapptHindernis, type HindernisM } from '../src';

const diamant: HindernisM = { xM: 0, yM: 0, breiteM: 4, hoeheM: 4, umrissM: [[2, 0], [4, 2], [2, 4], [0, 2]] };
const rect = (xM: number, yM: number, breiteM = 1, hoeheM = 1) => ({ xM, yM, breiteM, hoeheM });
describe('Exakte Gauben-Aussparungen', () => {
  it('lässt Module außerhalb der Kontur trotz überlappendem Rahmen bestehen', () => {
    expect(rechteckUeberlapptHindernis(rect(0, 0), diamant)).toBe(false);
    expect(rechteckUeberlapptHindernis(rect(1, 1), diamant)).toBe(true);
  });
  it('erkennt vollständiges Einschließen in beiden Richtungen und kreuzende Kanten', () => {
    expect(rechteckUeberlapptHindernis(rect(1.5, 1.5, .2, .2), diamant)).toBe(true);
    expect(rechteckUeberlapptHindernis(rect(-1, -1, 6, 6), diamant)).toBe(true);
    expect(rechteckUeberlapptHindernis(rect(-1, 1.9, 6, .2), diamant)).toBe(true);
  });
  it('unterscheidet Kantenberührung von Überlappung in beiden Umlaufrichtungen', () => {
    const h = { ...rect(1, 1, 2, 2), umrissM: [[1, 1], [3, 1], [3, 3], [1, 3]] as const };
    for (const umrissM of [h.umrissM, [...h.umrissM].reverse()]) {
      expect(rechteckUeberlapptHindernis(rect(0, 1), { ...h, umrissM })).toBe(false);
      expect(rechteckUeberlapptHindernis(rect(.1, 1), { ...h, umrissM })).toBe(true);
      expect(rechteckUeberlapptHindernis(rect(1, 1, 2, 2), { ...h, umrissM })).toBe(true);
    }
  });
  it('berücksichtigt auch konkave Konturen ohne das ausgesparte Eck zu füllen', () => {
    const h = { ...rect(0, 0, 3, 3), umrissM: [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]] as const };
    expect(rechteckUeberlapptHindernis(rect(1.2, 1.2), h)).toBe(false);
    expect(rechteckUeberlapptHindernis(rect(.5, .5), h)).toBe(true);
  });
  it('nutzt die Kontur für belegte und ausgeschaltete Feldzellen', () => {
    const input = { breiteM: 4, hoeheM: 4, randM: 0, fugeM: 0,
      module: { ...JOLYWOOD_JW_HD96N_R2_460, widthMm: 1000, lengthMm: 1000 }, hindernisseM: [diamant] };
    const feld = { ...rect(0, 0, 4, 4), quer: false, leer: ['0-0'] };
    const raster = berechneFelderRaster(input, [feld]);
    expect(raster.positionen).toHaveLength(3);
    expect(raster.positionen.every((p) => !rechteckUeberlapptHindernis(rect(p.xM, p.yM), diamant))).toBe(true);
    expect(leerePositionen(input, [feld])).toHaveLength(1);
  });
});
