/**
 * 2D-Geometrie für die Belegung (SPEC §9, ergänzt 06.07.2026): Polygon-Umriss
 * je Dachfläche (Walm/Trapez/L-Form, beliebige Eckenzahl) und Hindernis-Rechtecke
 * (Kamin, Dachfenster, SAT). Reine Mathematik in Flächen-Koordinaten (Meter,
 * Ursprung links oben) — deterministisch, kein Rendering, kein Foto-Bezug.
 */

/** Punkt in Flächen-Koordinaten, Meter */
export type PunktM = readonly [number, number];

/** Achsparalleles Rechteck in Flächen-Koordinaten, Meter */
export interface RechteckM {
  xM: number;
  yM: number;
  breiteM: number;
  hoeheM: number;
}

/** Toleranz 0,1 mm — Modulkanten dürfen exakt auf der Umrisslinie liegen */
const EPS_M = 1e-4;

/** Punkt-in-Polygon (Ray-Casting); Punkte AUF der Kante zählen als innen (±EPS). */
export function punktInPolygon(p: PunktM, poly: readonly PunktM[]): boolean {
  const [x, y] = p;
  let innen = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (punktSegmentAbstand(p, poly[i]!, poly[j]!) <= EPS_M) return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      innen = !innen;
    }
  }
  return innen;
}

/** Abstand Punkt ↔ Strecke */
export function punktSegmentAbstand(p: PunktM, a: PunktM, b: PunktM): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function orientierung(a: PunktM, b: PunktM, c: PunktM): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Schneiden sich zwei Strecken (inkl. Berührung)? */
export function segmenteSchneidenSich(a1: PunktM, a2: PunktM, b1: PunktM, b2: PunktM): boolean {
  const d1 = orientierung(b1, b2, a1);
  const d2 = orientierung(b1, b2, a2);
  const d3 = orientierung(a1, a2, b1);
  const d4 = orientierung(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Kollinear/Berührung über Abstände (robust genug für Belegungsraster)
  return (
    punktSegmentAbstand(a1, b1, b2) <= EPS_M ||
    punktSegmentAbstand(a2, b1, b2) <= EPS_M ||
    punktSegmentAbstand(b1, a1, a2) <= EPS_M ||
    punktSegmentAbstand(b2, a1, a2) <= EPS_M
  );
}

/** Abstand Strecke ↔ Strecke (0 bei Schnitt/Berührung) */
export function segmentSegmentAbstand(a1: PunktM, a2: PunktM, b1: PunktM, b2: PunktM): number {
  if (segmenteSchneidenSich(a1, a2, b1, b2)) return 0;
  return Math.min(
    punktSegmentAbstand(a1, b1, b2),
    punktSegmentAbstand(a2, b1, b2),
    punktSegmentAbstand(b1, a1, a2),
    punktSegmentAbstand(b2, a1, a2),
  );
}

function rechteckEcken(r: RechteckM): [PunktM, PunktM, PunktM, PunktM] {
  return [
    [r.xM, r.yM],
    [r.xM + r.breiteM, r.yM],
    [r.xM + r.breiteM, r.yM + r.hoeheM],
    [r.xM, r.yM + r.hoeheM],
  ];
}

/**
 * Liegt das Modul-Rechteck komplett im Umriss-Polygon, mit mindestens `randM`
 * Abstand zu jeder Umrisskante? Bedingung: alle 4 Ecken innen UND Abstand jeder
 * Polygonkante zum Rechteck ≥ randM (deckt auch konkave Umrisse ab, bei denen
 * eine Kante durchs Rechteck liefe). randM − EPS, damit die exakte Rechnung aus
 * dem Rasteraufbau (Nutzfläche = Fläche − Rand) nicht an Rundung scheitert.
 */
export function rechteckImUmriss(r: RechteckM, umriss: readonly PunktM[], randM: number): boolean {
  if (umriss.length < 3) return true;
  for (const ecke of rechteckEcken(r)) {
    if (!punktInPolygon(ecke, umriss)) return false;
  }
  const ecken = rechteckEcken(r);
  const kanten: [PunktM, PunktM][] = [
    [ecken[0], ecken[1]],
    [ecken[1], ecken[2]],
    [ecken[2], ecken[3]],
    [ecken[3], ecken[0]],
  ];
  const mindest = Math.max(0, randM) - EPS_M;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const abstand = Math.min(
      ...kanten.map(([k1, k2]) => segmentSegmentAbstand(umriss[j]!, umriss[i]!, k1, k2)),
    );
    if (abstand < mindest) return false;
  }
  return true;
}

/** Überlappen sich zwei achsparallele Rechtecke (Berührung zählt nicht)? */
export function rechteckeUeberlappen(a: RechteckM, b: RechteckM): boolean {
  return (
    a.xM < b.xM + b.breiteM - EPS_M &&
    a.xM + a.breiteM > b.xM + EPS_M &&
    a.yM < b.yM + b.hoeheM - EPS_M &&
    a.yM + a.hoeheM > b.yM + EPS_M
  );
}
