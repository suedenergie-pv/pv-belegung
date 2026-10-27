import { describe, expect, it } from 'vitest';
import type { PunktM } from '@pv-belegung/engine';
import { homographie, inverseHomographie, projiziere, type Ecken, type Punkt } from './foto-geometrie';
import { dachAusFotoReferenz, pruefeFotoReferenz, type FotoReferenz } from './foto-referenz';

// Analytische Testabbildung, unabhängig vom Homographie-Solver des Produkts.
// x'=(52x+8y+350)/(1+.012x+.018y), y'=(-4x+48y+160)/(1+.012x+.018y).
function projektor(winkel: number, perspektive = true): (p: PunktM) => Punkt {
  const a = winkel * Math.PI / 180;
  return ([x, y]) => {
    const w = perspektive ? 1 + .012 * x + .018 * y : 1;
    const u = (52 * x + 8 * y + 350) / w;
    const v = (-4 * x + 48 * y + 160) / w;
    return [800 + Math.cos(a) * u - Math.sin(a) * v, 600 + Math.sin(a) * u + Math.cos(a) * v];
  };
}
function referenz(proj: (p: PunktM) => Punkt, breiteM = 4, hoeheM = 3): FotoReferenz {
  return { breiteM, hoeheM, eckenPx: ([[0, hoeheM], [breiteM, hoeheM], [breiteM, 0], [0, 0]] satisfies Ecken).map(proj) as Ecken };
}
function punktGleich(ist: PunktM, soll: PunktM, stellen = 7) {
  expect(ist[0]).toBeCloseTo(soll[0], stellen);
  expect(ist[1]).toBeCloseTo(soll[1], stellen);
}
const formen: { name: string; umriss: PunktM[] }[] = [
  { name: 'Dreieck Spitze links', umriss: [[0, 0], [20, 8], [0, 8]] },
  { name: 'Dreieck Spitze mittig', umriss: [[10, 0], [20, 8], [0, 8]] },
  { name: 'Dreieck Spitze rechts', umriss: [[20, 0], [20, 8], [0, 8]] },
  { name: 'halbes Trapez links gerade', umriss: [[0, 0], [13, 0], [20, 8], [0, 8]] },
  { name: 'halbes Trapez rechts gerade', umriss: [[7, 0], [20, 0], [20, 8], [0, 8]] },
  { name: 'fünf Ecken', umriss: [[2, -1], [10, -1], [16, 4], [16, 9], [2, 9]] },
  { name: 'L mit sechs Ecken', umriss: [[-2, -2], [12, -2], [12, 3], [4, 3], [4, 9], [-2, 9]] },
];

describe('gemessene Foto-Referenz und unabhängiger Dachrand', () => {
  for (const winkel of [0, 37, 90, 180, 270]) {
    for (const perspektive of [false, true]) {
      for (const { name, umriss } of formen) {
        it(`${name}, ${winkel} Grad, ${perspektive ? 'projektiv' : 'affin'}: echte Maße und alle Foto-Ecken bleiben erhalten`, () => {
          const proj = projektor(winkel, perspektive);
          const umrissPx = umriss.map(proj);
          const result = dachAusFotoReferenz(referenz(proj), umrissPx);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const minX = Math.min(...umriss.map(p => p[0])), minY = Math.min(...umriss.map(p => p[1]));
          const maxX = Math.max(...umriss.map(p => p[0])), maxY = Math.max(...umriss.map(p => p[1]));
          expect(result.breiteM).toBeCloseTo(maxX - minX, 8);
          expect(result.hoeheM).toBeCloseTo(maxY - minY, 8);
          punktGleich(result.ursprungM, [minX, minY]);
          expect(result.umrissM).toHaveLength(umriss.length);
          for (let i = 0; i < umriss.length; i++) {
            punktGleich(result.umrissM[i]!, [umriss[i]![0] - minX, umriss[i]![1] - minY]);
          }
          const erwarteterRahmen: Ecken = [[minX, maxY], [maxX, maxY], [maxX, minY], [minX, minY]];
          erwarteterRahmen.forEach((p, i) => punktGleich(result.eckenPx[i]!, proj(p)));
          // Bestehender Renderer braucht keine neue Projektion: sein Rechteck +
          // die normalisierte Maske bilden alle echten Dachrandpunkte exakt ab.
          const h = homographie(result.breiteM, result.hoeheM, result.eckenPx)!;
          const inv = inverseHomographie(result.breiteM, result.hoeheM, result.eckenPx)!;
          result.umrissM.forEach((p, i) => {
            punktGleich(projiziere(h, p), umrissPx[i]!);
            punktGleich(projiziere(inv, umrissPx[i]!), p);
          });
        });
      }
    }
  }

  it('akzeptiert einen First mit 15,51 m auf einer 20-m-Fläche ohne 10-m-Grenze', () => {
    const proj = projektor(19);
    const result = dachAusFotoReferenz(referenz(proj), ([[0, 8], [20, 8], [17.755, 0], [2.245, 0]] satisfies PunktM[]).map(proj));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.breiteM).toBeCloseTo(20, 8);
    expect(result.umrissM[2]![0] - result.umrissM[3]![0]).toBeCloseTo(15.51, 8);
  });

  it('akzeptiert dieselbe Kontur in umgekehrter Zeichenrichtung', () => {
    const proj = projektor(270);
    const umriss = [...formen[6]!.umriss].reverse();
    const result = dachAusFotoReferenz(referenz(proj), umriss.map(proj));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.umrissM).toHaveLength(6);
  });

  it('kann gültige zusätzliche Punkte auf einer geraden Dachkante behalten', () => {
    const proj = projektor(0);
    const result = dachAusFotoReferenz(referenz(proj), ([[0, 0], [5, 0], [10, 0], [10, 6], [0, 6]] satisfies PunktM[]).map(proj));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.umrissM).toHaveLength(5);
  });

  it('mutiert weder Referenz noch Dachpunkte und liefert deterministische Ergebnisse', () => {
    const proj = projektor(37);
    const ref = referenz(proj);
    const umriss = formen[4]!.umriss.map(proj);
    const vorher = JSON.stringify({ ref, umriss });
    const a = dachAusFotoReferenz(ref, umriss);
    const b = dachAusFotoReferenz(ref, umriss);
    expect(a).toEqual(b);
    expect(JSON.stringify({ ref, umriss })).toBe(vorher);
  });
});

describe('falsche oder entartete Referenz', () => {
  it.each([0, -1, Number.NaN, Infinity])('verweigert ungültige Breite %s', breiteM => {
    expect(pruefeFotoReferenz({ ...referenz(projektor(0)), breiteM })).toMatchObject({ ok: false, code: 'referenz_masse' });
  });
  it.each([0, -1, Number.NaN, Infinity])('verweigert ungültige Tiefe %s', hoeheM => {
    expect(pruefeFotoReferenz({ ...referenz(projektor(0)), hoeheM })).toMatchObject({ ok: false, code: 'referenz_masse' });
  });
  it.each([
    { name: 'gekreuzte Reihenfolge', ecken: [[0, 100], [100, 0], [100, 100], [0, 0]] },
    { name: 'zusammengefallene Ecke', ecken: [[0, 100], [100, 100], [100, 100], [0, 0]] },
    { name: 'konkave Ecke', ecken: [[0, 100], [100, 100], [50, 80], [0, 0]] },
    { name: 'kollinear', ecken: [[0, 0], [100, 0], [200, 0], [300, 0]] },
    { name: 'numerisch fast kollinear', ecken: [[0, 100], [200, 100], [200, 100 - 1e-10], [0, 100 - 1e-10]] },
  ])('verweigert $name', ({ ecken }) => {
    const result = pruefeFotoReferenz({ breiteM: 4, hoeheM: 3, eckenPx: ecken as Ecken });
    expect(result.ok).toBe(false);
  });
  it('verweigert nicht endliche Fotopunkte', () => {
    const ref = referenz(projektor(0));
    ref.eckenPx[0][0] = Infinity;
    expect(pruefeFotoReferenz(ref)).toMatchObject({ ok: false, code: 'referenz_ecken' });
  });
  it('verweigert drei statt vier echte Referenzpunkte', () => {
    const ref = referenz(projektor(0));
    ref.eckenPx = ref.eckenPx.slice(0, 3) as Ecken;
    expect(pruefeFotoReferenz(ref)).toMatchObject({ ok: false, code: 'referenz_ecken' });
  });
});

describe('falscher Dachrand', () => {
  const proj = projektor(0);
  const ref = referenz(proj);
  it.each<{ name: string; umriss: PunktM[] }>([
    { name: 'nur zwei Punkte', umriss: [[0, 0], [10, 0]] },
    { name: 'identische Nachbarn', umriss: [[0, 0], [10, 0], [10, 0], [0, 5]] },
    { name: 'Linie', umriss: [[0, 0], [5, 0], [10, 0]] },
    { name: 'Selbstschnitt', umriss: [[0, 0], [10, 5], [10, 0], [0, 5]] },
    { name: 'Selbstberührung', umriss: [[0, 0], [4, 0], [4, 4], [2, 2], [0, 4], [2, 2]] },
    { name: 'überlappende Nachbarkante', umriss: [[0, 0], [10, 0], [5, 0], [5, 6], [0, 6]] },
    { name: 'NaN', umriss: [[0, 0], [10, 0], [Number.NaN, 5]] },
  ])('verweigert $name', ({ umriss }) => {
    const result = dachAusFotoReferenz(ref, umriss.map(proj));
    expect(result.ok).toBe(false);
  });
});

describe('Fluchtgrenze im gesamten Dachbereich', () => {
  const proj = ([x, y]: PunktM): Punkt => [(50 * x + 200) / (1 - .1 * x), (40 * y + 100) / (1 - .1 * x)];
  const ref = referenz(proj);
  it('verweigert eine Kontur, deren Inneres die inverse Fluchtlinie schneidet', () => {
    // Inverse Fluchtlinie: Foto-x = -500. Alle vier Ecken selbst sind endlich.
    const result = dachAusFotoReferenz(ref, [[-600, -100], [500, -100], [500, 700], [-600, 700]]);
    expect(result).toMatchObject({ ok: false, code: 'fluchtgrenze' });
  });
  it('verweigert Punkte numerisch zu nahe an der Fluchtlinie', () => {
    const result = dachAusFotoReferenz(ref, [[-500 + 1e-9, -100], [500, -100], [500, 700], [-500 + 1e-9, 700]]);
    expect(result).toMatchObject({ ok: false, code: 'fluchtgrenze' });
  });
  it('verweigert einen isolierten Umriss auf der anderen Seite der Referenz-Fluchtlinie', () => {
    const result = dachAusFotoReferenz(ref, ([[22, 0], [24, 0], [22, 2]] satisfies PunktM[]).map(proj));
    expect(result).toMatchObject({ ok: false, code: 'fluchtgrenze' });
  });
  it('prüft virtuelle BBox-Ecken außerhalb der tatsächlichen Dreiecksfläche', () => {
    const diagonal = ([x, y]: PunktM): Punkt => [(40 * x + 100) / (1 - .05 * x - .05 * y), (40 * y + 100) / (1 - .05 * x - .05 * y)];
    // Dreieck x+y<=16 liegt vollständig im endlichen Bereich x+y<20;
    // der benötigte Rahmen mit Ecke (16,16) schneidet jedoch die Fluchtlinie.
    const result = dachAusFotoReferenz(referenz(diagonal), ([[0, 0], [16, 0], [0, 16]] satisfies PunktM[]).map(diagonal));
    expect(result).toMatchObject({ ok: false, code: 'fluchtgrenze' });
  });
});

describe('nachvollziehbare Qualitätswarnungen', () => {
  it('hat keine Extrapolationswarnung innerhalb der gemessenen Referenz', () => {
    const proj = projektor(0);
    const result = dachAusFotoReferenz(referenz(proj), ([[1, .5], [3, 1], [1, 2]] satisfies PunktM[]).map(proj));
    expect(result).toMatchObject({ ok: true, qualitaet: 'ok', extrapolationsFaktor: 1 });
  });
  it('warnt bei großer Extrapolation, ohne reale 20-m-Dächer abzuschneiden', () => {
    const proj = projektor(90);
    const result = dachAusFotoReferenz(referenz(proj), ([[0, 0], [20, 0], [20, 8], [0, 8]] satisfies PunktM[]).map(proj));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.qualitaet).toBe('warnung');
    expect(result.breiteM).toBeCloseTo(20, 8);
    expect(result.extrapolationsFaktor).toBeCloseTo(9, 8);
    expect(result.meldungen.join(' ')).toContain('weit außerhalb');
  });
  it('warnt, wenn die echte Referenz im Foto zu klein zum präzisen Klicken ist', () => {
    const proj = ([x, y]: PunktM): Punkt => [2 * x + 100, 2 * y + 100];
    expect(pruefeFotoReferenz(referenz(proj))).toMatchObject({ ok: true, qualitaet: 'warnung' });
  });
});
