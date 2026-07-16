import { rechteckImUmriss, rechteckeUeberlappen, type PunktM, type RechteckM } from './geometrie';
import type { ModuleType } from './types';

/**
 * Belegungslogik (SPEC §9): Raster pro Dachfläche aus Modulmaß (mm, Katalog),
 * Ausrichtung hoch/quer, Klemmfuge und Randabstand. Modulgrößen kommen
 * AUSSCHLIESSLICH aus mm-Maßen × Maßstab (SPEC §3.5) — die UI rechnet nichts.
 * Seit 06.07.2026: optionaler Polygon-Umriss (Walm/Trapez/L-Form, beliebige
 * Eckenzahl) und Hindernis-Rechtecke (Kamin/Fenster/SAT) filtern das Raster —
 * das Rechteck Traufe × Sparren bleibt Rahmen und Koordinatensystem.
 */

/** Randabstand zu Traufe/First/Ortgang, Meter (SPEC §9, Admin-konfigurierbar; 0,05 seit 05.07.2026, Genrih) */
export const DEFAULT_RAND_M = 0.05;
/** Reihen-/Spaltenabstand (Klemmfuge), Meter (SPEC §9: Default 20 mm) */
export const DEFAULT_FUGE_M = 0.02;

export interface BelegungInput {
  /** Traufkante, Meter */
  breiteM: number;
  /** Falllinie/Sparrenlänge, Meter — WAHRE Maße, nicht Draufsicht (SPEC §4.1) */
  hoeheM: number;
  module: ModuleType;
  ausrichtung: 'hoch' | 'quer';
  randM?: number;
  fugeM?: number;
  /**
   * Optionaler Flächen-Umriss (≥ 3 Ecken, Flächen-Koordinaten in Meter,
   * Ursprung links oben). Module müssen komplett im Polygon liegen, mit
   * randM Abstand zu jeder Umrisskante. Ohne Umriss gilt das Rechteck.
   */
  umrissM?: readonly PunktM[];
  /** Hindernisse (Kamin, Fenster, SAT …): schneidende Module entfallen. */
  hindernisseM?: readonly RechteckM[];
  /**
   * Positions-Optimierung (Default true): bei Umriss das GANZE Raster als Block
   * horizontal so verschieben, dass insgesamt die meisten Module passen — Spalten
   * bleiben reihenübergreifend ausgerichtet. false = reines zentriertes Gitter.
   */
  optimierePosition?: boolean;
  /**
   * 'frei' (Genrih 08.07., „beschissene Dächer"): jede Reihe wird einzeln maximal
   * gefüllt — ohne die Schwelle, die den Reihen-Versatz sonst nur bei DEUTLICHEM
   * Gewinn zulässt. Für Parallelogramm-/Schrägdächer, wo pro Reihe nur 1–2 Module
   * gewonnen werden, in Summe aber viel. Default 'auto' = bisheriges Hybrid.
   */
  optimierung?: 'auto' | 'frei';
  /**
   * Ausrichtung je Band (Reihe) von oben (First) nach unten (Traufe). Fehlt ein
   * Eintrag, gilt `ausrichtung` (Basis). Sobald mindestens ein Band abweicht, wird
   * die Fläche als Stapel horizontaler Bänder gefüllt (gemischt hoch/quer, SPEC §9,
   * 07.07.2026): jedes Band hat seine eigene Modulhöhe, darunterliegende rutschen
   * nach — der ehrliche „Platz geht verloren"-Effekt.
   */
  baender?: readonly ('hoch' | 'quer')[];
  /**
   * Manueller Versatz der ganzen Belegung, Meter (Nudge, Genrih 07.07.). Ist einer
   * der Werte gesetzt (auch 0), wird das Gitter phasenverschoben in die Zone gelegt
   * und wie immer gefiltert: Module, die aus Rand/Umriss fallen oder ein Hindernis
   * treffen, entfallen; frei werdende Module kommen dazu. Der Auto-Optimierer
   * entfaellt in diesem Modus (Nutzer bzw. besterVersatz bestimmt die Lage).
   * Positiv X = nach rechts (Traufe), positiv Y = nach unten (Richtung Traufe).
   */
  versatzXM?: number;
  versatzYM?: number;
}

export interface ModulPosition {
  row: number;
  col: number;
  /** linke obere Ecke in Flächenkoordinaten, Meter (Ursprung: links oben) */
  xM: number;
  yM: number;
  /** true = dieses Modul ist quer verlegt (Ausrichtung des Bandes). */
  quer: boolean;
  /** Modulmaße dieses Moduls in Metern — je Band verschieden bei gemischter Ausrichtung. */
  wM: number;
  hM: number;
  /**
   * Index des Belegungsfelds (berechneFelderRaster, 16.07.2026), zu dem dieses
   * Modul gehört. row/col sind dann FELD-lokale Zellkoordinaten. Fehlt im
   * klassischen Auto-Raster (berechneRaster).
   */
  feld?: number;
}

export interface BelegungRaster {
  cols: number;
  rows: number;
  /** Modulmaß in der gewählten Ausrichtung, Meter (aus Katalog-mm) */
  modulBreiteM: number;
  modulHoeheM: number;
  positionen: ModulPosition[];
  randM: number;
  fugeM: number;
  /**
   * Anker der Gitterphase (16.07.2026): linke obere Ecke der Zelle (0,0) — jede
   * Modulposition liegt auf anker + k·pitch. Bezugspunkt für Dinge, die am RASTER
   * kleben sollen (z. B. endgültig gelöschte Felder in der UI): relativ zum Anker
   * gespeichert wandern sie automatisch mit Versatz/Optimierer mit.
   */
  ankerXM: number;
  ankerYM: number;
  /**
   * true = mindestens eine Reihe weicht vom ausgerichteten Block ab (Spalten
   * fluchten nicht). Der manuelle Versatz (EIN Gitter) kann diese Lage nicht
   * darstellen — die UI sperrt „Verschieben" dann ehrlich.
   */
  reihenVersetzt?: boolean;
}

/**
 * Achspositionen eines Gitters (Nudge): alle `anker + k·pitch`, die mit ihrer
 * Modulgröße komplett in [rand, dim − rand] liegen. `anker` legt die Phase fest;
 * so kann Verschieben am Rand eine Spalte/Reihe gewinnen oder verlieren.
 */
function gitterAchse(anker: number, pitch: number, size: number, rand: number, dim: number): number[] {
  if (pitch <= 0) return [];
  const maxPos = dim - rand;
  const k0 = Math.ceil((rand - anker) / pitch - 1e-9);
  const res: number[] = [];
  for (let v = anker + k0 * pitch; v + size <= maxPos + 1e-9; v += pitch) res.push(v);
  return res;
}

/**
 * Bester globaler Block-Versatz dx (Optimierer-Kandidat 1): das ganze Raster
 * horizontal so schieben, dass die meisten Module gültig sind; bei Gleichstand
 * gewinnt der kleinste |dx|. Geteilt zwischen berechneRaster und besterVersatz,
 * damit BEIDE dieselbe Standardlage als Anker benutzen (16.07.2026).
 */
function sucheBlockDx(a: {
  optimieren: boolean;
  x0: number;
  cols: number;
  pitchX: number;
  yPos: readonly number[];
  gueltig: (xM: number, yM: number) => boolean;
  dxMin: number;
  dxMax: number;
  schritt: number;
}): number {
  if (!a.optimieren) return 0;
  const EPS = 1e-4;
  const zaehle = (v: number): number => {
    let n = 0;
    for (const yM of a.yPos)
      for (let col = 0; col < a.cols; col++) if (a.gueltig(a.x0 + v + col * a.pitchX, yM)) n++;
    return n;
  };
  let dx = 0;
  let best = zaehle(0);
  let bestAbs = 0;
  for (let v = a.dxMin; v <= a.dxMax + EPS; v += a.schritt) {
    const n = zaehle(v);
    if (n > best || (n === best && Math.abs(v) < bestAbs - EPS)) {
      best = n;
      bestAbs = Math.abs(v);
      dx = v;
    }
  }
  return dx;
}

/**
 * Modulmaße (Meter) in einer Ausrichtung — einzige Quelle für „Modul in Metern"
 * (SPEC §3.5: mm aus dem Katalog ÷ 1000, nie CSS/Layout).
 */
function dimsVon(module: ModuleType, a: 'hoch' | 'quer'): { w: number; h: number } {
  return {
    w: (a === 'hoch' ? module.widthMm : module.lengthMm) / 1000,
    h: (a === 'hoch' ? module.lengthMm : module.widthMm) / 1000,
  };
}

/**
 * Zonen-Prüfung „darf hier ein Modul liegen?" — Umriss (mit randM Abstand zu jeder
 * Kante) und Hindernisse. Geteilt zwischen berechneRaster und berechneFelderRaster
 * (16.07.2026), damit beide Pfade dieselbe Wahrheit über die Zone haben.
 */
function zonenPruefer(input: {
  umrissM?: readonly PunktM[];
  hindernisseM?: readonly RechteckM[];
  randM: number;
}): (xM: number, yM: number, w: number, h: number) => boolean {
  const umriss = input.umrissM && input.umrissM.length >= 3 ? input.umrissM : null;
  const hindernisse = input.hindernisseM ?? [];
  return (xM, yM, w, h) => {
    const rect: RechteckM = { xM, yM, breiteM: w, hoeheM: h };
    if (umriss && !rechteckImUmriss(rect, umriss, input.randM)) return false;
    return !hindernisse.some((hi) => rechteckeUeberlappen(rect, hi));
  };
}

export function berechneRaster(input: BelegungInput): BelegungRaster {
  const randM = input.randM ?? DEFAULT_RAND_M;
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const dimsFuer = (a: 'hoch' | 'quer') => dimsVon(input.module, a);
  const basisA = input.ausrichtung;
  const { w: modulBreiteM, h: modulHoeheM } = dimsFuer(basisA);

  const nutzB = input.breiteM - 2 * randM;
  const nutzH = input.hoeheM - 2 * randM;

  const umriss = input.umrissM && input.umrissM.length >= 3 ? input.umrissM : null;
  const hindernisse = input.hindernisseM ?? [];
  const EPS = 1e-4;

  const gueltigDim = zonenPruefer({ ...input, randM });

  // ---- Gemischte Ausrichtung: Bänder-Stapel (SPEC §9, 07.07.2026) ----
  // Sobald mindestens ein Band von der Basis-Ausrichtung abweicht, wird die Fläche
  // als Stapel horizontaler Bänder von der First-Seite (y=0) zur Traufe gefüllt.
  // Jedes Band hat seine eigene Modulhöhe; darunterliegende rutschen nach. Kein
  // Block-/Reihen-Optimierer hier — bewusst einfach, zentriert und vorhersehbar.
  const mix = !!input.baender && input.baender.some((b) => b !== basisA);
  if (mix) {
    const positionen: ModulPosition[] = [];
    const grenzeUnten = input.hoeheM - randM + EPS;
    let y = randM;
    for (let band = 0; band < 1000; band++) {
      const a = input.baender![band] ?? basisA;
      const { w, h } = dimsFuer(a);
      if (y + h > grenzeUnten) break;
      const colsB = nutzB >= w ? Math.floor((nutzB + fugeM) / (w + fugeM)) : 0;
      if (colsB > 0) {
        const belegtBandB = colsB * w + (colsB - 1) * fugeM;
        const bx0 = randM + (nutzB - belegtBandB) / 2;
        let col = 0;
        for (let c = 0; c < colsB; c++) {
          const xM = bx0 + c * (w + fugeM);
          if (gueltigDim(xM, y, w, h))
            positionen.push({ row: band, col: col++, xM, yM: y, quer: a === 'quer', wM: w, hM: h });
        }
      }
      y += h + fugeM;
    }
    const rowsMix = positionen.reduce((m, p) => Math.max(m, p.row + 1), 0);
    const colsMix = positionen.reduce((m, p) => Math.max(m, p.col + 1), 0);
    return {
      cols: colsMix,
      rows: rowsMix,
      modulBreiteM,
      modulHoeheM,
      positionen,
      randM,
      fugeM,
      // Bänder-Stapel hat kein einheitliches Gitter — Anker = Zonen-Ecke (Näherung).
      ankerXM: randM,
      ankerYM: randM,
    };
  }

  // ---- Einheitliches Raster (Basis-Ausrichtung) + Optimierer (wie bisher) ----
  const cols =
    nutzB >= modulBreiteM ? Math.floor((nutzB + fugeM) / (modulBreiteM + fugeM)) : 0;
  const rows =
    nutzH >= modulHoeheM ? Math.floor((nutzH + fugeM) / (modulHoeheM + fugeM)) : 0;

  // Belegung mittig in der Nutzfläche
  const belegtB = cols > 0 ? cols * modulBreiteM + (cols - 1) * fugeM : 0;
  const belegtH = rows > 0 ? rows * modulHoeheM + (rows - 1) * fugeM : 0;
  const x0 = randM + (nutzB - belegtB) / 2;
  const y0 = randM + (nutzH - belegtH) / 2;

  const pitchX = modulBreiteM + fugeM;
  const pitchY = modulHoeheM + fugeM;
  const gueltig = (xM: number, yM: number): boolean =>
    gueltigDim(xM, yM, modulBreiteM, modulHoeheM);

  const schritt = pitchX / 24;
  const yPos: number[] = [];
  for (let row = 0; row < rows; row++) yPos.push(y0 + row * pitchY);
  // Optimieren lohnt, sobald etwas das Raster beschneidet. Ohne Umriss (reines
  // Rechteck mit Hindernissen) NUR bei ausdrücklichem 'frei' — sonst bliebe die
  // Standardbelegung nicht mehr zentriert/vorhersehbar. (Bis 13.07.2026 lief der
  // Optimierer ausschließlich bei Umriss — dadurch war „Reihen frei versetzen"
  // bei Rechteck-Dächern mit Kamin/Fenster wirkungslos, Genrih.)
  const optimieren =
    (!!umriss || (hindernisse.length > 0 && input.optimierung === 'frei')) &&
    cols > 0 &&
    rows > 0 &&
    (input.optimierePosition ?? true);

  // Roh = Position ohne Ausrichtungs-/Maß-Annotation (im Einheitspfad überall gleich).
  type Roh = { row: number; col: number; xM: number; yM: number };
  const querBasis = basisA === 'quer';
  const annotiere = (roh: Roh[]): ModulPosition[] =>
    roh.map((p) => ({ ...p, quer: querBasis, wM: modulBreiteM, hM: modulHoeheM }));

  /**
   * Positions-Optimierung (SPEC §9, Stand 07.07.2026). Zwei Kandidaten:
   * (1) AUSGERICHTET — das ganze Raster als Block horizontal verschieben, Spalten
   *     bleiben reihenübergreifend gerade. Das ist der Standard: sieht sauber aus,
   *     kein Reihen-Versatz. (2) REIHENWEISE — jede Reihe darf einzeln abweichen,
   *     falls sie dadurch strikt mehr Module fasst (schräge/komplexe Dächer).
   * Reihenweise wird NUR genommen, wenn es deutlich mehr Module bringt (Schwelle),
   * sonst gerade montieren wenn offensichtlich Platz ist (Genrih 07.07.).
   */

  // (1) Bester globaler Block-Versatz dx — auch als ANKER des Versatz-Pfads:
  // versatz (0,0) muss exakt der Standardlage entsprechen, sonst springt die
  // Belegung beim Einschalten von „Verschieben" und relativ gespeicherte
  // Lösch-Felder passen nicht mehr (Bug 16.07.2026, Genrih).
  const dx = sucheBlockDx({
    optimieren,
    x0,
    cols,
    pitchX,
    yPos,
    gueltig,
    dxMin: -x0,
    dxMax: input.breiteM - belegtB - x0,
    schritt,
  });
  const basisX0 = x0 + dx;

  // ---- Manueller Versatz (Nudge, 07.07.2026) ----
  // Ist ein Versatz gesetzt, wird das Gitter phasenverschoben ab der OPTIMIERTEN
  // Standardlage (basisX0/y0) + Versatz gelegt und wie immer gefiltert. Der
  // Reihen-Kandidat entfällt (ein Gitter, eine Phase).
  if (input.versatzXM !== undefined || input.versatzYM !== undefined) {
    const ax = basisX0 + (input.versatzXM ?? 0);
    const ay = y0 + (input.versatzYM ?? 0);
    const xs = gitterAchse(ax, pitchX, modulBreiteM, randM, input.breiteM);
    const ys = gitterAchse(ay, pitchY, modulHoeheM, randM, input.hoeheM);
    const roh: Roh[] = [];
    ys.forEach((yM, iy) =>
      xs.forEach((xM, ix) => {
        if (gueltig(xM, yM)) roh.push({ row: iy, col: ix, xM, yM });
      }),
    );
    return {
      cols: xs.length,
      rows: ys.length,
      modulBreiteM,
      modulHoeheM,
      positionen: annotiere(roh),
      randM,
      fugeM,
      ankerXM: ax,
      ankerYM: ay,
    };
  }

  const ausgerichtet: Roh[] = [];
  for (let row = 0; row < rows; row++) {
    const yM = yPos[row]!;
    for (let col = 0; col < cols; col++) {
      const xM = basisX0 + col * pitchX;
      if (gueltig(xM, yM)) ausgerichtet.push({ row, col, xM, yM });
    }
  }

  // (2) Reihenweiser Kandidat: je Reihe vom Block abweichen, nur bei echtem Gewinn.
  let reihenweise: Roh[] | null = null;
  if (optimieren) {
    const maxRechts = input.breiteM - randM + EPS;
    // Unwucht = |linker Rand − rechter Rand| → zentriert, wenn eine Reihe abweicht.
    const unwucht = (xs: number[]): number =>
      xs.length === 0
        ? Infinity
        : Math.abs(xs[0]! - randM - (input.breiteM - randM - (xs[xs.length - 1]! + modulBreiteM)));
    reihenweise = [];
    for (let row = 0; row < rows; row++) {
      const yM = yPos[row]!;
      const basis: number[] = [];
      for (let col = 0; col < cols; col++) {
        const xM = basisX0 + col * pitchX;
        if (gueltig(xM, yM)) basis.push(xM);
      }
      let beste = basis;
      let besteUnwucht = unwucht(basis);
      for (let off = randM; off <= randM + pitchX + EPS; off += schritt) {
        const xs: number[] = [];
        for (let xM = off; xM + modulBreiteM <= maxRechts; xM += pitchX) {
          if (gueltig(xM, yM)) xs.push(xM);
        }
        const u = unwucht(xs);
        if (xs.length > beste.length || (xs.length === beste.length && u < besteUnwucht - EPS)) {
          beste = xs;
          besteUnwucht = u;
        }
      }
      // Nur abweichen, wenn die Reihe dadurch strikt mehr Module fasst; sonst
      // am ausgerichteten Block bleiben (Spaltenindex bleibt → gerade Montage).
      if (beste.length > basis.length) {
        beste.forEach((xM, i) => reihenweise!.push({ row, col: i, xM, yM }));
      } else {
        let col = 0;
        for (let c = 0; c < cols; c++) {
          const xM = basisX0 + c * pitchX;
          if (gueltig(xM, yM)) reihenweise!.push({ row, col: col++, xM, yM });
        }
      }
    }
  }

  // Auswahl: 'frei' nimmt den reihenweisen Kandidaten, sobald er mindestens
  // gleichzieht (jede Reihe maximal füllen — Parallelogramm/Schrägdach).
  // 'auto' (Default) nur bei DEUTLICHEM Gewinn (sonst gerade montieren).
  const schwelle =
    input.optimierung === 'frei' ? 0 : Math.max(2, Math.ceil(ausgerichtet.length * 0.1));
  const roh =
    reihenweise && reihenweise.length >= ausgerichtet.length + schwelle
      ? reihenweise
      : ausgerichtet;
  // Weicht die gewählte Lage tatsächlich vom Block ab? (Bei 'frei' kann der
  // Reihen-Kandidat inhaltlich identisch sein — dann ist nichts versetzt.)
  const reihenVersetzt =
    roh !== ausgerichtet &&
    (roh.length !== ausgerichtet.length ||
      roh.some((p, i) => Math.abs(p.xM - ausgerichtet[i]!.xM) > 1e-9));

  return {
    cols,
    rows,
    modulBreiteM,
    modulHoeheM,
    positionen: annotiere(roh),
    randM,
    fugeM,
    ankerXM: basisX0,
    ankerYM: y0,
    reihenVersetzt,
  };
}

/**
 * Sucht den Versatz (relativ zur optimierten Standardlage), bei dem die MEISTEN
 * Module passen — cm-genau über eine volle Gitterphase (± halbe Modulteilung je
 * Achse). Bei Gleichstand gewinnt der kleinste Versatz (nah an der Mitte). Löst
 * den „wegen 2 cm fehlt ein Modul"-Fall per Klick (Genrih 07.07.).
 */
export function besterVersatz(input: BelegungInput): { versatzXM: number; versatzYM: number } {
  const randM = input.randM ?? DEFAULT_RAND_M;
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const modulBreiteM =
    (input.ausrichtung === 'hoch' ? input.module.widthMm : input.module.lengthMm) / 1000;
  const modulHoeheM =
    (input.ausrichtung === 'hoch' ? input.module.lengthMm : input.module.widthMm) / 1000;
  const nutzB = input.breiteM - 2 * randM;
  const nutzH = input.hoeheM - 2 * randM;
  const cols = nutzB >= modulBreiteM ? Math.floor((nutzB + fugeM) / (modulBreiteM + fugeM)) : 0;
  const rows = nutzH >= modulHoeheM ? Math.floor((nutzH + fugeM) / (modulHoeheM + fugeM)) : 0;
  const x0 = randM + (nutzB - (cols > 0 ? cols * modulBreiteM + (cols - 1) * fugeM : 0)) / 2;
  const y0 = randM + (nutzH - (rows > 0 ? rows * modulHoeheM + (rows - 1) * fugeM : 0)) / 2;
  const pitchX = modulBreiteM + fugeM;
  const pitchY = modulHoeheM + fugeM;
  const umriss = input.umrissM && input.umrissM.length >= 3 ? input.umrissM : null;
  const hindernisse = input.hindernisseM ?? [];

  // Derselbe Block-Anker wie in berechneRaster (versatz relativ zur Standardlage):
  // ohne das zählt besterVersatz auf einem anders verankerten Gitter und der
  // zurückgegebene Versatz träfe eine andere Lage, als berechneRaster dann legt.
  const gueltigDim = (xM: number, yM: number): boolean => {
    const rect: RechteckM = { xM, yM, breiteM: modulBreiteM, hoeheM: modulHoeheM };
    if (umriss && !rechteckImUmriss(rect, umriss, randM)) return false;
    return !hindernisse.some((h) => rechteckeUeberlappen(rect, h));
  };
  const yPos: number[] = [];
  for (let row = 0; row < rows; row++) yPos.push(y0 + row * pitchY);
  const belegtB = cols > 0 ? cols * modulBreiteM + (cols - 1) * fugeM : 0;
  const optimieren =
    (!!umriss || (hindernisse.length > 0 && input.optimierung === 'frei')) &&
    cols > 0 &&
    rows > 0 &&
    (input.optimierePosition ?? true);
  const dx = sucheBlockDx({
    optimieren,
    x0,
    cols,
    pitchX,
    yPos,
    gueltig: gueltigDim,
    dxMin: -x0,
    dxMax: input.breiteM - belegtB - x0,
    schritt: pitchX / 24,
  });
  const basisX0 = x0 + dx;

  // Zählung inline (ohne berechneRaster/Objekt-Kopie je Versuch → schnell genug für viele Kandidaten).
  const anzahl = (vx: number, vy: number): number => {
    const xs = gitterAchse(basisX0 + vx, pitchX, modulBreiteM, randM, input.breiteM);
    const ys = gitterAchse(y0 + vy, pitchY, modulHoeheM, randM, input.hoeheM);
    let n = 0;
    for (const yM of ys)
      for (const xM of xs) {
        const rect: RechteckM = { xM, yM, breiteM: modulBreiteM, hoeheM: modulHoeheM };
        if (umriss && !rechteckImUmriss(rect, umriss, randM)) continue;
        if (hindernisse.some((h) => rechteckeUeberlappen(rect, h))) continue;
        n++;
      }
    return n;
  };

  type Kand = { n: number; vx: number; vy: number };
  const suche = (
    xMin: number, xMax: number, yMin: number, yMax: number, schritt: number, start: Kand,
  ): Kand => {
    let best = start;
    for (let vy = yMin; vy <= yMax + 1e-9; vy += schritt) {
      for (let vx = xMin; vx <= xMax + 1e-9; vx += schritt) {
        const n = anzahl(vx, vy);
        const naeher = Math.hypot(vx, vy) < Math.hypot(best.vx, best.vy) - 1e-9;
        if (n > best.n || (n === best.n && naeher)) best = { n, vx, vy };
      }
    }
    return best;
  };

  // Grob (5 cm) über die volle Gitterphase, dann fein (1 cm) um den besten Punkt.
  const spanX = pitchX / 2;
  const spanY = pitchY / 2;
  const grob = suche(-spanX, spanX, -spanY, spanY, 0.05, { n: -1, vx: 0, vy: 0 });
  const fein = suche(grob.vx - 0.05, grob.vx + 0.05, grob.vy - 0.05, grob.vy + 0.05, 0.01, grob);
  return { versatzXM: Math.round(fein.vx * 100) / 100, versatzYM: Math.round(fein.vy * 100) / 100 };
}

/* ==========================================================================
 * BELEGUNGSFELDER (16.07.2026, Genrih: „Belegungsautomatismus mildern")
 *
 * Statt einer automatisch optimierten Vollbelegung zieht der Nutzer beliebig
 * viele Rechtecke („Felder") ins Dach; jedes Feld füllt sich mit so vielen
 * Modulen, wie hineinpassen. Kein Optimierer, kein Versatz, keine Magie — die
 * Lage kommt ausschließlich aus dem, was der Nutzer gezogen hat (SolarEdge-
 * Designer-Prinzip). Ragt ein Feld über Rand/Umriss/Hindernis, entfallen die
 * betroffenen Module einfach.
 * ========================================================================== */

/** Ein Belegungsfeld: vom Nutzer gezogenes Rechteck in Flächen-Metern. */
export interface BelegungsFeldM {
  xM: number;
  yM: number;
  breiteM: number;
  hoeheM: number;
  /** true = Module quer. Wird beim Anlegen aus der Flächen-Ausrichtung gesetzt. */
  quer: boolean;
  /**
   * Dauerhaft leere Zellen als "row-col" (FELD-lokale Zellkoordinaten). Weil die
   * Identität an der ZELLE hängt und nicht an einer Dach-Koordinate, wandern die
   * Löcher beim Verschieben des Felds von selbst mit — die 13./16.07.-Bugs
   * (absolute Lösch-Fußabdrücke, doppelte Modulschichten) können nicht wiederkehren.
   */
  leer?: readonly string[];
}

/** Rahmenbedingungen der Fläche für die Feld-Belegung (ohne Ausrichtung/Optimierer). */
export type FelderInput = Pick<
  BelegungInput,
  'breiteM' | 'hoeheM' | 'module' | 'randM' | 'fugeM' | 'umrissM' | 'hindernisseM'
>;

/**
 * Eindeutiger UI-Key einer Modulposition. Feld-Module: "f{feld}:{row}-{col}"
 * (row/col sind feld-lokal, erst mit dem Feld-Index eindeutig); klassisches
 * Auto-Raster: "{row}-{col}" wie bisher.
 */
export function posKey(p: Pick<ModulPosition, 'feld' | 'row' | 'col'>): string {
  return p.feld === undefined ? `${p.row}-${p.col}` : `f${p.feld}:${p.row}-${p.col}`;
}

/**
 * Belegung aus Feldern (SPEC §9, Feld-Modus). Reihenfolge = Priorität: ein
 * Modul entfällt, wenn es ein bereits platziertes Modul eines FRÜHEREN Felds
 * überlappt — so kann sich der Nutzer Felder überlappen lassen, ohne dass je
 * zwei Module übereinander liegen.
 */
export function berechneFelderRaster(
  input: FelderInput,
  felder: readonly BelegungsFeldM[],
): BelegungRaster {
  const randM = input.randM ?? DEFAULT_RAND_M;
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const EPS = 1e-9;
  const inZone = zonenPruefer({ ...input, randM });
  const positionen: ModulPosition[] = [];

  felder.forEach((feld, fi) => {
    const { w, h } = dimsVon(input.module, feld.quer ? 'quer' : 'hoch');
    const pitchX = w + fugeM;
    const pitchY = h + fugeM;
    if (w <= 0 || h <= 0) return;
    const cols = Math.max(0, Math.floor((feld.breiteM + fugeM + EPS) / pitchX));
    const rows = Math.max(0, Math.floor((feld.hoeheM + fugeM + EPS) / pitchY));
    const leer = new Set(feld.leer ?? []);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (leer.has(`${row}-${col}`)) continue;
        const xM = feld.xM + col * pitchX;
        const yM = feld.yM + row * pitchY;
        // Randabstand zur Dachkante (das Feld selbst darf überstehen)
        if (xM < randM - EPS || yM < randM - EPS) continue;
        if (xM + w > input.breiteM - randM + EPS) continue;
        if (yM + h > input.hoeheM - randM + EPS) continue;
        if (!inZone(xM, yM, w, h)) continue;
        // Kein Modul auf ein schon platziertes (früheres Feld gewinnt)
        const rect: RechteckM = { xM, yM, breiteM: w, hoeheM: h };
        if (
          positionen.some((q) =>
            rechteckeUeberlappen(rect, { xM: q.xM, yM: q.yM, breiteM: q.wM, hoeheM: q.hM }),
          )
        ) {
          continue;
        }
        positionen.push({ row, col, xM, yM, quer: feld.quer, wM: w, hM: h, feld: fi });
      }
    }
  });

  const hoch = dimsVon(input.module, 'hoch');
  return {
    cols: positionen.reduce((m, p) => Math.max(m, p.col + 1), 0),
    rows: positionen.reduce((m, p) => Math.max(m, p.row + 1), 0),
    // Informativ (Hochkant-Maß); die echten Maße hängen je Position am Feld.
    modulBreiteM: hoch.w,
    modulHoeheM: hoch.h,
    positionen,
    randM,
    fugeM,
    ankerXM: randM,
    ankerYM: randM,
    reihenVersetzt: false,
  };
}

/**
 * Zentriertes Voll-Feld über der Nutzfläche („Automatisch füllen"): exakt so
 * groß, dass cols×rows Module hineinpassen — entspricht der früheren zentrierten
 * Standardbelegung, aber als ganz normales, verschiebbares Feld. Passt kein Modul,
 * ist breiteM/hoeheM 0 (die UI legt dann kein Feld an).
 */
export function vollFeld(input: FelderInput & { ausrichtung: 'hoch' | 'quer' }): BelegungsFeldM {
  const randM = input.randM ?? DEFAULT_RAND_M;
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const { w, h } = dimsVon(input.module, input.ausrichtung);
  const nutzB = input.breiteM - 2 * randM;
  const nutzH = input.hoeheM - 2 * randM;
  const cols = nutzB >= w ? Math.floor((nutzB + fugeM) / (w + fugeM)) : 0;
  const rows = nutzH >= h ? Math.floor((nutzH + fugeM) / (h + fugeM)) : 0;
  if (cols === 0 || rows === 0) {
    return { xM: randM, yM: randM, breiteM: 0, hoeheM: 0, quer: input.ausrichtung === 'quer' };
  }
  const belegtB = cols * w + (cols - 1) * fugeM;
  const belegtH = rows * h + (rows - 1) * fugeM;
  return {
    xM: randM + (nutzB - belegtB) / 2,
    yM: randM + (nutzH - belegtH) / 2,
    breiteM: belegtB,
    hoeheM: belegtH,
    quer: input.ausrichtung === 'quer',
  };
}
