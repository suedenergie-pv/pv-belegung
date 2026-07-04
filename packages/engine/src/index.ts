/**
 * @pv-belegung/engine — String-Engine (SPEC §7) + Fixkatalog (SPEC §5/§6).
 * Pures TS-Paket ohne UI-Abhängigkeiten.
 *
 * ⛔ KALIBRIERUNGS-GATE (SPEC §14): Engine ist gegen PV*SOL noch NICHT
 * kalibriert — kein UI-Bau, Ergebnisse nicht für echte Planung verwenden.
 */

export * from './types';
export { DEFAULT_DESIGN_PARAMS, STC_TEMP_C, DC_AC_WARN_RATIO } from './constants/auslegung';
export {
  AIKO_A460_MAH54MW,
  AIKO_A460_MCE54DB,
  JOLYWOOD_JW_HD96N_R2_460,
  MODULES,
} from './catalog/modules';
export { INVERTERS } from './catalog/inverters';
export { resolveParams, vocColdV, vmpHotV } from './temperature';
export { maxModulesPerString, minModulesPerString } from './stringlimits';
export { buildPlanCalc, orientationKey } from './plan';
export type { MpptCalc, PlanCalc, StringCalc } from './plan';
export { checkStringPlan } from './engine';
