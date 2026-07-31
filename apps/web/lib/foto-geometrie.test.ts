import { describe, expect, it } from 'vitest';
import {
  belegungsCheck,
  eckenPlausibel,
  hindernisAusKlicks,
  homographie,
  inverseHomographie,
  orientiereEcken,
  projPfad,
  projiziere,
  sortiereEcken,
  traufeWechseln,
  umrissAusKlicks,
  verschiebeFotoPunkt,
  vierEckenFuerHomographie,
  type Ecken,
} from './foto-geometrie';

const quadrat: Ecken = [
  [0, 100],
  [100, 100],
  [100, 0],
  [0, 0],
];

describe('Belegungs-Check für unterschiedliche Flächenarten', () => {
  it('misst eine frontal fotografierte Fassade ohne cos(90°)-Explosion', () => {
    const check = belegungsCheck(quadrat, 10, 10, 90, 10, 1, 'fassade');
    expect(check.vorschlag).toEqual({ breiteM: 10, hoeheM: 10 });
    expect(check.status).toBe('ok');
    expect(check.meldungen.join(' ')).not.toContain('Sparrenlänge');
  });

  it('verwendet beim Flachdach neutrale Maßbegriffe', () => {
    const check = belegungsCheck(quadrat, 8, 8, 0, 10, 1, 'flachdach');
    expect(check.status).toBe('warnung');
    expect(check.meldungen.join(' ')).toContain('Breite im Foto');
    expect(check.meldungen.join(' ')).toContain('Tiefe laut Foto');
    expect(check.meldungen.join(' ')).not.toContain('Traufe');
  });
});

describe('Tablet-Fadenkreuz', () => {
  it('bewegt relativ und klemmt sicher an allen Fotorändern', () => {
    expect(verschiebeFotoPunkt([50, 40], 15, -10, 100, 80)).toEqual([65, 30]);
    expect(verschiebeFotoPunkt([5, 75], -20, 30, 100, 80)).toEqual([0, 80]);
  });
});

describe('Homographie und Foto-Werkzeuge', () => {
  const trapez: Ecken = [[20, 180], [260, 170], [220, 30], [60, 40]];

  it('bildet alle vier Ecken exakt ab und ist pixelgenau invertierbar', () => {
    const h = homographie(12, 7, trapez)!;
    const inv = inverseHomographie(12, 7, trapez)!;
    const quelle: Ecken = [[0, 7], [12, 7], [12, 0], [0, 0]];
    quelle.forEach((p, i) => {
      expect(projiziere(h, p)[0]).toBeCloseTo(trapez[i]![0], 8);
      expect(projiziere(h, p)[1]).toBeCloseTo(trapez[i]![1], 8);
    });
    const punkt: [number, number] = [4.3, 2.7];
    const zurueck = projiziere(inv, projiziere(h, punkt));
    expect(zurueck[0]).toBeCloseTo(punkt[0], 8);
    expect(zurueck[1]).toBeCloseTo(punkt[1], 8);
  });

  it('weist entartete Markierungen und unbrauchbare Maße zurück', () => {
    const linie: Ecken = [[0, 0], [10, 0], [20, 0], [30, 0]];
    expect(homographie(10, 5, linie)).toBeNull();
    expect(inverseHomographie(10, 5, linie)).toBeNull();
    expect(homographie(0, 5, quadrat)).toBeNull();
    expect(eckenPlausibel(linie)).toBe(false);
  });

  it('sortiert beliebige Klickreihenfolgen und respektiert eine explizite Trauflinie', () => {
    expect(sortiereEcken([[100, 0], [0, 100], [0, 0], [100, 100]])).toEqual(quadrat);
    const seitlich = orientiereEcken([[100, 0], [0, 100], [0, 0], [100, 100]], [[0, 0], [0, 100]]);
    expect(new Set([seitlich[0].join(','), seitlich[1].join(',')])).toEqual(new Set(['0,0', '0,100']));
    expect(traufeWechseln(quadrat)).toEqual([[0, 0], [0, 100], [100, 100], [100, 0]]);
  });

  it('rechnet Umriss und Hindernis zurück und klemmt sie vollständig an den Dachrahmen', () => {
    const umriss = umrissAusKlicks([[0, 100], [50, 100], [50, 50]], 10, 10, quadrat)!;
    expect(umriss).toEqual([[0, 10], [5, 10], [5, 5]]);
    expect(umrissAusKlicks([[0, 0], [1, 1]], 10, 10, quadrat)).toBeNull();
    expect(hindernisAusKlicks([-50, -50], [150, 150], 10, 10, quadrat)).toEqual({
      xM: 0, yM: 0, breiteM: 10, hoeheM: 10,
    });
    expect(hindernisAusKlicks([10, 10], [10.2, 10.2], 10, 10, quadrat)).toBeNull();
  });

  it('liefert stabile SVG-Pfade und wählt bei komplexem Umriss die größten vier Hüllpunkte', () => {
    const h = homographie(10, 10, quadrat)!;
    expect(projPfad(h, [[0, 0], [10, 0], [10, 10]])).toBe('M0.00 0.00L100.00 0.00L100.00 100.00Z');
    const ecken = vierEckenFuerHomographie([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(new Set(ecken.map(String))).toEqual(new Set(['0,0', '10,0', '10,10', '0,10']));
  });
});
