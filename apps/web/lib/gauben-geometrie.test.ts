import { describe, expect, it } from 'vitest';
import { homographie, projiziere, type Ecken, type Punkt } from './foto-geometrie';
import {
  aktualisiereGaubenAussparungen,
  gaubenAussparungAusFoto,
  gaubenMasseAusElternfoto,
  gaubenPunkteAufElternflaeche,
  rekonstruiereGaubenPunkte,
  satteldachMasseAusElternfoto,
  satteldachSeitenEcken,
  wendeGaubenMarkierungAn,
} from './gauben-geometrie';
import { neueFlaeche, neueGaubenFlaeche, neuesProjekt, type DachFoto } from './model';

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

  it('rekonstruiert sechs gemeinsame Satteldachpunkte und wendet sie ohne Datenverlust an', () => {
    const first: [Punkt, Punkt] = [[400, 180], [400, 520]];
    const seiten = satteldachSeitenEcken(gaube, first, eltern)!;
    const links = {
      ...neueGaubenFlaeche(2, 'B', 'satteldach', eltern.id, 'links', 'g1'),
      felder: [{ xM: 0.2, yM: 0.2, breiteM: 1, hoeheM: 1, quer: false, leer: ['0-0'] }],
      inaktiv: ['0-0'],
      hindernisse: [{ xM: 0.4, yM: 0.4, breiteM: 0.2, hoeheM: 0.2 }],
      fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: seiten.links, markierungFertig: true }],
    };
    const rechts = {
      ...neueGaubenFlaeche(3, 'C', 'satteldach', eltern.id, 'rechts', 'g1'),
      fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: seiten.rechts, markierungFertig: true }],
    };
    const mutter = {
      ...eltern,
      fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: foto.eckenPx, markierungFertig: true }],
      gaubenAussparungen: [{ gaubenGruppeId: 'g1', rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 }, fotoEckenPx: gaube }],
    };
    const rekonstruiert = rekonstruiereGaubenPunkte(mutter, [links, rechts], 'g1');
    expect(rekonstruiert).toMatchObject({ ok: true });
    if (!rekonstruiert.ok) return;
    expect(rekonstruiert.punkte).toHaveLength(6);

    const basis = neuesProjekt();
    const projekt = { ...basis, flaechen: [mutter, links, rechts] };
    const neueAussen = rekonstruiert.punkte.slice(0, 4) as Ecken;
    neueAussen[0] = [210, 510];
    const neueSeiten = satteldachSeitenEcken(neueAussen, [rekonstruiert.punkte[4]!, rekonstruiert.punkte[5]!], mutter)!;
    const aussparung = gaubenAussparungAusFoto(mutter, neueAussen)!;
    const angewendet = wendeGaubenMarkierungAn(projekt, mutter.id, 'g1', 'foto-1', {
      aussen: neueAussen,
      seiten: neueSeiten,
      aussparung,
    });
    expect(angewendet.ok).toBe(true);
    if (!angewendet.ok) return;
    const neuLinks = angewendet.projekt.flaechen.find((f) => f.id === links.id)!;
    expect(neuLinks.felder).toEqual(links.felder);
    expect(neuLinks.inaktiv).toEqual(links.inaktiv);
    expect(neuLinks.hindernisse).toEqual(links.hindernisse);
    expect(neuLinks.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
  });

  it('rekonstruiert eine Flachdachgaube aus exakt vier gespeicherten Punkten', () => {
    const kind = {
      ...neueGaubenFlaeche(2, 'B', 'flachdach', eltern.id, undefined, 'g-flach'),
      fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: gaube, markierungFertig: true }],
    };
    const mutter = {
      ...eltern,
      fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: foto.eckenPx, markierungFertig: true }],
      gaubenAussparungen: [{
        gaubenGruppeId: 'g-flach',
        rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 },
        fotoEckenPx: gaube,
      }],
    };
    expect(rekonstruiereGaubenPunkte(mutter, [kind], 'g-flach')).toEqual({
      ok: true,
      punkte: gaube,
    });
  });
});
