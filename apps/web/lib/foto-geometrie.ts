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

/** Ecken der Dachfläche im Foto. Reihenfolge: Traufe links, Traufe rechts, First rechts, First links. */
export type Ecken = [Punkt, Punkt, Punkt, Punkt];

/** 3×3-Matrix, zeilenweise. */
type M3 = [number, number, number, number, number, number, number, number, number];

/** Öffentlicher Alias für eine Homographie-Matrix (Rückgabe von `homographie`). */
export type Homographie = M3;

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
  const h = mult(basisZu(ecken), adjugat(basisZu(src)));
  return h.every((n) => Number.isFinite(n)) ? h : null;
}

export function projiziere(h: M3, [x, y]: Punkt): Punkt {
  const w = h[6] * x + h[7] * y + h[8];
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

/** SVG-Pfad eines in Foto-Pixel projizierten Polygons (Flächen-Koordinaten in m). */
export function projPfad(h: M3, punkte: Punkt[]): string {
  return (
    'M' +
    punkte
      .map((p) => {
        const [x, y] = projiziere(h, p);
        return `${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join('L') +
    'Z'
  );
}

function laenge(a: Punkt, b: Punkt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Umriss aus Foto-Klicks: Pixel → Flächen-Koordinaten (Meter) via inverser
 * Homographie, geklemmt auf [0..breiteM]×[0..hoeheM]. Geteilt von Einzelfoto und
 * Gesamtfoto, damit beide identisch rechnen. null bei < 3 Punkten / entarteten Ecken.
 */
export function umrissAusKlicks(
  pts: Punkt[],
  breiteM: number,
  hoeheM: number,
  ecken: Ecken,
  quelle?: Ecken,
): PunktM[] | null {
  if (pts.length < 3) return null;
  const hinv = inverseHomographie(breiteM, hoeheM, ecken, quelle);
  if (!hinv) return null;
  return pts.map((p) => {
    const [x, y] = projiziere(hinv, p);
    return [Math.max(0, Math.min(breiteM, x)), Math.max(0, Math.min(hoeheM, y))] as PunktM;
  });
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
  const rect: RechteckM = {
    xM: cl(Math.min(ax, bx), breiteM),
    yM: cl(Math.min(ay, by), hoeheM),
    breiteM: Math.abs(bx - ax),
    hoeheM: Math.abs(by - ay),
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
    const cosN = Math.cos((neigungDeg * Math.PI) / 180) || 1;
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
        `Traufe im Foto ≈ ${vorschlag.breiteM.toLocaleString('de-DE')} m, eingegeben ${breiteM.toLocaleString('de-DE')} m (${Math.round(abwB * 100)} % Abweichung).`,
      );
    }
    if (abwH > 0.15) {
      status = 'warnung';
      meldungen.push(
        `Sparrenlänge laut Foto grob ≈ ${vorschlag.hoeheM.toLocaleString('de-DE')} m, eingegeben ${hoeheM.toLocaleString('de-DE')} m.`,
      );
    }
    if (meldungen.length === 0) {
      meldungen.push(
        `Maße plausibel: Traufe im Foto ≈ ${vorschlag.breiteM.toLocaleString('de-DE')} m ↔ eingegeben ${breiteM.toLocaleString('de-DE')} m.`,
      );
    }
  } else {
    meldungen.push(
      'Kein Ziegel-Maßstab gesetzt — Maße können nicht gegen das Foto geprüft werden („Ziegel zählen“ liefert den Check).',
    );
  }

  // First/Traufe-Verhältnis: NUR ein informativer Schräg-Hinweis bei Rechteck-
  // Flächen. Aus dem Pixel-Verhältnis lässt sich KEIN Maßfehler ableiten (Genrih
  // 08.07.): First liegt höher = näher an der Drohne und erscheint im Foto größer —
  // das ist normale Perspektive, kein Kippen. Bei Trapez/Schief ist ein
  // abweichendes Verhältnis erst recht erwartet. Ground Truth bleibt der Blick:
  // laufen die Module parallel zu den Ziegellinien, stimmt die Markierung.
  if (erwarteterFirstAnteil >= 0.98 && (perspektive < 0.8 || perspektive > 1.25)) {
    meldungen.push(
      `Foto ist schräg aufgenommen (First/Traufe im Bild ${Math.round(perspektive * 100)} %) — ` +
        'die Platzierung ist perspektivisch korrekt, die Höhen-Schätzung aus dem Foto aber nur grob. Aufmaß geht vor.',
    );
  }

  return { status, meldungen, vorschlag };
}
