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

export type Punkt = [number, number];

/** Ecken der Dachfläche im Foto. Reihenfolge: Traufe links, Traufe rechts, First rechts, First links. */
export type Ecken = [Punkt, Punkt, Punkt, Punkt];

/** 3×3-Matrix, zeilenweise. */
type M3 = [number, number, number, number, number, number, number, number, number];

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
 * Homographie Flächen-Koordinaten (Meter, Ursprung First links, y zur Traufe)
 * → Foto-Pixel. null bei entarteten Ecken.
 */
export function homographie(breiteM: number, hoeheM: number, ecken: Ecken): M3 | null {
  if (breiteM <= 0 || hoeheM <= 0) return null;
  const src: Ecken = [
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

  if (perspektive < 0.8 || perspektive > 1.25) {
    meldungen.push(
      'Foto ist deutlich schräg aufgenommen (First/Traufe-Verhältnis ' +
        `${Math.round(perspektive * 100)} %) — Platzierung ist perspektivisch korrekt, ` +
        'die Höhen-Schätzung aus dem Foto aber nur grob. Aufmaß geht vor.',
    );
  }

  return { status, meldungen, vorschlag };
}
