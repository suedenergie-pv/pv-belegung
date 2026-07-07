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
}

export interface ModulPosition {
  row: number;
  col: number;
  /** linke obere Ecke in Flächenkoordinaten, Meter (Ursprung: links oben) */
  xM: number;
  yM: number;
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

export function berechneRaster(input: BelegungInput): BelegungRaster {
  const randM = input.randM ?? DEFAULT_RAND_M;
  const fugeM = input.fugeM ?? DEFAULT_FUGE_M;
  const modulBreiteM =
    (input.ausrichtung === 'hoch' ? input.module.widthMm : input.module.lengthMm) / 1000;
  const modulHoeheM =
    (input.ausrichtung === 'hoch' ? input.module.lengthMm : input.module.widthMm) / 1000;

  const nutzB = input.breiteM - 2 * randM;
  const nutzH = input.hoeheM - 2 * randM;
  const cols =
    nutzB >= modulBreiteM ? Math.floor((nutzB + fugeM) / (modulBreiteM + fugeM)) : 0;
  const rows =
    nutzH >= modulHoeheM ? Math.floor((nutzH + fugeM) / (modulHoeheM + fugeM)) : 0;

  // Belegung mittig in der Nutzfläche
  const belegtB = cols > 0 ? cols * modulBreiteM + (cols - 1) * fugeM : 0;
  const belegtH = rows > 0 ? rows * modulHoeheM + (rows - 1) * fugeM : 0;
  const x0 = randM + (nutzB - belegtB) / 2;
  const y0 = randM + (nutzH - belegtH) / 2;

  const umriss = input.umrissM && input.umrissM.length >= 3 ? input.umrissM : null;
  const hindernisse = input.hindernisseM ?? [];
  const pitchX = modulBreiteM + fugeM;
  const pitchY = modulHoeheM + fugeM;

  const gueltig = (xM: number, yM: number): boolean => {
    const rect: RechteckM = { xM, yM, breiteM: modulBreiteM, hoeheM: modulHoeheM };
    if (umriss && !rechteckImUmriss(rect, umriss, randM)) return false;
    return !hindernisse.some((h) => rechteckeUeberlappen(rect, h));
  };

  const EPS = 1e-4;
  const yPos: number[] = [];
  for (let row = 0; row < rows; row++) yPos.push(y0 + row * pitchY);

  // Positions-Optimierung (SPEC §9, überarbeitet 07.07.2026): Bei Umriss wird das
  // GANZE Raster als Block horizontal verschoben, sodass insgesamt die meisten
  // Module passen. Die Spalten bleiben reihenübergreifend AUSGERICHTET (kein
  // Reihen-Versatz — der sah bei asymmetrischen Formen wie L/Walm hässlich aus,
  // Genrih 07.07.). Rechteck bleibt zentriert; Tie-Break auf minimalen Versatz.
  let dx = 0;
  if (umriss && cols > 0 && rows > 0 && (input.optimierePosition ?? true)) {
    const zaehle = (v: number): number => {
      let n = 0;
      for (const yM of yPos)
        for (let col = 0; col < cols; col++) if (gueltig(x0 + v + col * pitchX, yM)) n++;
      return n;
    };
    let best = zaehle(0);
    let bestAbs = 0;
    const dxMin = -x0; // linkeste Spalte bei x = 0
    const dxMax = input.breiteM - belegtB - x0; // rechteste Spalte bei x = breiteM
    const schritt = pitchX / 24;
    for (let v = dxMin; v <= dxMax + EPS; v += schritt) {
      const n = zaehle(v);
      if (n > best || (n === best && Math.abs(v) < bestAbs - EPS)) {
        best = n;
        bestAbs = Math.abs(v);
        dx = v;
      }
    }
  }

  const positionen: ModulPosition[] = [];
  for (let row = 0; row < rows; row++) {
    const yM = yPos[row]!;
    for (let col = 0; col < cols; col++) {
      const xM = x0 + dx + col * pitchX;
      if (gueltig(xM, yM)) positionen.push({ row, col, xM, yM });
    }
  }

  return { cols, rows, modulBreiteM, modulHoeheM, positionen, randM, fugeM };
}
