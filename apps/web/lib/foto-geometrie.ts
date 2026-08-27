/**
 * Projektive Platzierung (Homographie) der Dachfläche im Drohnenfoto.
 *
 * Reine Darstellungs-Geometrie (Renderer = Kompositor, SPEC §3): Das Raster
 * kommt unverändert aus der Engine (mm-Maße × Maßstab), hier wird nur jede
 * Ecke in Foto-Pixel projiziert. Keine 3D-Rekonstruktion — die 4 angeklickten
 * Ecken bestimmen die Abbildung Ebene→Bild für eine planare Dachfläche exakt,
 * auch bei schräg aufgenommenen Fotos (Trapez statt Parallelogramm).
 *
 * WICHTIG: Die Homographie „passt" für BELIEBIGE eingegebene Maße — sie
 * streckt die Fläche immer exakt ins markierte Viereck. Richtig groß sind die
 * Module nur, wenn breiteM/hoeheM dem echten Dach entsprechen. Deshalb gehört
 * zu jeder Markierung der Belegungs-Check (unten), der die Foto-Maße (über
 * den Ziegel-Maßstab) gegen die eingegebenen Maße hält.
 */

import type { PunktM, RechteckM } from '@pv-belegung/engine';

export type Punkt = [number, number];
type PunktLesbar = readonly [number, number];

/** Relatives Tablet-Fadenkreuz bewegen und sicher im Foto halten. */
export function verschiebeFotoPunkt(
  [x, y]: Punkt,
  dx: number,
  dy: number,
  breitePx: number,
  hoehePx: number,
): Punkt {
  return [
    Math.max(0, Math.min(breitePx, x + dx)),
    Math.max(0, Math.min(hoehePx, y + dy)),
  ];
}

/** Ecken der Dachfläche im Foto. Reihenfolge: Traufe links, Traufe rechts, First rechts, First links. */
export type Ecken = [Punkt, Punkt, Punkt, Punkt];

/** 3×3-Matrix, zeilenweise. */
type M3 = [number, number, number, number, number, number, number, number, number];

/** Öffentlicher Alias für eine Homographie-Matrix (Rückgabe von `homographie`). */
export type Homographie = M3;

export interface PerspektivPruefung {
  status: 'ok' | 'warnung' | 'fehler';
  meldungen: string[];
  /** Größter geteilt durch kleinsten lokalen Bildmaßstab im 5×5-Prüfraster. */
  massstabVerhaeltnis: number | null;
}

export type SichererSvgPfad =
  | { ok: true; d: string }
  | { ok: false; grund: string };

export type UmrissPruefung =
  | { ok: true; punkte: PunktM[]; eingerasteteIndizes: number[] }
  | { ok: false; grund: string; ungueltigeIndizes: number[] };

function punktEndlich(p: PunktLesbar): boolean {
  return Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

function polygonFlaeche(punkte: readonly PunktLesbar[]): number {
  let doppelt = 0;
  for (let i = 0; i < punkte.length; i++) {
    const a = punkte[i]!;
    const b = punkte[(i + 1) % punkte.length]!;
    doppelt += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(doppelt) / 2;
}

function orientierung(a: PunktLesbar, b: PunktLesbar, c: PunktLesbar): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmenteKreuzen(a: PunktLesbar, b: PunktLesbar, c: PunktLesbar, d: PunktLesbar): boolean {
  const eps = 1e-9;
  const o1 = orientierung(a, b, c);
  const o2 = orientierung(a, b, d);
  const o3 = orientierung(c, d, a);
  const o4 = orientierung(c, d, b);
  return o1 * o2 < -eps && o3 * o4 < -eps;
}

function polygonHatSelbstschnitt(punkte: readonly PunktLesbar[]): boolean {
  for (let i = 0; i < punkte.length; i++) {
    const a = punkte[i]!;
    const b = punkte[(i + 1) % punkte.length]!;
    for (let j = i + 1; j < punkte.length; j++) {
      if (j === i || j === i + 1 || (i === 0 && j === punkte.length - 1)) continue;
      const c = punkte[j]!;
      const d = punkte[(j + 1) % punkte.length]!;
      if (segmenteKreuzen(a, b, c, d)) return true;
    }
  }
  return false;
}

function determinant(m: M3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

function adjugat(m: M3): M3 {
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
}

function mult(a: M3, b: M3): M3 {
  const r = new Array(9) as M3;
  for (let z = 0; z < 3; z++) {
    for (let s = 0; s < 3; s++) {
      r[z * 3 + s] = a[z * 3]! * b[s]! + a[z * 3 + 1]! * b[3 + s]! + a[z * 3 + 2]! * b[6 + s]!;
    }
  }
  return r;
}

/** Basis-Homographie: Einheitsbasis → 4 Punkte (Standardverfahren über Adjugate). */
function basisZu(p: Ecken): M3 {
  const m: M3 = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1];
  const a = adjugat(m);
  const v = [
    a[0] * p[3][0] + a[1] * p[3][1] + a[2],
    a[3] * p[3][0] + a[4] * p[3][1] + a[5],
    a[6] * p[3][0] + a[7] * p[3][1] + a[8],
  ];
  return mult(m, [v[0]!, 0, 0, 0, v[1]!, 0, 0, 0, v[2]!]);
}

/**
 * Homographie Flächen-/Rahmen-Koordinaten (Meter, Ursprung First links, y zur
 * Traufe) → Foto-Pixel. null bei entarteten Ecken.
 *
 * `quelle` (08.07.2026, Genrih): Ist die Fläche ein Trapez/Parallelogramm, klickt
 * der Nutzer die 4 ECHTEN Dach-Ecken an. Dann müssen die QUELLPUNKTE die passende
 * Form haben (Trapez- bzw. Parallelogramm-Ecken in Rahmen-Koordinaten, Reihenfolge
 * wie `ecken`) — sonst wird ein Rechteck in die Form gestreckt und alles verzerrt.
 * Ohne `quelle` (Rechteck-Fläche) ist die Quelle das volle Rahmen-Rechteck.
 */
export function homographie(
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
): M3 | null {
  if (breiteM <= 0 || hoeheM <= 0) return null;
  const src: Ecken = quelle ?? [
    [0, hoeheM],
    [breiteM, hoeheM],
    [breiteM, 0],
    [0, 0],
  ];
  if (!ecken.every(punktEndlich) || !src.every(punktEndlich)) return null;
  if (!eckenPlausibel(ecken) || !eckenPlausibel(src)) return null;
  const zielBasis = basisZu(ecken);
  const quellBasis = basisZu(src);
  // Kollineare oder zusammengefallene Punkte ergeben formal teils noch endliche
  // Koeffizienten, aber keine invertierbare Projektion. Solche Markierungen müssen
  // als ungültig zurückgewiesen werden, statt später NaN-Koordinaten zu rendern.
  if (Math.abs(determinant(zielBasis)) < 1e-9 || Math.abs(determinant(quellBasis)) < 1e-9) return null;
  const h = mult(zielBasis, adjugat(quellBasis));
  return h.every((n) => Number.isFinite(n)) && Math.abs(determinant(h)) >= 1e-9 ? h : null;
}

/**
 * Zentrale Stabilitätsprüfung für jede Foto-Perspektive. Sie prüft nicht, ob das
 * Foto „schön" aufgenommen ist, sondern ausschließlich, ob die projektive
 * Abbildung im kompletten Dachrahmen mathematisch stabil und rückrechenbar ist.
 */
export function pruefePerspektive(
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
): PerspektivPruefung {
  const fehler = (meldung: string): PerspektivPruefung => ({
    status: 'fehler',
    meldungen: [meldung],
    massstabVerhaeltnis: null,
  });
  if (!Number.isFinite(breiteM) || !Number.isFinite(hoeheM) || breiteM <= 0 || hoeheM <= 0) {
    return fehler('Die Dachmaße sind ungültig. Perspektive kann nicht berechnet werden.');
  }
  if (!ecken.every(punktEndlich) || !eckenPlausibel(ecken)) {
    return fehler('Die 4 Ecken bilden kein konvexes, kreuzungsfreies Viereck.');
  }

  const src: Ecken = quelle ?? [[0, hoeheM], [breiteM, hoeheM], [breiteM, 0], [0, 0]];
  if (!src.every(punktEndlich) || !eckenPlausibel(src)) {
    return fehler('Die metrische Dachform ist entartet und kann nicht projiziert werden.');
  }
  const h = homographie(breiteM, hoeheM, ecken, src);
  const inv = h ? inverseHomographie(breiteM, hoeheM, ecken, src) : null;
  if (!h || !inv || !h.every(Number.isFinite) || !inv.every(Number.isFinite)) {
    return fehler('Die Perspektive ist nicht invertierbar. Bitte mindestens eine Ecke korrigieren.');
  }

  const matrixNorm = Math.max(...h.map((n) => Math.abs(n)));
  if (!Number.isFinite(matrixNorm) || matrixNorm <= 0) {
    return fehler('Die Perspektive enthält keine endliche Abbildung.');
  }
  const raster: Punkt[][] = [];
  const nenner: number[] = [];
  const bild: Punkt[][] = [];
  for (let yi = 0; yi < 5; yi++) {
    const ty = yi / 4;
    const zeile: Punkt[] = [];
    const bildZeile: Punkt[] = [];
    for (let xi = 0; xi < 5; xi++) {
      const tx = xi / 4;
      // Bilineares Prüfraster innerhalb des Quell-Vierecks. Die Homographie selbst
      // bleibt projektiv; das Raster liefert nur robuste Stichproben bis an alle Kanten.
      const unten: Punkt = [
        src[0][0] + (src[1][0] - src[0][0]) * tx,
        src[0][1] + (src[1][1] - src[0][1]) * tx,
      ];
      const oben: Punkt = [
        src[3][0] + (src[2][0] - src[3][0]) * tx,
        src[3][1] + (src[2][1] - src[3][1]) * tx,
      ];
      const p: Punkt = [
        unten[0] + (oben[0] - unten[0]) * ty,
        unten[1] + (oben[1] - unten[1]) * ty,
      ];
      const w = (h[6] * p[0] + h[7] * p[1] + h[8]) / matrixNorm;
      const q = projiziere(h, p);
      if (!Number.isFinite(w) || !punktEndlich(q)) {
        return fehler('Die Perspektive läuft im Dachbereich gegen die projektive Fluchtgrenze.');
      }
      nenner.push(w);
      zeile.push(p);
      bildZeile.push(q);
    }
    raster.push(zeile);
    bild.push(bildZeile);
  }
  const vorzeichen = Math.sign(nenner[0]!);
  if (
    vorzeichen === 0 ||
    nenner.some((w) => Math.sign(w) !== vorzeichen || Math.abs(w) < 1e-8)
  ) {
    return fehler('Die Perspektive schneidet im Dachbereich die projektive Fluchtgrenze.');
  }

  let maxRueckFehlerPx = 0;
  const lokaleMassstaebe: number[] = [];
  for (let yi = 0; yi < 5; yi++) {
    for (let xi = 0; xi < 5; xi++) {
      const p = raster[yi]![xi]!;
      const q = bild[yi]![xi]!;
      const zurueckM = projiziere(inv, q);
      const wiederPx = projiziere(h, zurueckM);
      if (!punktEndlich(zurueckM) || !punktEndlich(wiederPx)) {
        return fehler('Die Rückprojektion der Perspektive ist nicht endlich.');
      }
      maxRueckFehlerPx = Math.max(maxRueckFehlerPx, laenge(q, wiederPx));
      if (xi < 4) {
        const p2 = raster[yi]![xi + 1]!;
        const q2 = bild[yi]![xi + 1]!;
        const meter = laenge(p, p2);
        if (meter > 1e-9) lokaleMassstaebe.push(laenge(q, q2) / meter);
      }
      if (yi < 4) {
        const p2 = raster[yi + 1]![xi]!;
        const q2 = bild[yi + 1]![xi]!;
        const meter = laenge(p, p2);
        if (meter > 1e-9) lokaleMassstaebe.push(laenge(q, q2) / meter);
      }
    }
  }
  if (maxRueckFehlerPx > 0.5) {
    return fehler(`Die Rückprojektion weicht um ${maxRueckFehlerPx.toFixed(2)} Pixel ab.`);
  }
  const positiveMassstaebe = lokaleMassstaebe.filter((n) => Number.isFinite(n) && n > 1e-9);
  if (positiveMassstaebe.length === 0) {
    return fehler('Die Perspektive hat keinen messbaren lokalen Maßstab.');
  }
  const massstabVerhaeltnis = Math.max(...positiveMassstaebe) / Math.min(...positiveMassstaebe);
  if (!Number.isFinite(massstabVerhaeltnis)) {
    return fehler('Die Perspektive hat einen unendlichen lokalen Maßstab.');
  }
  if (massstabVerhaeltnis >= 25) {
    return {
      status: 'warnung',
      meldungen: [
        `Sehr starke Perspektive: lokale Maßstäbe unterscheiden sich um ${massstabVerhaeltnis.toFixed(1)}:1. Die Abbildung ist stabil, sollte aber optisch geprüft werden.`,
      ],
      massstabVerhaeltnis,
    };
  }
  return { status: 'ok', meldungen: [], massstabVerhaeltnis };
}

export function projiziere(h: M3, [x, y]: PunktLesbar): Punkt {
  const w = h[6] * x + h[7] * y + h[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return [Number.NaN, Number.NaN];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/**
 * Inverse Homographie Foto-Pixel → Flächen-Koordinaten (Meter). Projektiv ist
 * die Inverse bis auf Skalierung die Adjugate — Grundlage für „Umriss zeichnen"
 * und Hindernis-Markierung direkt im Foto (SPEC §9, 06.07.2026).
 */
export function inverseHomographie(
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
): M3 | null {
  const h = homographie(breiteM, hoeheM, ecken, quelle);
  if (!h) return null;
  const inv = adjugat(h);
  return inv.every((n) => Number.isFinite(n)) && (inv[6] || inv[7] || inv[8]) ? inv : null;
}

/** Konvexe Hülle (Andrew's Monotone Chain), gegen den Uhrzeigersinn. */
function konvexeHuelle(punkte: Punkt[]): Punkt[] {
  const p = [...punkte].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const kreuz = (o: Punkt, a: Punkt, b: Punkt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const unten: Punkt[] = [];
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2]!, unten[unten.length - 1]!, q) <= 0)
      unten.pop();
    unten.push(q);
  }
  const oben: Punkt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (oben.length >= 2 && kreuz(oben[oben.length - 2]!, oben[oben.length - 1]!, q) <= 0)
      oben.pop();
    oben.push(q);
  }
  unten.pop();
  oben.pop();
  return unten.concat(oben);
}

function viereckFlaeche(a: Punkt, b: Punkt, c: Punkt, d: Punkt): number {
  // Gauß'sche Trapezformel (Betrag), Reihenfolge a,b,c,d als Ring
  return (
    Math.abs(
      a[0] * b[1] - b[0] * a[1] +
      b[0] * c[1] - c[0] * b[1] +
      c[0] * d[1] - d[0] * c[1] +
      d[0] * a[1] - a[0] * d[1],
    ) / 2
  );
}

/**
 * Wählt aus beliebig vielen Umriss-Ecken die 4 Punkte, die das flächengrößte
 * umschließende Viereck bilden — das dient als Perspektiv-Referenz (Homographie),
 * während der volle Umriss die Belegung maskiert. Bei genau 4 Punkten sind es
 * diese; bei < 4 (nach konvexer Hülle) mit den ersten Klicks aufgefüllt.
 */
export function vierEckenFuerHomographie(punkte: Punkt[]): [Punkt, Punkt, Punkt, Punkt] {
  const h = konvexeHuelle(punkte);
  if (h.length >= 4) {
    let best = -1;
    let idx: [number, number, number, number] = [0, 1, 2, 3];
    for (let i = 0; i < h.length; i++)
      for (let j = i + 1; j < h.length; j++)
        for (let k = j + 1; k < h.length; k++)
          for (let l = k + 1; l < h.length; l++) {
            const a = viereckFlaeche(h[i]!, h[j]!, h[k]!, h[l]!);
            if (a > best) {
              best = a;
              idx = [i, j, k, l];
            }
          }
    return [h[idx[0]]!, h[idx[1]]!, h[idx[2]]!, h[idx[3]]!];
  }
  // Degeneriert (< 4 Hüllenpunkte): mit den geklickten Punkten auffüllen
  const q = [...punkte];
  while (q.length < 4) q.push(punkte[punkte.length - 1] ?? [0, 0]);
  return [q[0]!, q[1]!, q[2]!, q[3]!];
}

/**
 * SVG-Pfad eines projizierten Polygons. Unsichere Werte werden als Ergebnis
 * zurückgegeben und dürfen weder gerendert noch gespeichert werden.
 */
export function projPfad(h: M3, punkte: Punkt[]): SichererSvgPfad {
  if (punkte.length < 3 || punkte.some((p) => !punktEndlich(p))) {
    return { ok: false, grund: 'Polygon enthält zu wenige oder ungültige Punkte.' };
  }
  const projiziert = punkte.map((p) => projiziere(h, p));
  if (
    projiziert.some(
      (p) => !punktEndlich(p) || Math.abs(p[0]) > 1e7 || Math.abs(p[1]) > 1e7,
    )
  ) {
    return { ok: false, grund: 'Projizierte Ecken sind unendlich oder extrem groß.' };
  }
  for (let i = 0; i < projiziert.length; i++) {
    if (laenge(projiziert[i]!, projiziert[(i + 1) % projiziert.length]!) < 1e-6) {
      return { ok: false, grund: 'Projizierte Ecken fallen zusammen.' };
    }
  }
  if (polygonHatSelbstschnitt(projiziert)) {
    return { ok: false, grund: 'Projizierter Pfad überkreuzt sich.' };
  }
  if (polygonFlaeche(projiziert) < 1e-4) {
    return { ok: false, grund: 'Projizierter Pfad hat praktisch keine Fläche.' };
  }
  return {
    ok: true,
    d: 'M' + projiziert.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z',
  };
}

function laenge(a: PunktLesbar, b: PunktLesbar): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Umriss aus Foto-Klicks: Pixel → Flächen-Koordinaten (Meter) via inverser
 * Homographie. Punkte werden nur innerhalb einer kleinen sichtbaren Bildtoleranz
 * an den Dachrahmen eingerastet. Weiter außerhalb liegende Punkte, Selbstschnitte,
 * Duplikate und praktisch flächenlose Polygone werden konkret zurückgewiesen.
 */
export function pruefeUmrissAusKlicks(
  pts: Punkt[],
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
  bildToleranzPx = 8,
): UmrissPruefung {
  if (pts.length < 3) {
    return { ok: false, grund: 'Ein Umriss braucht mindestens 3 Punkte.', ungueltigeIndizes: [] };
  }
  const h = homographie(breiteM, hoeheM, ecken, quelle);
  const hinv = inverseHomographie(breiteM, hoeheM, ecken, quelle);
  if (!h || !hinv) {
    return { ok: false, grund: 'Die Perspektive ist nicht rückrechenbar.', ungueltigeIndizes: [] };
  }
  const eingerasteteIndizes: number[] = [];
  const ungueltigeIndizes: number[] = [];
  const metrisch = pts.map((p, i) => {
    const [x, y] = projiziere(hinv, p);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      ungueltigeIndizes.push(i);
      return [Number.NaN, Number.NaN] as PunktM;
    }
    const eingerastet: PunktM = [
      Math.max(0, Math.min(breiteM, x)),
      Math.max(0, Math.min(hoeheM, y)),
    ];
    if (eingerastet[0] !== x || eingerastet[1] !== y) {
      const bildpunkt = projiziere(h, eingerastet);
      if (!punktEndlich(bildpunkt) || laenge(p, bildpunkt) > bildToleranzPx) {
        ungueltigeIndizes.push(i);
        return [x, y] as PunktM;
      }
      eingerasteteIndizes.push(i);
    }
    return eingerastet;
  });
  if (ungueltigeIndizes.length > 0) {
    return {
      ok: false,
      grund: 'Mindestens ein Umrisspunkt liegt deutlich außerhalb des Dachrahmens.',
      ungueltigeIndizes,
    };
  }
  const eps = Math.max(breiteM, hoeheM) * 1e-4;
  for (let i = 0; i < metrisch.length; i++) {
    for (let j = i + 1; j < metrisch.length; j++) {
      if (laenge(metrisch[i]!, metrisch[j]!) <= eps) {
        return { ok: false, grund: 'Der Umriss enthält doppelte Punkte.', ungueltigeIndizes: [i, j] };
      }
    }
  }
  if (polygonHatSelbstschnitt(metrisch)) {
    return { ok: false, grund: 'Der Umriss überkreuzt sich.', ungueltigeIndizes: [] };
  }
  if (polygonFlaeche(metrisch) < Math.max(1e-4, breiteM * hoeheM * 1e-4)) {
    return { ok: false, grund: 'Der Umriss hat praktisch keine Fläche.', ungueltigeIndizes: [] };
  }
  return { ok: true, punkte: metrisch, eingerasteteIndizes };
}

/** Rückwärtskompatibler Kurzweg für alte Aufrufer; ohne stilles Rahmen-Clamping. */
export function umrissAusKlicks(
  pts: Punkt[],
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
): PunktM[] | null {
  const ergebnis = pruefeUmrissAusKlicks(pts, breiteM, hoeheM, ecken, quelle);
  return ergebnis.ok ? ergebnis.punkte : null;
}

/**
 * Hindernis-Rechteck aus zwei Foto-Klicks (gegenüberliegende Ecken) in Flächen-
 * Koordinaten (Meter). null bei entarteten Ecken oder zu kleinem Rechteck (< 5 cm).
 */
export function hindernisAusKlicks(
  p1: Punkt,
  p2: Punkt,
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
): RechteckM | null {
  const hinv = inverseHomographie(breiteM, hoeheM, ecken, quelle);
  if (!hinv) return null;
  const [ax, ay] = projiziere(hinv, p1);
  const [bx, by] = projiziere(hinv, p2);
  const cl = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const axClamped = cl(ax, breiteM);
  const ayClamped = cl(ay, hoeheM);
  const bxClamped = cl(bx, breiteM);
  const byClamped = cl(by, hoeheM);
  const rect: RechteckM = {
    xM: Math.min(axClamped, bxClamped),
    yM: Math.min(ayClamped, byClamped),
    breiteM: Math.abs(bxClamped - axClamped),
    hoeheM: Math.abs(byClamped - ayClamped),
  };
  return rect.breiteM > 0.05 && rect.hoeheM > 0.05 ? rect : null;
}

/**
 * Sortiert 4 beliebig angeklickte Ecken in die kanonische Reihenfolge
 * (Traufe links, Traufe rechts, First rechts, First links) — Klick-Reihenfolge
 * und -Richtung sind damit egal. Annahme: die Traufe ist die im Bild unterste
 * Kante (Standard bei Drohnenfotos von außen); passt das nicht, rotiert
 * traufeWechseln() die Zuordnung weiter.
 */
export function sortiereEcken(punkte: [Punkt, Punkt, Punkt, Punkt]): Ecken {
  const cx = (punkte[0][0] + punkte[1][0] + punkte[2][0] + punkte[3][0]) / 4;
  const cy = (punkte[0][1] + punkte[1][1] + punkte[2][1] + punkte[3][1]) / 4;
  // Ring um den Schwerpunkt: ergibt immer ein einfaches (kreuzungsfreies) Viereck
  const ring = [...punkte].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  ) as [Punkt, Punkt, Punkt, Punkt];
  // Traufe = Kante mit dem tiefsten Mittelpunkt (größtes y, Bildkoordinaten)
  let traufeIdx = 0;
  let tiefstesY = -Infinity;
  for (let i = 0; i < 4; i++) {
    const mitteY = (ring[i]![1] + ring[(i + 1) % 4]![1]) / 2;
    if (mitteY > tiefstesY) {
      tiefstesY = mitteY;
      traufeIdx = i;
    }
  }
  let a = ring[traufeIdx]!;
  let b = ring[(traufeIdx + 1) % 4]!;
  let c = ring[(traufeIdx + 2) % 4]!;
  let d = ring[(traufeIdx + 3) % 4]!;
  if (a[0] > b[0]) {
    // Ring-Richtung umdrehen, damit die Traufe links→rechts läuft
    [a, b, c, d] = [b, a, d, c];
  }
  return [a, b, c, d];
}

/**
 * Ordnet 4 beliebig geklickte Ecken anhand einer vom Nutzer gezogenen TRAUFLINIE
 * (entlang der Traufe/Dachrinne). Die Traufe ist damit EINDEUTIG bestimmt — nicht
 * mehr über die Annahme „unterste Kante im Bild" (Genrih 08.07.2026: die Traufe
 * gehört an die Traufe, dann ist die Klick-Reihenfolge der 4 Ecken egal).
 * Zwei Schritte: (1) das gegenüberliegende Kantenpaar wählen, das parallel zur
 * Linie liegt (= Traufe/First-Achse); (2) davon die Kante als Traufe nehmen, die
 * der gezogenen Linie am nächsten liegt.
 */
export function orientiereEcken(
  punkte: [Punkt, Punkt, Punkt, Punkt],
  traufLinie: [Punkt, Punkt],
): Ecken {
  const cx = (punkte[0][0] + punkte[1][0] + punkte[2][0] + punkte[3][0]) / 4;
  const cy = (punkte[0][1] + punkte[1][1] + punkte[2][1] + punkte[3][1]) / 4;
  const ring = [...punkte].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  ) as [Punkt, Punkt, Punkt, Punkt];

  // Richtungsvektor der Trauflinie (normiert)
  let rx = traufLinie[1][0] - traufLinie[0][0];
  let ry = traufLinie[1][1] - traufLinie[0][1];
  const rl = Math.hypot(rx, ry) || 1;
  rx /= rl;
  ry /= rl;
  const align = (i: number): number => {
    const a = ring[i]!;
    const b = ring[(i + 1) % 4]!;
    let ex = b[0] - a[0];
    let ey = b[1] - a[1];
    const el = Math.hypot(ex, ey) || 1;
    ex /= el;
    ey /= el;
    return Math.abs(ex * rx + ey * ry); // 1 = parallel zur Linie
  };
  // Gegenüberliegendes Kantenpaar, das am besten zur Linie parallel liegt = Traufe/First-Achse
  const paar = (align(0) + align(2)) / 2 >= (align(1) + align(3)) / 2 ? [0, 2] : [1, 3];
  // Mittelpunkt der gezogenen Trauflinie
  const lx = (traufLinie[0][0] + traufLinie[1][0]) / 2;
  const ly = (traufLinie[0][1] + traufLinie[1][1]) / 2;
  const abstandZurLinie = (i: number): number => {
    const mx = (ring[i]![0] + ring[(i + 1) % 4]![0]) / 2;
    const my = (ring[i]![1] + ring[(i + 1) % 4]![1]) / 2;
    return Math.hypot(mx - lx, my - ly);
  };
  // Von den beiden achsparallelen Kanten die der Trauflinie NÄCHSTE = Traufe
  const traufeIdx = abstandZurLinie(paar[0]!) <= abstandZurLinie(paar[1]!) ? paar[0]! : paar[1]!;

  let a = ring[traufeIdx]!;
  let b = ring[(traufeIdx + 1) % 4]!;
  let c = ring[(traufeIdx + 2) % 4]!;
  let d = ring[(traufeIdx + 3) % 4]!;
  if (a[0] > b[0]) {
    // Ring-Richtung umdrehen, damit die Traufe links→rechts läuft
    [a, b, c, d] = [b, a, d, c];
  }
  return [a, b, c, d];
}

/** Rotiert die Kanten-Zuordnung weiter: die bisherige linke Seite wird zur Traufe. */
export function traufeWechseln(e: Ecken): Ecken {
  return [e[3], e[0], e[1], e[2]];
}

/** Einfacher Konvexitäts-/Reihenfolge-Test (alle Kreuzprodukte gleiches Vorzeichen). */
export function eckenPlausibel(e: Ecken): boolean {
  const kreuz = (i: number): number => {
    const a = e[i]!;
    const b = e[(i + 1) % 4]!;
    const c = e[(i + 2) % 4]!;
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  };
  const z = [kreuz(0), kreuz(1), kreuz(2), kreuz(3)];
  return z.every((k) => k > 0) || z.every((k) => k < 0);
}

export interface BelegungsCheck {
  status: 'ok' | 'warnung' | 'fehler';
  meldungen: string[];
  /** Maß-Vorschlag aus dem Foto (nur mit Ziegel-Maßstab), auf 0,1 m gerundet */
  vorschlag: { breiteM: number; hoeheM: number } | null;
}

/**
 * Belegungs-Check nach dem Markieren (deterministisch, kein LLM):
 * passt die markierte Fläche zu den eingegebenen Maßen?
 */
export function belegungsCheck(
  ecken: Ecken,
  breiteM: number,
  hoeheM: number,
  neigungDeg: number,
  pxProM: number | undefined,
  /** Erwartetes First/Traufe-Verhältnis (Trapez: firstBreiteM/breiteM, sonst 1). */
  erwarteterFirstAnteil = 1,
  flaechenArt: 'dach' | 'flachdach' | 'fassade' = 'dach',
): BelegungsCheck {
  const meldungen: string[] = [];
  if (!eckenPlausibel(ecken)) {
    return {
      status: 'fehler',
      meldungen: [
        'Die 4 Ecken bilden kein sauberes Viereck — Reihenfolge prüfen: Traufe links → Traufe rechts → First rechts → First links.',
      ],
      vorschlag: null,
    };
  }

  const traufePx = laenge(ecken[0], ecken[1]);
  const firstPx = laenge(ecken[3], ecken[2]);
  const perspektive = firstPx / (traufePx || 1);
  let status: BelegungsCheck['status'] = 'ok';
  let vorschlag: BelegungsCheck['vorschlag'] = null;

  if (pxProM !== undefined && pxProM > 0) {
    const breiteFoto = traufePx / pxProM;
    // Die Neigungskorrektur gilt nur für die verkürzte Draufsicht eines Dachs.
    // Eine Fassade wird frontal in ihrer eigenen Ebene markiert; cos(90°) würde
    // die Höhe sonst praktisch durch null teilen.
    const cosN = flaechenArt === 'fassade'
      ? 1
      : Math.cos((neigungDeg * Math.PI) / 180) || 1;
    const seitePx = (laenge(ecken[0], ecken[3]) + laenge(ecken[1], ecken[2])) / 2;
    const hoeheFoto = seitePx / pxProM / cosN;
    vorschlag = {
      breiteM: Math.round(breiteFoto * 10) / 10,
      hoeheM: Math.round(hoeheFoto * 10) / 10,
    };
    const abwB = Math.abs(breiteFoto - breiteM) / breiteM;
    const abwH = Math.abs(hoeheFoto - hoeheM) / hoeheM;
    if (abwB > 0.1) {
      status = 'warnung';
      meldungen.push(
        `${flaechenArt === 'dach' ? 'Traufe' : 'Breite'} im Foto ≈ ${vorschlag.breiteM.toLocaleString('de-DE')} m, eingegeben ${breiteM.toLocaleString('de-DE')} m (${Math.round(abwB * 100)} % Abweichung).`,
      );
    }
    if (abwH > 0.15) {
      status = 'warnung';
      meldungen.push(
        `${flaechenArt === 'dach' ? 'Sparrenlänge' : flaechenArt === 'fassade' ? 'Höhe' : 'Tiefe'} laut Foto grob ≈ ${vorschlag.hoeheM.toLocaleString('de-DE')} m, eingegeben ${hoeheM.toLocaleString('de-DE')} m.`,
      );
    }
    if (meldungen.length === 0) {
      meldungen.push(
        `Maße plausibel: ${flaechenArt === 'dach' ? 'Traufe' : 'Breite'} im Foto ≈ ${vorschlag.breiteM.toLocaleString('de-DE')} m ↔ eingegeben ${breiteM.toLocaleString('de-DE')} m.`,
      );
    }
  } else {
    meldungen.push(
      flaechenArt === 'dach'
        ? 'Kein Ziegel-Maßstab gesetzt — Maße können nicht gegen das Foto geprüft werden („Ziegel zählen“ liefert den Check).'
        : 'Kein zusätzlicher Foto-Maßstab gesetzt — die eingegebenen Maße werden nicht gegen das Foto geprüft.',
    );
  }

  // First/Traufe-Verhältnis: NUR ein informativer Schräg-Hinweis bei Rechteck-
  // Flächen. Aus dem Pixel-Verhältnis lässt sich KEIN Maßfehler ableiten (Genrih
  // 08.07.): First liegt höher = näher an der Drohne und erscheint im Foto größer —
  // das ist normale Perspektive, kein Kippen. Bei Trapez/Schief ist ein
  // abweichendes Verhältnis erst recht erwartet. Ground Truth bleibt der Blick:
  // laufen die Module parallel zu den Ziegellinien, stimmt die Markierung.
  if (
    flaechenArt === 'dach' &&
    erwarteterFirstAnteil >= 0.98 &&
    (perspektive < 0.8 || perspektive > 1.25)
  ) {
    meldungen.push(
      `Foto ist schräg aufgenommen (First/Traufe im Bild ${Math.round(perspektive * 100)} %) — ` +
        'die Platzierung ist perspektivisch korrekt, die Höhen-Schätzung aus dem Foto aber nur grob. Aufmaß geht vor.',
    );
  }

  return { status, meldungen, vorschlag };
}
