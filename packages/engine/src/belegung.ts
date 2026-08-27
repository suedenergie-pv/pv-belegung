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
  /**
   * Kippseite bei Ost-West-Aufständerung (welcher Himmelsrichtung das Modul
   * zugeneigt ist) — fürs Rendering (Zelt-Optik) und den Export. Fehlt bei
   * Süd-Aufständerung und flacher Belegung.
   */
  seite?: 'ost' | 'west';
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

/**
 * Flachdach-Aufständerung (16.07.2026, System PROFINESS Flat — Maße aus der
 * Montageanleitung 05/2025, docs/datenblaetter/PROFINESS-Flat-Montageanleitung-
 * Flachdach_05_2025.pdf; für Modulrahmen 1050–1170 mm, nur QUER liegende Module):
 *
 * - 'sued': alle Module nach Süden gekippt (10° oder 15°). Die Kipprichtung folgt
 *   `richtungSued`. Reihen-Pitch laut Querschnitten:
 *   1,80 m @10° bzw. ~1,90 m @15° (Standard-Südsystem).
 * - 'ostwest': Modul-PAARE, Zeltfirst in Nord-Süd-Richtung; die Achse folgt
 *   ebenfalls der gewählten Kompasslage.
 *   Paar-Pitch laut Querschnitten exakt 2,48 m (2er-Gestell; 4er = 4,96 m —
 *   Paare stoßen bündig aneinander), Winkel ca. 10°.
 *
 * Der Modul-FUSSABDRUCK in Kipprichtung ist die Projektion widthMm·cos(winkel) —
 * reine Trigonometrie, kein Solver. Der Rest des Pitchs ist Gasse/Gestell.
 */
export interface FlachdachMontage {
  aufstaenderung: 'sued' | 'ostwest';
  /** Modulmontagewinkel, Grad (PROFINESS: Süd 10/15, Ost-West 10) */
  winkelDeg: number;
  /** Gestell-Pitch in Kipprichtung, Meter (Süd: Reihen-Pitch; O/W: Paar-Pitch) */
  pitchM: number;
  /** Spalt am Zeltfirst zwischen den beiden Modulen eines O/W-Paars, Meter (Optik) */
  firstspaltM?: number;
  /** Wo Süden in der Draufsicht liegt. Default für Altprojekte: unten. */
  richtungSued?: 'unten' | 'links' | 'oben' | 'rechts';
}

/** Rahmenbedingungen der Fläche für die Feld-Belegung (ohne Ausrichtung/Optimierer). */
export type FelderInput = Pick<
  BelegungInput,
  'breiteM' | 'hoeheM' | 'module' | 'randM' | 'fugeM' | 'umrissM' | 'hindernisseM'
> & {
  /** Gesetzt = Flachdach-Aufständerung; fehlt = flache Dachbelegung (Schrägdach/Fassade). */
  montage?: FlachdachMontage;
};

/**
 * Eindeutiger UI-Key einer Modulposition. Feld-Module: "f{feld}:{row}-{col}"
 * (row/col sind feld-lokal, erst mit dem Feld-Index eindeutig); klassisches
 * Auto-Raster: "{row}-{col}" wie bisher.
 */
export function posKey(p: Pick<ModulPosition, 'feld' | 'row' | 'col'>): string {
  return p.feld === undefined ? `${p.row}-${p.col}` : `f${p.feld}:${p.row}-${p.col}`;
}

/** Zelle eines Belegungsfelds, Koordinaten RELATIV zur linken oberen Feldecke. */
interface FeldZelle {
  row: number;
  col: number;
  xM: number;
  yM: number;
  wM: number;
  hM: number;
  quer: boolean;
  seite?: 'ost' | 'west';
}

const GRAD = Math.PI / 180;

/**
 * Zellen eines Felds erzeugen — der EINZIGE Ort, an dem sich Schrägdach-,
 * Süd- und Ost-West-Belegung unterscheiden. Alles danach (Zone, Überlappung,
 * leer, UI-Werkzeuge) arbeitet identisch auf den Zellen.
 */
function feldZellen(
  feld: BelegungsFeldM,
  module: ModuleType,
  fugeM: number,
  montage: FlachdachMontage | undefined,
): FeldZelle[] {
  const EPS = 1e-9;
  const zellen: FeldZelle[] = [];

  if (!montage) {
    // Flache Belegung (Schrägdach/Fassade): Module dicht an dicht mit Klemmfuge.
    const { w, h } = dimsVon(module, feld.quer ? 'quer' : 'hoch');
    if (w <= 0 || h <= 0) return zellen;
    const cols = Math.max(0, Math.floor((feld.breiteM + fugeM + EPS) / (w + fugeM)));
    const rows = Math.max(0, Math.floor((feld.hoeheM + fugeM + EPS) / (h + fugeM)));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        zellen.push({ row, col, xM: col * (w + fugeM), yM: row * (h + fugeM), wM: w, hM: h, quer: feld.quer });
      }
    }
    return zellen;
  }

  // Flachdach: immer QUER liegende Module (PROFINESS Flat). Fußabdruck in
  // Kipprichtung = Projektion widthMm·cos(winkel); der Pitch kommt vom Gestell.
  const { w: laengsM, h: querM } = dimsVon(module, 'quer'); // 1,762 × 1,134
  const tiefe = querM * Math.cos(montage.winkelDeg * GRAD);
  const pitch = Math.max(montage.pitchM, tiefe + 0.01);
  const richtungSued = montage.richtungSued ?? 'unten';
  const kipptVertikal = richtungSued === 'unten' || richtungSued === 'oben';

  if (montage.aufstaenderung === 'sued') {
    // Reihen quer zur gewählten Südrichtung: erste Reihe braucht nur den
    // Fußabdruck, jede weitere den vollen Gestell-Pitch.
    if (kipptVertikal) {
      const cols = Math.max(0, Math.floor((feld.breiteM + fugeM + EPS) / (laengsM + fugeM)));
      const rows = feld.hoeheM + EPS >= tiefe
        ? 1 + Math.floor((feld.hoeheM - tiefe + EPS) / pitch)
        : 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          zellen.push({ row, col, xM: col * (laengsM + fugeM), yM: row * pitch, wM: laengsM, hM: tiefe, quer: true });
        }
      }
    } else {
      const cols = feld.breiteM + EPS >= tiefe
        ? 1 + Math.floor((feld.breiteM - tiefe + EPS) / pitch)
        : 0;
      const rows = Math.max(0, Math.floor((feld.hoeheM + fugeM + EPS) / (laengsM + fugeM)));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          zellen.push({ row, col, xM: col * pitch, yM: row * (laengsM + fugeM), wM: tiefe, hM: laengsM, quer: false });
        }
      }
    }
    return zellen;
  }

  // Ost-West: Paare kippen in x-Richtung (Zeltfirst vertikal). Ein Paar = Ost- +
  // West-Modul mit Firstspalt; Paar-Pitch 2,48 m (Paare stoßen bündig aneinander).
  const spalt = montage.firstspaltM ?? 0.05;
  const paarTiefe = 2 * tiefe + spalt;
  const paarPitch = Math.max(pitch, paarTiefe);
  if (kipptVertikal) {
    const paare = feld.breiteM + EPS >= paarTiefe
      ? 1 + Math.floor((feld.breiteM - paarTiefe + EPS) / paarPitch)
      : 0;
    const rows = Math.max(0, Math.floor((feld.hoeheM + fugeM + EPS) / (laengsM + fugeM)));
    const links: 'ost' | 'west' = richtungSued === 'unten' ? 'west' : 'ost';
    const rechts: 'ost' | 'west' = links === 'ost' ? 'west' : 'ost';
    for (let row = 0; row < rows; row++) {
      for (let paar = 0; paar < paare; paar++) {
        const x0 = paar * paarPitch;
        const yM = row * (laengsM + fugeM);
        zellen.push({ row, col: paar * 2, xM: x0, yM, wM: tiefe, hM: laengsM, quer: false, seite: links });
        zellen.push({ row, col: paar * 2 + 1, xM: x0 + tiefe + spalt, yM, wM: tiefe, hM: laengsM, quer: false, seite: rechts });
      }
    }
  } else {
    const paare = feld.hoeheM + EPS >= paarTiefe
      ? 1 + Math.floor((feld.hoeheM - paarTiefe + EPS) / paarPitch)
      : 0;
    const cols = Math.max(0, Math.floor((feld.breiteM + fugeM + EPS) / (laengsM + fugeM)));
    const oben: 'ost' | 'west' = richtungSued === 'rechts' ? 'ost' : 'west';
    const unten: 'ost' | 'west' = oben === 'ost' ? 'west' : 'ost';
    for (let paar = 0; paar < paare; paar++) {
      const y0 = paar * paarPitch;
      for (let col = 0; col < cols; col++) {
        const xM = col * (laengsM + fugeM);
        zellen.push({ row: paar * 2, col, xM, yM: y0, wM: laengsM, hM: tiefe, quer: true, seite: oben });
        zellen.push({ row: paar * 2 + 1, col, xM, yM: y0 + tiefe + spalt, wM: laengsM, hM: tiefe, quer: true, seite: unten });
      }
    }
  }
  return zellen;
}

/**
 * Raster-Schrittmaße eines Felds (16.07.2026): um wie viel die LINKE/OBERE
 * Feldkante beim Größenziehen einrasten muss, damit die bestehenden Zellen exakt
 * stehen bleiben — und wie viele Zell-SPALTEN ein x-Schritt verschiebt (Ost-West:
 * 2, ein Schritt = ein Modul-Paar). Ohne das würde das Ziehen am Flachdach das
 * Gestell-Raster verschieben und die leer-Zellen falsch umnummerieren.
 */
export function feldSchrittmasse(
  input: Pick<FelderInput, 'module' | 'fugeM' | 'montage'>,
  quer: boolean,
): { pitchXM: number; pitchYM: number; colsJeSchrittX: number; rowsJeSchrittY: number } {
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  if (!input.montage) {
    const { w, h } = dimsVon(input.module, quer ? 'quer' : 'hoch');
    return { pitchXM: w + fugeM, pitchYM: h + fugeM, colsJeSchrittX: 1, rowsJeSchrittY: 1 };
  }
  const { w: laengsM, h: querM } = dimsVon(input.module, 'quer');
  const tiefe = querM * Math.cos(input.montage.winkelDeg * GRAD);
  const pitch = Math.max(input.montage.pitchM, tiefe + 0.01);
  const kipptVertikal = (input.montage.richtungSued ?? 'unten') === 'unten' ||
    (input.montage.richtungSued ?? 'unten') === 'oben';
  if (input.montage.aufstaenderung === 'sued') {
    return kipptVertikal
      ? { pitchXM: laengsM + fugeM, pitchYM: pitch, colsJeSchrittX: 1, rowsJeSchrittY: 1 }
      : { pitchXM: pitch, pitchYM: laengsM + fugeM, colsJeSchrittX: 1, rowsJeSchrittY: 1 };
  }
  const spalt = input.montage.firstspaltM ?? 0.05;
  const paarTiefe = 2 * tiefe + spalt;
  return kipptVertikal
    ? { pitchXM: Math.max(pitch, paarTiefe), pitchYM: laengsM + fugeM, colsJeSchrittX: 2, rowsJeSchrittY: 1 }
    : { pitchXM: laengsM + fugeM, pitchYM: Math.max(pitch, paarTiefe), colsJeSchrittX: 1, rowsJeSchrittY: 2 };
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
  /*
   * Räumlicher Index statt einer vollständigen Suche über alle bereits gesetzten
   * Module. Die Buckets sind nur eine Kandidaten-Vorauswahl; die endgültige
   * Entscheidung trifft weiterhin exakt `rechteckeUeberlappen`. Dadurch bleiben
   * Priorität, Reihenfolge und Ergebnis des bisherigen Algorithmus unverändert.
   */
  const ZELLGROESSE_M = 2;
  const buckets = new Map<string, number[]>();
  const bucketKeys = (r: RechteckM): string[] => {
    const x0 = Math.floor(r.xM / ZELLGROESSE_M);
    const y0 = Math.floor(r.yM / ZELLGROESSE_M);
    const x1 = Math.floor((r.xM + r.breiteM) / ZELLGROESSE_M);
    const y1 = Math.floor((r.yM + r.hoeheM) / ZELLGROESSE_M);
    const keys: string[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) keys.push(`${x}:${y}`);
    }
    return keys;
  };
  const kollidiert = (rect: RechteckM): boolean => {
    const kandidaten = new Set<number>();
    for (const key of bucketKeys(rect)) {
      for (const index of buckets.get(key) ?? []) kandidaten.add(index);
    }
    for (const index of [...kandidaten].sort((a, b) => a - b)) {
      const q = positionen[index]!;
      if (rechteckeUeberlappen(rect, { xM: q.xM, yM: q.yM, breiteM: q.wM, hoeheM: q.hM })) {
        return true;
      }
    }
    return false;
  };
  const indiziere = (rect: RechteckM, index: number) => {
    for (const key of bucketKeys(rect)) {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }
  };

  felder.forEach((feld, fi) => {
    const leer = new Set(feld.leer ?? []);
    for (const z of feldZellen(feld, input.module, fugeM, input.montage)) {
      if (leer.has(`${z.row}-${z.col}`)) continue;
      const xM = feld.xM + z.xM;
      const yM = feld.yM + z.yM;
      // Randabstand zur Dachkante (das Feld selbst darf überstehen)
      if (xM < randM - EPS || yM < randM - EPS) continue;
      if (xM + z.wM > input.breiteM - randM + EPS) continue;
      if (yM + z.hM > input.hoeheM - randM + EPS) continue;
      if (!inZone(xM, yM, z.wM, z.hM)) continue;
      // Kein Modul auf ein schon platziertes (früheres Feld gewinnt)
      const rect: RechteckM = { xM, yM, breiteM: z.wM, hoeheM: z.hM };
      if (kollidiert(rect)) continue;
      const pos: ModulPosition = {
        row: z.row,
        col: z.col,
        xM,
        yM,
        quer: z.quer,
        wM: z.wM,
        hM: z.hM,
        feld: fi,
      };
      if (z.seite) pos.seite = z.seite;
      indiziere(rect, positionen.length);
      positionen.push(pos);
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
 * Die als `leer` markierten Zellen eines Felds — also die Plätze, an denen ein Modul
 * LIEGEN WÜRDE, wenn der Nutzer es nicht abgeschaltet hätte (16.07.2026). Nur zum
 * ANZEIGEN im Bearbeiten-Modus: ohne sichtbare Lücke könnte man ein versehentlich
 * abgeschaltetes Modul nicht einzeln zurückholen. Zählt nirgends mit (kWp/Export
 * laufen über berechneFelderRaster).
 */
export function leerePositionen(
  input: FelderInput,
  felder: readonly BelegungsFeldM[],
): ModulPosition[] {
  const ohneLuecken = berechneFelderRaster(
    input,
    felder.map(({ leer: _leer, ...rest }) => rest),
  );
  const belegt = berechneFelderRaster(input, felder);
  const belegteKeys = new Set(belegt.positionen.map(posKey));
  return ohneLuecken.positionen.filter((p) => {
    if (belegteKeys.has(posKey(p))) return false; // liegt ja ein Modul
    // Bei überlappenden Feldern kann die Lücke von einem anderen Feld gefüllt sein —
    // dann ist sie nicht frei und darf nicht als Geist erscheinen.
    const rect: RechteckM = { xM: p.xM, yM: p.yM, breiteM: p.wM, hoeheM: p.hM };
    return !belegt.positionen.some((q) =>
      rechteckeUeberlappen(rect, { xM: q.xM, yM: q.yM, breiteM: q.wM, hoeheM: q.hM }),
    );
  });
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
  const nutzB = input.breiteM - 2 * randM;
  const nutzH = input.hoeheM - 2 * randM;
  // Flachdach ist immer quer (PROFINESS Flat: ausschließlich querliegende Module)
  const quer = input.montage ? true : input.ausrichtung === 'quer';
  // Probe-Feld über die ganze Nutzfläche → die Zellen selbst sagen, wie groß das
  // exakt gefüllte Feld ist (eine Mathe-Quelle für alle Montagearten).
  const probe: BelegungsFeldM = {
    xM: 0,
    yM: 0,
    breiteM: Math.max(0, nutzB),
    hoeheM: Math.max(0, nutzH),
    quer,
  };
  const zellen = feldZellen(probe, input.module, fugeM, input.montage);
  if (zellen.length === 0) return { xM: randM, yM: randM, breiteM: 0, hoeheM: 0, quer };
  const belegtB = Math.max(...zellen.map((z) => z.xM + z.wM));
  const belegtH = Math.max(...zellen.map((z) => z.yM + z.hM));
  return {
    xM: randM + (nutzB - belegtB) / 2,
    yM: randM + (nutzH - belegtH) / 2,
    breiteM: belegtB,
    hoeheM: belegtH,
    quer,
  };
}
