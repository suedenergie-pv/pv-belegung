import { describe, expect, it } from 'vitest';
import { hindernisUmriss, rechteckUeberlapptHindernis, type HindernisM } from '@pv-belegung/engine';
import {
  aussparungAusPunkten, aussparungEcke, aussparungFehler,
  skaliereAussparung, verschiebeAussparung,
} from './aussparung-geometrie';
import { felderInput, modulById, neueFlaeche, patchFlaechenGeometrie, rasterFuer } from './model';

describe('Bearbeitbare Aussparungen in Flächenkoordinaten', () => {
  const rechteck: HindernisM = { xM: 1, yM: 2, breiteM: 3, hoeheM: 2 };
  const schraeg = aussparungAusPunkten([[1, 2], [4, 2.5], [3.5, 4], [1.5, 3.5]]);

  it('berechnet den Rahmen aus der Kontur, kopiert die Eingabe und erlaubt Außenlagen', () => {
    const punkte: [number, number][] = [[-2, -1], [1, 0], [0, 2]];
    const h = aussparungAusPunkten(punkte);
    expect(h).toMatchObject({ xM: -2, yM: -1, breiteM: 3, hoeheM: 3 });
    expect(aussparungFehler(h)).toBeNull();
    punkte[0]![0] = 99;
    expect(h.umrissM?.[0]).toEqual([-2, -1]);
  });

  it('verschiebt alte Rechtecke und freie Konturen ohne Mutation', () => {
    expect(verschiebeAussparung(rechteck, -2, 3)).toEqual({ ...rechteck, xM: -1, yM: 5 });
    const h = verschiebeAussparung(schraeg, 2, -1);
    expect(h.umrissM).toEqual([[3, 1], [6, 1.5], [5.5, 3], [3.5, 2.5]]);
    expect(h).toMatchObject({ xM: 3, yM: 1, breiteM: 3, hoeheM: 2 });
    expect(schraeg.umrissM?.[0]).toEqual([1, 2]);
  });

  it('skaliert relativ zur linken oberen Rahmenecke und bewahrt die freie Form', () => {
    expect(skaliereAussparung(rechteck, 6, 1)).toEqual({ ...rechteck, breiteM: 6, hoeheM: 1 });
    const h = skaliereAussparung(schraeg, 6, 1);
    expect(h.umrissM).toEqual([[1, 2], [7, 2.25], [6, 3], [2, 2.75]]);
    expect(aussparungFehler(h)).toBeNull();
    expect(aussparungFehler(skaliereAussparung(schraeg, -2, 1))).not.toBeNull();
  });

  it('zieht eine Rechteckecke frei und passt den Rahmen an', () => {
    const h = aussparungEcke(rechteck, 1, [5, 1]);
    expect(h.umrissM).toEqual([[1, 2], [5, 1], [4, 4], [1, 4]]);
    expect(h).toMatchObject({ xM: 1, yM: 1, breiteM: 4, hoeheM: 3 });
    expect(aussparungFehler(h)).toBeNull();
    expect(aussparungEcke(rechteck, -1, [5, 1])).toBe(rechteck);
    expect(aussparungEcke(rechteck, 4, [5, 1])).toBe(rechteck);
    expect(rechteck.umrissM).toBeUndefined();
  });

  it('akzeptiert beide Umlaufrichtungen und einfache konkave Konturen', () => {
    expect(aussparungFehler(schraeg)).toBeNull();
    expect(aussparungFehler(aussparungAusPunkten([...schraeg.umrissM!].reverse()))).toBeNull();
    expect(aussparungFehler(aussparungAusPunkten([[0, 0], [2, 0], [1, 1], [0, 2]]))).toBeNull();
    expect(aussparungFehler({ xM: 0, yM: 0, breiteM: 0.05, hoeheM: 0.05 })).toBeNull();
  });

  it.each([
    ['Selbstschnitt', [[0, 0], [2, 2], [0, 2], [2, 0]]],
    ['Berührung', [[0, 0], [2, 0], [2, 2], [1, 0], [0, 2]]],
    ['Doppelpunkt', [[0, 0], [2, 0], [2, 2], [0, 0]]],
    ['kurze Kante', [[0, 0], [0.01, 0], [2, 2], [0, 2]]],
    ['zu kleine Fläche', [[0, 0], [1, 0], [0.5, 0.001]]],
    ['zu wenige Ecken', [[0, 0], [1, 1]]],
    ['leere Kontur', []],
    ['nicht endlich', [[0, 0], [Infinity, 0], [1, 1]]],
  ] as const)('weist %s zurück', (_name, punkte) => {
    expect(aussparungFehler(aussparungAusPunkten(punkte))).not.toBeNull();
  });

  it('erhält die genaue Kontur beim Übergang ins Modell und bei Maßänderungen', () => {
    const f = { ...neueFlaeche(1), breiteM: 10, hoeheM: 5, hindernisse: [schraeg] };
    expect(felderInput(f, modulById('jw-hd96n-r2-460')).hindernisseM?.[0]).toEqual(schraeg);
    const neu = patchFlaechenGeometrie(f, { breiteM: 20, hoeheM: 15 });
    expect(neu.hindernisse?.[0]).toEqual({
      xM: 2, yM: 6, breiteM: 6, hoeheM: 6,
      umrissM: [[2, 6], [8, 7.5], [7, 12], [3, 10.5]],
    });
    expect(f.hindernisse[0]).toEqual(schraeg);
  });

  it('filtert Module anhand der freien Kontur statt anhand ihres größeren Rahmens', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis = {
      ...neueFlaeche(1), breiteM: 5, hoeheM: 5, randM: 0,
      felder: [{ xM: 0, yM: 0, breiteM: 5, hoeheM: 5, quer: false }],
    };
    // Dreieck über der rechten unteren Rahmenhälfte: links oben bleiben Module frei.
    const h = aussparungAusPunkten([[0, 4.9], [4.9, 0], [4.9, 4.9]]);
    const ohne = rasterFuer(basis, modul);
    const polygon = rasterFuer({ ...basis, hindernisse: [h] }, modul);
    const rahmen = rasterFuer({ ...basis, hindernisse: [{ ...h, umrissM: undefined }] }, modul);
    expect(polygon.positionen.length).toBeGreaterThan(rahmen.positionen.length);
    expect(polygon.positionen.length).toBeLessThan(ohne.positionen.length);
    const verschoben = verschiebeAussparung(h, 10, 0);
    expect(rasterFuer({ ...basis, hindernisse: [verschoben] }, modul).positionen).toEqual(ohne.positionen);
    expect(hindernisUmriss(verschoben)[0]).toEqual([10, 4.9]);
    expect(rechteckUeberlapptHindernis({ xM: 0, yM: 0, breiteM: 0.1, hoeheM: 0.1 }, h)).toBe(false);
  });
});
