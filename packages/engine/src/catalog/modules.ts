import type { ModuleType } from '../types';

/**
 * Modulkatalog lt. SPEC §5.1 — alle Werte verifiziert gegen die Datenblatt-PDFs
 * in docs/datenblaetter/ (einzige zulässige Quelle für Elektrik, CLAUDE.md).
 * Änderungen NUR mit neuem Datenblatt + SPEC-Update.
 */

/**
 * Jolywood Niwa Black Series, n-Type bifazial Dual-Glass Transparent Black.
 * Quelle: Jolywood-JW-HD96N-R2-435-460W-Datasheet.pdf, Version 2025.01, Spalte 460 W.
 */
export const JOLYWOOD_JW_HD96N_R2_460: ModuleType = {
  id: 'jw-hd96n-r2-460',
  name: 'Jolywood Niwa Black JW-HD96N-R2-460',
  lengthMm: 1762,
  widthMm: 1134,
  heightMm: 30,
  weightKg: 24.6,
  cells: 96, // 6×16
  pmaxW: 460,
  vocV: 35.31,
  iscA: 16.0,
  vmpV: 30.34,
  impA: 15.16,
  tempCoeffVocPctPerK: -0.25,
  tempCoeffPmaxPctPerK: -0.28,
  maxSystemVoltageV: 1500,
  maxSeriesFuseA: 35,
  renderSymbol: 'jolywood_niwa_black',
};

/**
 * Aiko Neostar 3S+54, Doppelglas 2,0+2,0 mm, N-Type ABC.
 * Quelle: Neostar-3S_Plus_54_AIKO-A-MCE54Db-460W-485W.pdf, DSDr_EN_2405_V1.5, Spalte A485.
 */
export const AIKO_A485_MCE54DB: ModuleType = {
  id: 'aiko-a485-mce54db',
  name: 'Aiko Neostar 3S+54 A485-MCE54Db',
  lengthMm: 1762,
  widthMm: 1134,
  heightMm: 30,
  weightKg: 24.5,
  cells: 108, // 6×18
  pmaxW: 485,
  vocV: 40.9,
  iscA: 14.88,
  vmpV: 34.3,
  impA: 14.15,
  tempCoeffVocPctPerK: -0.22,
  tempCoeffPmaxPctPerK: -0.26,
  maxSystemVoltageV: 1500,
  maxSeriesFuseA: 25,
  renderSymbol: 'aiko_abc',
};

/**
 * Aiko Neostar 2N, Einzelglas 3,2 mm, N-Type ABC.
 * Quelle: Neostar-2N_188-AIKO-A-MAH54Mw-450-485W_1757x1134x30mm_DS_DE_2407_V1.3.pdf, Spalte A480.
 */
export const AIKO_A480_MAH54MW: ModuleType = {
  id: 'aiko-a480-mah54mw',
  name: 'Aiko Neostar 2N A480-MAH54Mw',
  lengthMm: 1757,
  widthMm: 1134,
  heightMm: 30,
  weightKg: 21.5,
  cells: 108, // 6×18
  pmaxW: 480,
  vocV: 41.3,
  iscA: 14.38,
  vmpV: 34.86,
  impA: 13.78,
  tempCoeffVocPctPerK: -0.22,
  tempCoeffPmaxPctPerK: -0.26,
  maxSystemVoltageV: 1500,
  maxSeriesFuseA: 25,
  renderSymbol: 'aiko_abc',
};

export const MODULES: ModuleType[] = [
  JOLYWOOD_JW_HD96N_R2_460,
  AIKO_A485_MCE54DB,
  AIKO_A480_MAH54MW,
];
