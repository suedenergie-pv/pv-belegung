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

export function berechneRaster(input: BelegungInput): BelegungRaster {
  const randM = input.randM ?? DEFAULT_RAND_M;
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const dimsFuer = (a: 'hoch' | 'quer') => ({
    w: (a === 'hoch' ? input.module.widthMm : input.module.lengthMm) / 1000,
    h: (a === 'hoch' ? input.module.lengthMm : input.module.widthMm) / 1000,
  });
  const basisA = input.ausrichtung;
  const { w: modulBreiteM, h: modulHoeheM } = dimsFuer(basisA);

  const nutzB = input.breiteM - 2 * randM;
  const nutzH = input.hoeheM - 2 * randM;

  const umriss = input.umrissM && input.umrissM.length >= 3 ? input.umrissM : null;
  const hindernisse = input.hindernisseM ?? [];
  const EPS = 1e-4;

  const gueltigDim = (xM: number, yM: number, w: number, hh: number): boolean => {
    const rect: RechteckM = { xM, yM, breiteM: w, hoeheM: hh };
    if (umriss && !rechteckImUmriss(rect, umriss, randM)) return false;
    return !hindernisse.some((h) => rechteckeUeberlappen(rect, h));
  };

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
    return { cols: colsMix, rows: rowsMix, modulBreiteM, modulHoeheM, positionen, randM, fugeM };
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
  const optimieren = !!umriss && cols > 0 && rows > 0 && (input.optimierePosition ?? true);

  /**
   * Positions-Optimierung (SPEC §9, Stand 07.07.2026). Zwei Kandidaten:
   * (1) AUSGERICHTET — das ganze Raster als Block horizontal verschieben, Spalten
   *     bleiben reihenübergreifend gerade. Das ist der Standard: sieht sauber aus,
   *     kein Reihen-Versatz. (2) REIHENWEISE — jede Reihe darf einzeln abweichen,
   *     falls sie dadurch strikt mehr Module fasst (schräge/komplexe Dächer).
   * Reihenweise wird NUR genommen, wenn es deutlich mehr Module bringt (Schwelle),
   * sonst gerade montieren wenn offensichtlich Platz ist (Genrih 07.07.).
   */

  // (1) Bester globaler Block-Versatz dx
  let dx = 0;
  if (optimieren) {
    const zaehle = (v: number): number => {
      let n = 0;
      for (const yM of yPos)
        for (let col = 0; col < cols; col++) if (gueltig(x0 + v + col * pitchX, yM)) n++;
      return n;
    };
    let best = zaehle(0);
    let bestAbs = 0;
    const dxMin = -x0;
    const dxMax = input.breiteM - belegtB - x0;
    for (let v = dxMin; v <= dxMax + EPS; v += schritt) {
      const n = zaehle(v);
      if (n > best || (n === best && Math.abs(v) < bestAbs - EPS)) {
        best = n;
        bestAbs = Math.abs(v);
        dx = v;
      }
    }
  }
  const basisX0 = x0 + dx;

  // Roh = Position ohne Ausrichtungs-/Maß-Annotation (im Einheitspfad überall gleich).
  type Roh = { row: number; col: number; xM: number; yM: number };
  const querBasis = basisA === 'quer';
  const annotiere = (roh: Roh[]): ModulPosition[] =>
    roh.map((p) => ({ ...p, quer: querBasis, wM: modulBreiteM, hM: modulHoeheM }));

  // ---- Manueller Versatz (Nudge, 07.07.2026) ----
  // Ist ein Versatz gesetzt, wird das Gitter phasenverschoben ab dem (schon
  // optimierten) Anker basisX0/y0 gelegt und wie immer gefiltert. Der Auto-
  // Optimierer unten entfällt dann — die Lage bestimmt der Nutzer.
  if (input.versatzXM !== undefined || input.versatzYM !== undefined) {
    const ankerX = basisX0 + (input.versatzXM ?? 0);
    const ankerY = y0 + (input.versatzYM ?? 0);
    const xs = gitterAchse(ankerX, pitchX, modulBreiteM, randM, input.breiteM);
    const ys = gitterAchse(ankerY, pitchY, modulHoeheM, randM, input.hoeheM);
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

  // Reihenweise nur, wenn es DEUTLICH mehr Module bringt (sonst gerade montieren).
  const schwelle = Math.max(2, Math.ceil(ausgerichtet.length * 0.1));
  const roh =
    reihenweise && reihenweise.length >= ausgerichtet.length + schwelle
      ? reihenweise
      : ausgerichtet;

  return { cols, rows, modulBreiteM, modulHoeheM, positionen: annotiere(roh), randM, fugeM };
}

/**
 * Sucht den Versatz (relativ zur optimierten Standardlage), bei dem die MEISTEN
 * Module passen — cm-genau über eine volle Gitterphase (± halbe Modulteilung je
 * Achse). Bei Gleichstand gewinnt der kleinste Versatz (nah an der Mitte). Löst
 * den „wegen 2 cm fehlt ein Modul"-Fall per Klick (Genrih 07.07.).
 */
export function besterVersatz(input: BelegungInput): { versatzXM: number; versatzYM: number } {
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const probe = berechneRaster({ ...input, versatzXM: 0, versatzYM: 0 });
  const pitchX = probe.modulBreiteM + fugeM;
  const pitchY = probe.modulHoeheM + fugeM;
  const spanX = pitchX / 2;
  const spanY = pitchY / 2;
  let best = { n: -1, vx: 0, vy: 0 };
  for (let vy = -spanY; vy <= spanY + 1e-9; vy += 0.01) {
    for (let vx = -spanX; vx <= spanX + 1e-9; vx += 0.01) {
      const n = berechneRaster({ ...input, versatzXM: vx, versatzYM: vy }).positionen.length;
      const naeher = Math.hypot(vx, vy) < Math.hypot(best.vx, best.vy) - 1e-9;
      if (n > best.n || (n === best.n && naeher)) best = { n, vx, vy };
    }
  }
  return { versatzXM: Math.round(best.vx * 100) / 100, versatzYM: Math.round(best.vy * 100) / 100 };
}
