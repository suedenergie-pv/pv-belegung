import type { DesignParams } from '../types';

/**
 * Auslegungsparameter lt. SPEC §7 / kalibrierung.md (dort fix für alle Fälle).
 * Admin-konfigurierbar; Defaults konservativ fürs Allgäu.
 * T_min-Bestätigung für Höhenlagen steht aus (SPEC §16 #7).
 */
export const DEFAULT_DESIGN_PARAMS: DesignParams = {
  tMinC: -15,
  tCellMaxC: 70,
  iscSafetyFactor: 1.25,
};

/** STC-Referenztemperatur, °C (SPEC §7) */
export const STC_TEMP_C = 25;

/** R11: Warnschwelle DC:AC („Warnung ab 1,2", SPEC §7) — harte Grenze ist inverter.maxDcAcRatio. */
export const DC_AC_WARN_RATIO = 1.2;
