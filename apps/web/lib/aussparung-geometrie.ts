import { hindernisUmriss, type HindernisM, type PunktM } from '@pv-belegung/engine';

/** Exakte Kontur mit kompatiblem Rechteckrahmen in Flächenkoordinaten. */
export function aussparungAusPunkten(punkte: readonly PunktM[]): HindernisM {
  const umrissM = punkte.map(([x, y]) => [x, y] as PunktM);
  const xs = umrissM.map((p) => p[0]);
  const ys = umrissM.map((p) => p[1]);
  const xM = xs.length ? Math.min(...xs) : 0;
  const yM = ys.length ? Math.min(...ys) : 0;
  return {
    xM, yM,
    breiteM: xs.length ? Math.max(...xs) - xM : 0,
    hoeheM: ys.length ? Math.max(...ys) - yM : 0,
    umrissM,
  };
}

function kreuz(a: PunktM, b: PunktM, c: PunktM): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function aufSegment(a: PunktM, b: PunktM, p: PunktM): boolean {
  const eps = 1e-9;
  return Math.abs(kreuz(a, b, p)) < eps &&
    p[0] >= Math.min(a[0], b[0]) - eps && p[0] <= Math.max(a[0], b[0]) + eps &&
    p[1] >= Math.min(a[1], b[1]) - eps && p[1] <= Math.max(a[1], b[1]) + eps;
}

function schneiden(a: PunktM, b: PunktM, c: PunktM, d: PunktM): boolean {
  const abC = kreuz(a, b, c), abD = kreuz(a, b, d);
  const cdA = kreuz(c, d, a), cdB = kreuz(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) ||
    aufSegment(a, b, c) || aufSegment(a, b, d) ||
    aufSegment(c, d, a) || aufSegment(c, d, b);
}

/** Vor dem Speichern prüfen; auch Aussparungen über dem Dachrand bleiben zulässig. */
export function aussparungFehler(h: HindernisM): string | null {
  if (![h.xM, h.yM, h.breiteM, h.hoeheM].every(Number.isFinite)) {
    return 'Die Aussparung enthält ungültige Koordinaten.';
  }
  if (h.breiteM <= 0 || h.hoeheM <= 0) return 'Breite und Höhe müssen größer als null sein.';
  const punkte = h.umrissM ?? hindernisUmriss(h);
  if (punkte.length < 3) return 'Die Aussparung braucht mindestens drei Ecken.';
  if (punkte.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    return 'Die Aussparung enthält ungültige Koordinaten.';
  }
  for (let i = 0; i < punkte.length; i++) {
    const a = punkte[i]!, b = punkte[(i + 1) % punkte.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05 - 1e-9) {
      return 'Zwischen zwei Ecken müssen mindestens 5 cm liegen.';
    }
    for (let j = i + 1; j < punkte.length; j++) {
      if (j === i + 1 || (i === 0 && j === punkte.length - 1)) continue;
      if (schneiden(a, b, punkte[j]!, punkte[(j + 1) % punkte.length]!)) {
        return 'Die Kanten der Aussparung dürfen sich nicht kreuzen oder berühren.';
      }
    }
  }
  let doppelteFlaeche = 0;
  for (let i = 0; i < punkte.length; i++) {
    const a = punkte[i]!, b = punkte[(i + 1) % punkte.length]!;
    doppelteFlaeche += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(doppelteFlaeche) / 2 < 0.0025 - 1e-9
    ? 'Die Aussparung ist zu klein (mindestens 25 cm²).'
    : null;
}

/** Verschiebt Kontur und Rahmen gemeinsam; der Eingabestand bleibt unverändert. */
export function verschiebeAussparung(h: HindernisM, dx: number, dy: number): HindernisM {
  return {
    ...h, xM: h.xM + dx, yM: h.yM + dy,
    ...(h.umrissM ? { umrissM: h.umrissM.map(([x, y]) => [x + dx, y + dy] as PunktM) } : {}),
  };
}

/** Größe relativ zur linken oberen Rahmenecke ändern, inklusive freier Kontur. */
export function skaliereAussparung(h: HindernisM, breiteM: number, hoeheM: number): HindernisM {
  return {
    ...h, breiteM, hoeheM,
    ...(h.umrissM ? {
      umrissM: h.umrissM.map(([x, y]) => [
        h.xM + (x - h.xM) * breiteM / h.breiteM,
        h.yM + (y - h.yM) * hoeheM / h.hoeheM,
      ] as PunktM),
    } : {}),
  };
}

/** Eine Ecke frei verziehen; Rechteck-Altstände erhalten dabei eine exakte Kontur. */
export function aussparungEcke(h: HindernisM, index: number, punkt: PunktM): HindernisM {
  const punkte = hindernisUmriss(h);
  if (!Number.isInteger(index) || index < 0 || index >= punkte.length) return h;
  return aussparungAusPunkten(punkte.map((p, i) => i === index ? punkt : p));
}
