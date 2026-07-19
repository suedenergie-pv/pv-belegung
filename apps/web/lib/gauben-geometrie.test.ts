import { describe, expect, it } from 'vitest';
import { homographie, projiziere, type Ecken } from './foto-geometrie';
import {
  aktualisiereGaubenAussparungen,
  gaubenAussparungAusFoto,
  gaubenMasseAusElternfoto,
  gaubenPunkteAufElternflaeche,
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

  it('führt die gekoppelte Aussparung bei einer Perspektivkorrektur nach', () => {
    const korrigiertesFoto: DachFoto = {
      ...foto,
      eckenPx: [
        [0, 600],
        [800, 600],
        [800, 0],
        [0, 0],
      ],
    };
    const aktualisiert = aktualisiereGaubenAussparungen(
      { ...eltern, foto: korrigiertesFoto },
      [{
        gaubenGruppeId: 'g1',
        rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 },
        fotoEckenPx: gaube,
      }],
    );
    expect(aktualisiert?.[0]?.rechteck).toEqual({
      xM: 2.5,
      yM: 2,
      breiteM: 5,
      hoeheM: 3,
    });
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

  it('ordnet Satteldachseiten auch im gedrehten Foto entlang der Muttertraufachse', () => {
    const gedrehteEcken: Ecken = [
      [100, 100],
      [100, 500],
      [500, 500],
      [500, 100],
    ];
    const elternGedreht = { ...eltern, foto: { ...foto, eckenPx: gedrehteEcken } };
    const h = homographie(10, 6, gedrehteEcken)!;
    const p = (x: number, y: number) => projiziere(h, [x, y]);
    const aussenGedreht = [p(2, 5), p(8, 5), p(8, 1), p(2, 1)] as Ecken;
    const firstGedreht: [[number, number], [number, number]] = [p(5, 1), p(5, 5)];
    const seiten = satteldachSeitenEcken(aussenGedreht, firstGedreht, elternGedreht)!;
    const linksM = gaubenPunkteAufElternflaeche(elternGedreht, seiten.links)!;
    const rechtsM = gaubenPunkteAufElternflaeche(elternGedreht, seiten.rechts)!;
    const mittel = (punkte: typeof linksM) =>
      punkte.reduce((summe, punkt) => summe + punkt[0], 0) / punkte.length;
    expect(mittel(linksM)).toBeLessThan(mittel(rechtsM));
  });
});
