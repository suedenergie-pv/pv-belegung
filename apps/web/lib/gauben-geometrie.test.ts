import { describe, expect, it } from 'vitest';
import type { Ecken } from './foto-geometrie';
import {
  gaubenAussparungAusFoto,
  gaubenMasseAusElternfoto,
  satteldachMasseAusElternfoto,
  satteldachSeitenEcken,
} from './gauben-geometrie';
import { neueFlaeche, type DachFoto } from './model';

const foto: DachFoto = {
  dataUrl: 'data:image/jpeg;base64,test',
  breitePx: 1000,
  hoehePx: 600,
  traufePx: null,
  eckenPx: [
    [0, 600],
    [1000, 600],
    [1000, 0],
    [0, 0],
  ],
};

const eltern = { ...neueFlaeche(1, 'A'), breiteM: 10, hoeheM: 6, foto };
const gaube: Ecken = [
  [200, 500],
  [600, 500],
  [600, 200],
  [200, 200],
];

describe('Gaubengeometrie im Elternfoto', () => {
  it('liefert aus der Eltern-Homographie nur einen lokalen Maß-Schätzwert', () => {
    expect(gaubenMasseAusElternfoto(eltern, gaube)).toEqual({ breiteM: 4, hoeheM: 3 });
  });

  it('erzeugt eine konservative gekoppelte Aussparung auf dem Hauptdach', () => {
    expect(gaubenAussparungAusFoto(eltern, gaube)).toEqual({
      xM: 2,
      yM: 2,
      breiteM: 4,
      hoeheM: 3,
    });
    expect(
      gaubenAussparungAusFoto(eltern, [
        [0, 600],
        [200, 600],
        [200, 500],
        [0, 500],
      ]),
    ).toMatchObject({ xM: 0 });
  });

  it('teilt eine Satteldachgaube über die Firstlinie in zwei Vierecke', () => {
    const first: [[number, number], [number, number]] = [
      [400, 180],
      [400, 520],
    ];
    const seiten = satteldachSeitenEcken(gaube, first);
    expect(seiten).not.toBeNull();
    expect(seiten!.links).toHaveLength(4);
    expect(seiten!.rechts).toHaveLength(4);
    expect(seiten!.links.flat()).toContain(400);
    expect(seiten!.rechts.flat()).toContain(400);

    const masse = satteldachMasseAusElternfoto(eltern, seiten!, first);
    expect(masse).not.toBeNull();
    expect(masse!.links.hoeheM).toBeLessThan(gaubenMasseAusElternfoto(eltern, gaube)!.hoeheM);
    expect(masse!.rechts.hoeheM).toBeLessThan(gaubenMasseAusElternfoto(eltern, gaube)!.hoeheM);
  });
});
