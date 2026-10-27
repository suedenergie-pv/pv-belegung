import type { PunktM } from '@pv-belegung/engine';
import {
  homographie,
  inverseHomographie,
  projiziere,
  pruefePerspektive,
  type Ecken,
  type Homographie,
  type Punkt,
} from './foto-geometrie';

/**
 * Ein tatsächlich gemessenes Rechteck AUF derselben Dachebene. Die Reihenfolge
 * gehört zur Messung: unten links, unten rechts, oben rechts, oben links.
 * Die erste Seite entspricht breiteM, die angrenzende Seite hoeheM. "Unten"
 * bezeichnet die Referenzachse, nicht die untere Bildschirmkante.
 * Vier beliebige Dachpunkte oder eine geschätzte Dreiecksecke sind keine Referenz.
 */
export interface FotoReferenz {
  breiteM: number;
  hoeheM: number;
  eckenPx: Ecken;
}

export type FotoReferenzFehlerCode =
  | 'referenz_masse'
  | 'referenz_ecken'
  | 'referenz_perspektive'
  | 'umriss_punkte'
  | 'umriss_selbstschnitt'
  | 'umriss_entartet'
  | 'fluchtgrenze'
  | 'rahmen_perspektive';

export interface FotoReferenzFehler {
  ok: false;
  code: FotoReferenzFehlerCode;
  grund: string;
}

interface FotoReferenzQualitaet {
  qualitaet: 'ok' | 'warnung';
  meldungen: string[];
  massstabVerhaeltnis: number;
}

export type FotoReferenzPruefung = FotoReferenzFehler | ({ ok: true } & FotoReferenzQualitaet);

export type DachAusFotoReferenz = FotoReferenzFehler | ({
  ok: true;
  breiteM: number;
  hoeheM: number;
  umrissM: PunktM[];
  /** Virtueller RECHTECKRAHMEN, nicht die angeklickten echten Dachrandpunkte. */
  eckenPx: Ecken;
  /** Ursprung des neuen Dachrahmens im Koordinatensystem der echten Referenz. */
  ursprungM: PunktM;
  /** 1 = innerhalb der Referenz; 3 = bis eine Referenzbreite/-höhe außerhalb. */
  extrapolationsFaktor: number;
} & FotoReferenzQualitaet);

function fehler(code: FotoReferenzFehlerCode, grund: string): FotoReferenzFehler {
  return { ok: false, code, grund };
}

function endlich(p: readonly number[]): boolean {
  return p.length === 2 && p.every(Number.isFinite);
}

/**
 * Der homogene Nenner ist linear. Gleiches Vorzeichen an allen Eckpunkten
 * beweist daher auch für die gesamte konvexe Hülle, dass keine Fluchtlinie
 * geschnitten wird. Zusätzlich schützt ein relativer Abstand vor Auslöschung.
 */
function endlicherBereich(h: Homographie, punkte: readonly PunktM[]): boolean {
  const nenner = punkte.map(([x, y]) => h[6] * x + h[7] * y + h[8]);
  const groessterNenner = Math.max(...nenner.map(Math.abs));
  const vorzeichen = Math.sign(nenner[0] ?? 0);
  if (vorzeichen === 0 || !Number.isFinite(groessterNenner)) return false;
  return punkte.every(([x, y], i) => {
    const w = nenner[i]!;
    const groesse = Math.abs(h[6] * x) + Math.abs(h[7] * y) + Math.abs(h[8]);
    return Number.isFinite(w) && Number.isFinite(groesse)
      && Math.sign(w) === vorzeichen
      && Math.abs(w) > Math.max(groesse, groessterNenner) * 1e-9;
  });
}

/** Normierte Koordinaten vermeiden pixel-/meterabhängige Schnitt-Toleranzen. */
export function pruefeFotoUmriss(punkte: readonly PunktM[]): FotoReferenzFehler | null {
  if (punkte.length < 3 || !punkte.every(endlich)) {
    return fehler('umriss_punkte', 'Markiere mindestens drei verschiedene Ecken des Dachrands.');
  }
  const minX = Math.min(...punkte.map(p => p[0]));
  const minY = Math.min(...punkte.map(p => p[1]));
  const breite = Math.max(...punkte.map(p => p[0])) - minX;
  const hoehe = Math.max(...punkte.map(p => p[1])) - minY;
  const skala = Math.max(breite, hoehe);
  if (!Number.isFinite(skala) || skala <= 0 || breite <= 0 || hoehe <= 0) {
    return fehler('umriss_entartet', 'Der Dachrand liegt auf einer Linie. Markiere eine vollständige Fläche.');
  }
  const p = punkte.map(([x, y]): Punkt => [(x - minX) / skala, (y - minY) / skala]);
  const eps = 1e-10;
  const kreuz = (a: PunktM, b: PunktM, c: PunktM) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const aufStrecke = (a: PunktM, b: PunktM, q: PunktM) =>
    Math.abs(kreuz(a, b, q)) <= eps
      && q[0] >= Math.min(a[0], b[0]) - eps && q[0] <= Math.max(a[0], b[0]) + eps
      && q[1] >= Math.min(a[1], b[1]) - eps && q[1] <= Math.max(a[1], b[1]) + eps;
  const schneidet = (a: PunktM, b: PunktM, c: PunktM, d: PunktM) => {
    const k1 = kreuz(a, b, c), k2 = kreuz(a, b, d), k3 = kreuz(c, d, a), k4 = kreuz(c, d, b);
    return ((k1 > eps && k2 < -eps || k1 < -eps && k2 > eps)
      && (k3 > eps && k4 < -eps || k3 < -eps && k4 > eps))
      || aufStrecke(a, b, c) || aufStrecke(a, b, d)
      || aufStrecke(c, d, a) || aufStrecke(c, d, b);
  };
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!, c = p[(i + 2) % p.length]!;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps) {
      return fehler('umriss_punkte', 'Zwei Dachecken liegen übereinander. Verschiebe oder entferne eine davon.');
    }
    if (Math.abs(kreuz(a, b, c)) <= eps
      && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < -eps) {
      return fehler('umriss_selbstschnitt', 'Der Dachrand läuft auf einer Kante zurück. Markiere die Ecken der Reihe nach.');
    }
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      if (schneidet(a, b, p[j]!, p[(j + 1) % p.length]!)) {
        return fehler('umriss_selbstschnitt', 'Der Dachrand kreuzt oder berührt sich selbst. Markiere die Ecken der Reihe nach.');
      }
    }
  }
  const doppelteFlaeche = p.reduce((summe, a, i) => {
    const b = p[(i + 1) % p.length]!;
    return summe + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return Math.abs(doppelteFlaeche) <= eps
    ? fehler('umriss_entartet', 'Die markierte Fläche ist zu schmal. Prüfe die Lage der Dachecken.')
    : null;
}

/** Vorprüfung für den geführten Schritt "Gemessenes Rechteck". */
export function pruefeFotoReferenz(referenz: FotoReferenz): FotoReferenzPruefung {
  const { breiteM, hoeheM, eckenPx } = referenz;
  if (!Number.isFinite(breiteM) || !Number.isFinite(hoeheM) || breiteM <= 0 || hoeheM <= 0) {
    return fehler('referenz_masse', 'Gib die gemessene Breite und Tiefe des Rechtecks größer als null ein.');
  }
  if (eckenPx.length !== 4 || !eckenPx.every(endlich)) {
    return fehler('referenz_ecken', 'Markiere die vier Ecken des gemessenen Rechtecks der Reihe nach.');
  }
  const perspektive = pruefePerspektive(breiteM, hoeheM, eckenPx);
  if (perspektive.status === 'fehler' || perspektive.massstabVerhaeltnis === null) {
    return fehler('referenz_perspektive', perspektive.meldungen.join(' '));
  }
  const meldungen = [...perspektive.meldungen];
  const kleinsteSeitePx = Math.min(...eckenPx.map((p, i) => {
    const q = eckenPx[(i + 1) % 4]!;
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  }));
  if (kleinsteSeitePx < 24) {
    meldungen.push('Das gemessene Rechteck ist im Foto sehr klein. Nutze möglichst ein größeres Rechteck auf derselben Dachfläche, damit kleine Klickabweichungen weniger Einfluss haben.');
  }
  return {
    ok: true,
    qualitaet: meldungen.length ? 'warnung' : 'ok',
    meldungen,
    massstabVerhaeltnis: perspektive.massstabVerhaeltnis,
  };
}

/**
 * Ein beliebiger, einfacher Dachumriss wird mittels der gemessenen Referenz in
 * Meter zurückgerechnet. Die Normalisierung verschiebt nur den Ursprung;
 * die physische Größe und die Fotoabbildung bleiben exakt erhalten.
 *
 * Die UI muss die reale Messung, gemeinsame Ebene und das Ergebnis bestätigen
 * lassen. Dieser Helper kann unzutreffende Eingaben nicht aus dem Foto erkennen.
 */
export function dachAusFotoReferenz(
  referenz: FotoReferenz,
  umrissPx: readonly PunktM[],
): DachAusFotoReferenz {
  const pruefung = pruefeFotoReferenz(referenz);
  if (!pruefung.ok) return pruefung;
  const umrissFehler = pruefeFotoUmriss(umrissPx);
  if (umrissFehler) return umrissFehler;
  const { breiteM: refB, hoeheM: refH, eckenPx: refEcken } = referenz;
  const h = homographie(refB, refH, refEcken);
  const inv = inverseHomographie(refB, refH, refEcken);
  if (!h || !inv) return fehler('referenz_perspektive', 'Die gemessene Referenz lässt sich nicht zurückrechnen. Prüfe ihre vier Ecken.');
  if (!endlicherBereich(inv, [...refEcken, ...umrissPx])) {
    return fehler('fluchtgrenze', 'Der Dachrand liegt außerhalb der stabilen Fotoperspektive. Wähle eine passendere Referenz oder ein anderes Foto derselben Dachfläche.');
  }
  const metrisch = umrissPx.map(p => projiziere(inv, p));
  const metrischerFehler = pruefeFotoUmriss(metrisch);
  if (metrischerFehler) return metrischerFehler;
  const minX = Math.min(...metrisch.map(p => p[0])), minY = Math.min(...metrisch.map(p => p[1]));
  const maxX = Math.max(...metrisch.map(p => p[0])), maxY = Math.max(...metrisch.map(p => p[1]));
  const breiteM = maxX - minX, hoeheM = maxY - minY;
  const rahmen: Ecken = [[minX, maxY], [maxX, maxY], [maxX, minY], [minX, minY]];
  const refRahmen: Ecken = [[0, refH], [refB, refH], [refB, 0], [0, 0]];
  // Auch leere BBox-Ecken außerhalb eines Dreiecks/L-Umrisses müssen endlich sein:
  // Der bestehende Renderer und die Raster-Engine verwenden diesen ganzen Rahmen.
  if (!endlicherBereich(h, [...refRahmen, ...rahmen])) {
    return fehler('fluchtgrenze', 'Der Rahmen dieser Dachfläche überschreitet die stabile Fotoperspektive. Nutze ein geeigneteres Foto oder teile die Fläche auf.');
  }
  const eckenPx = rahmen.map(p => projiziere(h, p)) as Ecken;
  const rahmenPruefung = pruefePerspektive(breiteM, hoeheM, eckenPx);
  if (rahmenPruefung.status === 'fehler' || rahmenPruefung.massstabVerhaeltnis === null) {
    return fehler('rahmen_perspektive', rahmenPruefung.meldungen.join(' '));
  }
  const extrapolationsFaktor = Math.max(1, ...metrisch.flatMap(([x, y]) => [
    Math.abs(2 * x / refB - 1), Math.abs(2 * y / refH - 1),
  ]));
  const meldungen = [...new Set([...pruefung.meldungen, ...rahmenPruefung.meldungen])];
  if (extrapolationsFaktor > 3) {
    meldungen.push('Der Dachrand liegt weit außerhalb des gemessenen Rechtecks. Kleine Mess- oder Klickfehler wirken dort stärker. Prüfe die berechneten Dachmaße; nutze möglichst eine größere Referenz auf derselben Dachfläche.');
  }
  return {
    ok: true, breiteM, hoeheM, eckenPx,
    umrissM: metrisch.map(([x, y]) => [x - minX, y - minY]),
    ursprungM: [minX, minY], extrapolationsFaktor,
    qualitaet: meldungen.length ? 'warnung' : 'ok', meldungen,
    massstabVerhaeltnis: rahmenPruefung.massstabVerhaeltnis,
  };
}
