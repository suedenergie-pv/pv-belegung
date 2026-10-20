import { describe, expect, it } from 'vitest';
import { homographie, projiziere, pruefePerspektive, type Ecken, type Punkt } from './foto-geometrie';
import {
  aktualisiereGaubenAussparungen,
  gaubenAussparungAusFoto,
  gaubenMasseAusElternfoto,
  gaubenPunkteAufElternflaeche,
  pruefeGaubenTopologie,
  rekonstruiereGaubenPunkte,
  satteldachMasseAusElternfoto,
  satteldachSeitenEcken,
  verschiebeGaubenPunkte,
  wendeGaubenMarkierungAn,
} from './gauben-geometrie';
import { migriereProjekt, neueFlaeche, neueGaubenFlaeche, neuesProjekt, patchFlaechenGeometrie, type DachFoto } from './model';
import { gaubenFotoUmriss } from './gauben-umriss';

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

describe('Gauben als zusammenhängende Auswahl verschieben', () => {
  it.each([
    ['Flachdach', gaube],
    ['Satteldach', [...gaube, [400, 180], [400, 520]] as Punkt[]],
  ])('verschiebt alle Punkte einer %sgaube ohne das Original zu ändern', (_, punkte) => {
    const original = structuredClone(punkte);
    const verschoben = verschiebeGaubenPunkte(punkte, 25, -50, 1000, 600);
    expect(verschoben).toEqual(original.map(([x, y]) => [x + 25, y - 50]));
    expect(punkte).toEqual(original);
    expect(verschoben).not.toBe(punkte);
    verschoben.forEach((p, i) => expect(p).not.toBe(punkte[i]));
  });

  it('begrenzt die komplette Gaube mit einem gemeinsamen Delta am Fotorand', () => {
    const punkte: Punkt[] = [...gaube, [400, 180], [400, 520]];
    const verschoben = verschiebeGaubenPunkte(punkte, 900, -900, 1000, 600);
    expect(verschoben).toEqual(punkte.map(([x, y]) => [x + 400, y - 180]));
    expect(Math.max(...verschoben.map((p) => p[0]))).toBe(1000);
    expect(Math.min(...verschoben.map((p) => p[1]))).toBe(0);
    // Auch Firstlänge und Abstand zum Außenrand bleiben bei begrenzter Bewegung gleich.
    expect(verschoben[5]![1] - verschoben[4]![1]).toBe(340);
    expect(verschoben[4]![0] - verschoben[3]![0]).toBe(200);
  });

  it('verschiebt ausschließlich die gewählte Firstlinie gemeinsam bis zum Rand', () => {
    const punkte: Punkt[] = [...gaube, [400, 180], [400, 520]];
    const verschoben = verschiebeGaubenPunkte(punkte, 20, 200, 1000, 600, [4, 5]);
    expect(verschoben.slice(0, 4)).toEqual(gaube);
    expect(verschoben.slice(4)).toEqual([[420, 260], [420, 600]]);
  });

  it('verschiebt eine schräge Außenkante ohne die beiden übrigen Ecken zu verändern', () => {
    const punkte: Punkt[] = [[100, 500], [600, 460], [550, 200], [120, 180]];
    const verschoben = verschiebeGaubenPunkte(punkte, -200, 200, 1000, 600, [0, 1, 0]);
    expect(verschoben).toEqual([[0, 600], [500, 560], [550, 200], [120, 180]]);
    expect(verschoben[1]![0] - verschoben[0]![0]).toBe(500);
    expect(verschoben[1]![1] - verschoben[0]![1]).toBe(-40);
  });

  it('begrenzt auch die Bewegung nach links und unten gemeinsam', () => {
    expect(verschiebeGaubenPunkte(gaube, -500, 500, 1000, 600))
      .toEqual(gaube.map(([x, y]) => [x - 200, y + 100]));
  });

  it.each([
    [NaN, 1, 1000, 600, undefined],
    [1, Infinity, 1000, 600, undefined],
    [1, 1, 0, 600, undefined],
    [1, 1, 1000, -1, undefined],
    [1, 1, Infinity, 600, undefined],
    [1, 1, 1000, NaN, undefined],
    [1, 1, 1000, 600, []],
    [1, 1, 1000, 600, [-1]],
    [1, 1, 1000, 600, [4]],
    [1, 1, 1000, 600, [0.5]],
  ] as [number, number, number, number, number[] | undefined][])(
    'lässt Punkte bei ungültigem Bewegungsauftrag unverändert (%s, %s, %s, %s, %s)',
    (dx, dy, breite, hoehe, indizes) => {
      const ergebnis = verschiebeGaubenPunkte(gaube, dx, dy, breite, hoehe, indizes);
      expect(ergebnis).toEqual(gaube);
      expect(ergebnis).not.toBe(gaube);
    },
  );

  it('verändert eine größere Auswahl nicht durch einzelne Punktbegrenzung', () => {
    const zuGross: Punkt[] = [[0, 10], [1100, 500]];
    expect(verschiebeGaubenPunkte(zuGross, 10, 10, 1000, 600)).toEqual(zuGross);
    expect(verschiebeGaubenPunkte([], 10, 10, 1000, 600)).toEqual([]);
    const ungueltig: Punkt[] = [[NaN, 10], [100, 100]];
    expect(verschiebeGaubenPunkte(ungueltig, 10, 10, 1000, 600)).toEqual(ungueltig);
  });
});

describe('Gaubengeometrie im Elternfoto', () => {
  it('liefert aus der Eltern-Homographie nur einen lokalen Maß-Schätzwert', () => {
    expect(gaubenMasseAusElternfoto(eltern, gaube)).toEqual({ breiteM: 4, hoeheM: 3 });
  });

  it('erhält den kompatiblen Rahmen neben der exakten Kontur', () => {
    expect(gaubenAussparungAusFoto(eltern, gaube)).toMatchObject({
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
    expect(aktualisiert?.[0]?.rechteck).toMatchObject({
      xM: 2.5,
      yM: 2,
      breiteM: 5,
      hoeheM: 3,
    });
  });

  it('projiziert eine schiefe Gaubenkontur ohne andere Ecken exakt zurück', () => {
    const schief: Ecken = [[220, 520], [640, 470], [550, 170], [260, 220]];
    const aussparung = gaubenAussparungAusFoto(eltern, schief)!;
    expect(aussparung.umrissM).toHaveLength(4);
    const h = homographie(10, 6, foto.eckenPx!)!;
    aussparung.umrissM!.forEach((p, i) => {
      const px = projiziere(h, p as Punkt);
      expect(px[0]).toBeCloseTo(schief[i]![0], 8);
      expect(px[1]).toBeCloseTo(schief[i]![1], 8);
    });
  });

  it('behält bei Satteldachgauben beide Firstenden als Außenkontur und migriert Bestände', () => {
    const first: [Punkt, Punkt] = [[400, 170], [400, 540]];
    const seiten = satteldachSeitenEcken(gaube, first, eltern)!;
    const umriss = gaubenFotoUmriss(gaube, seiten);
    expect(umriss).toHaveLength(6);
    expect(umriss).toEqual(expect.arrayContaining([...gaube, ...first]));
    const mutter = { ...eltern, foto: undefined, fotoZuordnungen: [
      { fotoId: 'andere', traufePx: null, eckenPx: [[0, 600], [800, 600], [800, 0], [0, 0]] as Ecken },
      { fotoId: 'eins', traufePx: null, eckenPx: foto.eckenPx }],
      gaubenAussparungen: [{ gaubenGruppeId: 'g', rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 } }] };
    const kinder = (['links', 'rechts'] as const).map((seite, i) => ({
      ...neueGaubenFlaeche(i + 2, 'B', 'satteldach', mutter.id, seite, 'g'),
      fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: seiten[seite] }],
    }));
    const migriert = migriereProjekt({ ...neuesProjekt(), fotoModellVersion: 3,
      fotos: ['andere', 'eins'].map((id) => ({ id, name: 'Foto', dataUrl: foto.dataUrl, breitePx: 1000, hoehePx: 600 })), flaechen: [mutter, ...kinder] });
    const neu = migriert.flaechen[0]!;
    expect(neu.gaubenAussparungen![0]!.rechteck.umrissM).toHaveLength(6);
    expect(neu.gaubenAussparungen![0]!.fotoId).toBe('eins');
    expect(migriereProjekt(JSON.parse(JSON.stringify(migriert)))).toEqual(migriert);
    const skaliert = patchFlaechenGeometrie(neu, { breiteM: 20 });
    expect(skaliert.gaubenAussparungen![0]!.rechteck.umrissM![0]![0]).toBeCloseTo(neu.gaubenAussparungen![0]!.rechteck.umrissM![0]![0] * 2);
    const zweitePerspektive = aktualisiereGaubenAussparungen({ ...neu, foto }, neu.gaubenAussparungen, 'zwei');
    expect(zweitePerspektive).toEqual(neu.gaubenAussparungen);
  });

  it('rekonstruiert frühe Flachdachgauben ohne gespeicherte Eltern-Fotopunkte aus dem Kind', () => {
    const mutter = { ...eltern, foto: undefined,
      fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: foto.eckenPx }],
      gaubenAussparungen: [{ gaubenGruppeId: 'g', rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 } }] };
    const kind = { ...neueGaubenFlaeche(2, 'B', 'flachdach', mutter.id, undefined, 'g'),
      fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: gaube }] };
    const neu = migriereProjekt({ ...neuesProjekt(), fotoModellVersion: 3,
      fotos: [{ id: 'eins', name: 'Foto', dataUrl: foto.dataUrl, breitePx: 1000, hoehePx: 600 }], flaechen: [mutter, kind] });
    expect(neu.flaechen[0]!.gaubenAussparungen![0]!.rechteck.umrissM).toHaveLength(4);
    expect(neu.flaechen[0]!.gaubenAussparungen![0]!.fotoEckenPx).toEqual(gaube);
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
      fotoZuordnungen: [
        { fotoId: 'foto-1', traufePx: null, eckenPx: seiten.links, markierungFertig: true },
        { fotoId: 'foto-2', traufePx: null, eckenPx: gaube, markierungFertig: true },
      ],
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
    const fremd = { ...neueFlaeche(4, 'D'), hindernisse: [{ xM: 1, yM: 1, breiteM: 1, hoeheM: 1 }] };
    const projekt = { ...basis, flaechen: [mutter, links, rechts, fremd] };
    const original = structuredClone(projekt);
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
    expect(neuLinks.breiteM).toBe(links.breiteM);
    expect(neuLinks.hoeheM).toBe(links.hoeheM);
    expect(neuLinks.neigungDeg).toBe(links.neigungDeg);
    expect(neuLinks.gaubenMessung).toEqual(links.gaubenMessung);
    expect(neuLinks.fotoZuordnungen![1]).toBe(links.fotoZuordnungen[1]);
    expect(angewendet.projekt.mppts).toBe(projekt.mppts);
    expect(angewendet.projekt.flaechen.find((f) => f.id === fremd.id)).toBe(fremd);
    for (const bisher of [links, rechts]) {
      const { fotoZuordnungen: _altePerspektiven, ...alteDaten } = bisher;
      const { fotoZuordnungen: neuePerspektiven, ...neueDaten } = angewendet.projekt.flaechen.find((f) => f.id === bisher.id)!;
      expect(neueDaten).toEqual(alteDaten);
      expect(neuePerspektiven![0]!.eckenPx).toEqual(neueSeiten[bisher.gaubenSeite!]);
    }
    const { gaubenAussparungen: alteAussparungen, ...altesHauptdach } = mutter;
    const { gaubenAussparungen: neueAussparungen, ...neuesHauptdach } = angewendet.projekt.flaechen[0]!;
    expect(neuesHauptdach).toEqual(altesHauptdach);
    expect(neueAussparungen).not.toEqual(alteAussparungen);
    expect(projekt).toEqual(original);
    expect(neuLinks.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
  });

  it('rekonstruiert nur die ausdrücklich gewählte Fotoperspektive', () => {
    const zweiteGaube = gaube.map(([x, y]) => [x + 50, y - 30] as Punkt) as Ecken;
    const mutter = { ...eltern, fotoZuordnungen: [
      { fotoId: 'eins', traufePx: null, eckenPx: foto.eckenPx },
      { fotoId: 'zwei', traufePx: null, eckenPx: foto.eckenPx },
    ], gaubenAussparungen: [{
      gaubenGruppeId: 'g', fotoId: 'eins', fotoEckenPx: gaube,
      rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 },
    }] };
    const kind = { ...neueGaubenFlaeche(2, 'B', 'flachdach', mutter.id, undefined, 'g'),
      fotoZuordnungen: [
        { fotoId: 'eins', traufePx: null, eckenPx: gaube },
        { fotoId: 'zwei', traufePx: null, eckenPx: zweiteGaube },
      ],
    };
    expect(rekonstruiereGaubenPunkte(mutter, [kind], 'g')).toEqual({ ok: true, punkte: gaube });
    expect(rekonstruiereGaubenPunkte(mutter, [kind], 'g', 'zwei')).toEqual({ ok: true, punkte: zweiteGaube });
    expect(rekonstruiereGaubenPunkte(mutter, [kind], 'g', 'fremd').ok).toBe(false);
    expect(rekonstruiereGaubenPunkte(mutter, [{ ...kind, fotoZuordnungen: kind.fotoZuordnungen.slice(0, 1) }], 'g', 'zwei').ok).toBe(false);
    const alteAussparung = { ...mutter, gaubenAussparungen: mutter.gaubenAussparungen.map(({ fotoId: _, ...a }) => a) };
    expect(rekonstruiereGaubenPunkte(alteAussparung, [kind], 'g', 'zwei')).toEqual({ ok: true, punkte: zweiteGaube });
  });

  it('nimmt beide Firstpunkte nur aus derselben gewählten Fotoperspektive', () => {
    const seiten = satteldachSeitenEcken(gaube, [[400, 180], [400, 520]], eltern)!;
    const verschoben = verschiebeGaubenPunkte([...gaube, [400, 180], [400, 520]], 50, -30, 1000, 600);
    const zweiteSeiten = satteldachSeitenEcken(verschoben.slice(0, 4) as Ecken, [verschoben[4]!, verschoben[5]!], eltern)!;
    const mutter = { ...eltern, fotoZuordnungen: ['eins', 'zwei'].map((fotoId) => ({ fotoId, traufePx: null, eckenPx: foto.eckenPx })),
      gaubenAussparungen: [{ gaubenGruppeId: 'g', fotoId: 'eins', fotoEckenPx: gaube, rechteck: { xM: 2, yM: 2, breiteM: 4, hoeheM: 3 } }],
    };
    const kinder = (['links', 'rechts'] as const).map((seite, i) => ({
      ...neueGaubenFlaeche(i + 2, 'B', 'satteldach', mutter.id, seite, 'g'),
      fotoZuordnungen: [
        { fotoId: 'eins', traufePx: null, eckenPx: seiten[seite] },
        { fotoId: 'zwei', traufePx: null, eckenPx: zweiteSeiten[seite] },
      ],
    }));
    const ergebnis = rekonstruiereGaubenPunkte(mutter, kinder, 'g', 'zwei');
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.punkte.slice(0, 4)).toEqual(expect.arrayContaining(verschoben.slice(0, 4)));
    expect(ergebnis.punkte.slice(4)).toEqual(expect.arrayContaining(verschoben.slice(4)));
    const unvollstaendig = [kinder[0]!, { ...kinder[1]!, fotoZuordnungen: kinder[1]!.fotoZuordnungen.slice(0, 1) }];
    expect(rekonstruiereGaubenPunkte(mutter, unvollstaendig, 'g', 'zwei').ok).toBe(false);
  });

  it('weist fremde Hauptdächer und ungültige Gaubenperspektiven vor dem Schreiben zurück', () => {
    const mutter = { ...eltern, fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: foto.eckenPx }] };
    const kind = { ...neueGaubenFlaeche(2, 'B', 'flachdach', mutter.id, undefined, 'g'),
      fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: gaube }],
    };
    const projekt = { ...neuesProjekt(), flaechen: [mutter, kind] };
    const markierung = { aussen: gaube, aussparung: gaubenAussparungAusFoto(mutter, gaube)! };
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'fremd', markierung).ok).toBe(false);
    expect(wendeGaubenMarkierungAn({ ...projekt, flaechen: [mutter, { ...kind, elternFlaecheId: 'fremd' }] }, mutter.id, 'g', 'eins', markierung).ok).toBe(false);
    const gekreuzt: Ecken = [gaube[0], gaube[2], gaube[1], gaube[3]];
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', { ...markierung, aussen: gekreuzt }).ok).toBe(false);
    const unendlich: Ecken = [[Infinity, 20], gaube[1], gaube[2], gaube[3]];
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', { ...markierung, aussen: unendlich }).ok).toBe(false);
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', { ...markierung, seiten: { links: gaube, rechts: gaube } }).ok).toBe(false);
    expect(kind.fotoZuordnungen[0]!.eckenPx).toBe(gaube);
  });

  it('übernimmt nur vollständige Satteldachseiten mit gültiger Perspektive', () => {
    const mutter = { ...eltern, fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: foto.eckenPx }] };
    const seiten = satteldachSeitenEcken(gaube, [[400, 180], [400, 520]], mutter)!;
    const kinder = (['links', 'rechts'] as const).map((seite, i) => ({
      ...neueGaubenFlaeche(i + 2, 'B', 'satteldach', mutter.id, seite, 'g'),
      fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: seiten[seite] }],
    }));
    const projekt = { ...neuesProjekt(), flaechen: [mutter, ...kinder] };
    const markierung = { aussen: gaube, seiten, aussparung: gaubenAussparungAusFoto(mutter, gaube)! };
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', markierung).ok).toBe(true);
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', { ...markierung, seiten: undefined }).ok).toBe(false);
    expect(wendeGaubenMarkierungAn({ ...projekt, flaechen: [mutter, kinder[0]!] }, mutter.id, 'g', 'eins', markierung).ok).toBe(false);
    const kaputt = [gaube[0], gaube[2], gaube[1], gaube[3]] as Ecken;
    expect(wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', { ...markierung, seiten: { ...seiten, rechts: kaputt } }).ok).toBe(false);
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

describe('Zusammenhängende, überlappungsfreie Gaubenseiten', () => {
  it.each([
    ['normaler Außenkontur und Firstenden außerhalb des Hilfsrahmens', gaube, [[400, 180], [400, 520]]],
    ['schiefer Außenkontur', [[160, 510], [610, 470], [630, 210], [250, 180]], [[440, 160], [390, 540]]],
    ['konkaver Gesamtkontur', gaube, [[400, 250], [400, 520]]],
  ] as [string, Ecken, [Punkt, Punkt]][])(
    'akzeptiert gültige Gauben mit %s', (_, aussen, first) => {
      const seiten = satteldachSeitenEcken(aussen, first, eltern)!;
      expect(pruefePerspektive(3, 2.5, seiten.links).status).not.toBe('fehler');
      expect(pruefePerspektive(3, 2.5, seiten.rechts).status).not.toBe('fehler');
      expect(pruefeGaubenTopologie(aussen, seiten)).toBeNull();
      const umriss = gaubenFotoUmriss(aussen, seiten);
      expect(umriss).toHaveLength(6);
      expect(umriss).toEqual(expect.arrayContaining([...aussen, ...first]));
    },
  );

  it.each([
    ['gekreuzter First als Diagonale', [[700, 300], [600, 500], [600, 200], [200, 200]], [[400, 180], [400, 520]]],
    ['beide Seiten auf derselben Seite des Firsts', gaube, [[650, 180], [650, 520]]],
  ] as [string, Ecken, [Punkt, Punkt]][])(
    'weist trotz einzeln gültiger Perspektiven zurück: %s', (_, aussen, first) => {
      const seiten = satteldachSeitenEcken(aussen, first, eltern)!;
      expect(pruefePerspektive(3, 2.5, seiten.links).status).not.toBe('fehler');
      expect(pruefePerspektive(3, 2.5, seiten.rechts).status).not.toBe('fehler');
      expect(pruefeGaubenTopologie(aussen, seiten)).not.toBeNull();
      const mutter = { ...eltern, fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: foto.eckenPx }] };
      const kinder = (['links', 'rechts'] as const).map((seite, i) => ({
        ...neueGaubenFlaeche(i + 2, 'B', 'satteldach', mutter.id, seite, 'g'),
        fotoZuordnungen: [{ fotoId: 'eins', traufePx: null, eckenPx: seiten[seite] }],
      }));
      const projekt = { ...neuesProjekt(), flaechen: [mutter, ...kinder] };
      const original = structuredClone(projekt);
      const ergebnis = wendeGaubenMarkierungAn(projekt, mutter.id, 'g', 'eins', {
        aussen, seiten, aussparung: gaubenAussparungAusFoto(mutter, gaubenFotoUmriss(aussen, seiten))!,
      });
      expect(ergebnis.ok).toBe(false);
      expect(projekt).toEqual(original);
    },
  );

  it('weist getrennte Ringe, doppelte Seiten und eine unpassende Außenkontur zurück', () => {
    const seiten = satteldachSeitenEcken(gaube, [[400, 180], [400, 520]], eltern)!;
    const rechtsGetrennt = seiten.rechts.map(([x, y]) => [x + 500, y] as Punkt) as Ecken;
    expect(pruefeGaubenTopologie(gaube, { ...seiten, rechts: rechtsGetrennt })).not.toBeNull();
    expect(pruefeGaubenTopologie(gaube, { links: seiten.links, rechts: seiten.links })).not.toBeNull();
    expect(pruefeGaubenTopologie([[201, 500], gaube[1], gaube[2], gaube[3]], seiten)).not.toBeNull();
    expect(pruefeGaubenTopologie([gaube[0], gaube[0], gaube[2], gaube[3]], seiten)).not.toBeNull();
    expect(pruefeGaubenTopologie([[NaN, 500], gaube[1], gaube[2], gaube[3]], seiten)).not.toBeNull();
  });

  it('prüft Flachdachgauben ohne eine zusätzliche Firstlinie', () => {
    expect(pruefeGaubenTopologie(gaube)).toBeNull();
    expect(pruefeGaubenTopologie([gaube[0], gaube[2], gaube[1], gaube[3]])).not.toBeNull();
  });
});
