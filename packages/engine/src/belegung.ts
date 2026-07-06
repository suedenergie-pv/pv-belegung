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
   * Reihen-Optimierung (Default true): bei Umriss jede Reihe horizontal so
   * verschieben, dass mehr Module passen (Walm/asymmetrisch). Rechteck und
   * symmetrische Reihen bleiben zentriert. false = reines zentriertes Gitter.
   */
  optimiereReihen?: boolean;
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

  const gueltig = (xM: number, yM: number): boolean => {
    const rect: RechteckM = { xM, yM, breiteM: modulBreiteM, hoeheM: modulHoeheM };
    if (umriss && !rechteckImUmriss(rect, umriss, randM)) return false;
    return !hindernisse.some((h) => rechteckeUeberlappen(rect, h));
  };

  const EPS = 1e-4;
  const positionen: ModulPosition[] = [];
  for (let row = 0; row < rows; row++) {
    const yM = y0 + row * (modulHoeheM + fugeM);
    // Standard-Gitter dieser Reihe (Original-Spaltenindex bleibt erhalten → stabile Keys)
    const gitter: { col: number; xM: number }[] = [];
    for (let col = 0; col < cols; col++) {
      const xM = x0 + col * pitchX;
      if (gueltig(xM, yM)) gitter.push({ col, xM });
    }
    // Optimierung (SPEC §9, 06.07.2026): Nur bei Umriss die Reihe horizontal
    // verschieben, und NUR wenn dadurch echt mehr Module passen (Walm/asymmetrisch).
    // Reihenraster bleibt (feste y-Positionen), kein allgemeiner Packer. Rechteck
    // und symmetrisches Trapez bleiben dadurch unverändert.
    let beste = gitter.map((g) => g.xM);
    if (umriss && cols > 0 && (input.optimiereReihen ?? true)) {
      const maxRechts = input.breiteM - randM + EPS;
      const schritt = pitchX / 24;
      // Unwucht = |linker Rand − rechter Rand| des Modul-Laufs in der Nutzbreite;
      // Tie-Break auf minimale Unwucht → symmetrische Formen bleiben zentriert.
      const unwucht = (xs: number[]): number =>
        xs.length === 0
          ? Infinity
          : Math.abs(
              xs[0]! - randM - (input.breiteM - randM - (xs[xs.length - 1]! + modulBreiteM)),
            );
      let besteUnwucht = unwucht(beste);
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
    }
    if (beste.length > gitter.length) {
      beste.forEach((xM, i) => positionen.push({ row, col: i, xM, yM }));
    } else {
      gitter.forEach((g) => positionen.push({ row, col: g.col, xM: g.xM, yM }));
    }
  }

  return { cols, rows, modulBreiteM, modulHoeheM, positionen, randM, fugeM };
}
