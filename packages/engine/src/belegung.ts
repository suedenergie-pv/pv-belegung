import type { ModuleType } from './types';

/**
 * Belegungslogik (SPEC §9): Raster pro Dachfläche aus Modulmaß (mm, Katalog),
 * Ausrichtung hoch/quer, Klemmfuge und Randabstand. Modulgrößen kommen
 * AUSSCHLIESSLICH aus mm-Maßen × Maßstab (SPEC §3.5) — die UI rechnet nichts.
 * v1: Rechteckfläche ohne Ausschlüsse (Gauben/Hindernisse folgen).
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

  const positionen: ModulPosition[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positionen.push({
        row,
        col,
        xM: x0 + col * (modulBreiteM + fugeM),
        yM: y0 + row * (modulHoeheM + fugeM),
      });
    }
  }

  return { cols, rows, modulBreiteM, modulHoeheM, positionen, randM, fugeM };
}
