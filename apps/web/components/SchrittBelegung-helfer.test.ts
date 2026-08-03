import { describe, expect, it } from 'vitest';
import { neueFlaeche, neueGaubenFlaeche } from '../lib/model';
import {
  feldMitGriff,
  flaechenInBelegungsReihenfolge,
  leerVerschoben,
  punktInRechteck,
  rechteckAus,
} from './SchrittBelegung';

describe('Flächenreihenfolge', () => {
  it('setzt Gauben direkt hinter ihr Hauptdach statt ans Ende der Belegung', () => {
    const dachA = neueFlaeche(1, 'A');
    const dachB = neueFlaeche(2, 'B');
    const gaube1 = neueGaubenFlaeche(3, 'C', 'flachdach', dachA.id, undefined, 'g1');
    const gaube2 = neueGaubenFlaeche(4, 'D', 'flachdach', dachA.id, undefined, 'g2');

    expect(
      flaechenInBelegungsReihenfolge([dachA, dachB, gaube1, gaube2]).map((f) => f.id),
    ).toEqual([dachA.id, gaube1.id, gaube2.id, dachB.id]);
  });
});

describe('Belegungsfeld-Griffe', () => {
  const feld = { xM: 2, yM: 3, breiteM: 4, hoeheM: 5, quer: false, leer: ['0-0', '1-2'] };

  it.each([
    ['e', 1, 0, { xM: 2, yM: 3, breiteM: 5, hoeheM: 5 }],
    ['s', 0, 2, { xM: 2, yM: 3, breiteM: 4, hoeheM: 7 }],
    ['se', 1, 2, { xM: 2, yM: 3, breiteM: 5, hoeheM: 7 }],
  ] as const)('zieht Griff %s ohne die Rasterphase zu verändern', (griff, dx, dy, rect) => {
    expect(feldMitGriff(feld, griff, dx, dy, 1, 1)).toEqual({ rect, zellVersatz: { col: 0, row: 0 } });
  });

  it('rastet linke und obere Kante in Modulschritten und nummeriert Löcher mit um', () => {
    const erg = feldMitGriff(feld, 'nw', -1.2, -2.2, 1, 1);
    expect(erg).toEqual({
      rect: { xM: 1, yM: 1, breiteM: 5, hoeheM: 7 },
      zellVersatz: { col: 1, row: 2 },
    });
    expect(leerVerschoben(feld.leer, 1, 2)).toEqual(['2-1', '3-3']);
    expect(leerVerschoben(['0-0'], -1, 0)).toBeUndefined();
  });

  it('normalisiert Ziehrichtung, Mindestgröße und Punktgrenzen', () => {
    expect(rechteckAus([5, 4], [2, 1])).toEqual({ xM: 2, yM: 1, breiteM: 3, hoeheM: 3 });
    expect(punktInRechteck([2, 1], { xM: 2, yM: 1, breiteM: 3, hoeheM: 3 })).toBe(true);
    expect(punktInRechteck([5.01, 4], { xM: 2, yM: 1, breiteM: 3, hoeheM: 3 })).toBe(false);
    expect(feldMitGriff(feld, 'e', -4, 0, 1, 1).rect.breiteM).toBe(0.2);
  });
});
