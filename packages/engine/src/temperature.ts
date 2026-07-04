import { DEFAULT_DESIGN_PARAMS, STC_TEMP_C } from './constants/auslegung';
import type { DesignParams, ModuleType } from './types';

export function resolveParams(partial?: Partial<DesignParams>): DesignParams {
  return { ...DEFAULT_DESIGN_PARAMS, ...partial };
}

/**
 * Voc_cold = Voc_STC × (1 + tkVoc/100 × (T_min − 25))   (SPEC §7)
 * Referenzen §5.1: Jolywood ≈ 38,84 V · Aiko MCE54Db ≈ 43,96 V · Aiko MAH54Mw ≈ 44,67 V
 */
export function vocColdV(
  module: ModuleType,
  params: DesignParams = DEFAULT_DESIGN_PARAMS,
): number {
  return module.vocV * (1 + (module.tempCoeffVocPctPerK / 100) * (params.tMinC - STC_TEMP_C));
}

/**
 * Vmp_hot = Vmp_STC × (1 + tkPmax/100 × (T_cell_max − 25))   (SPEC §7)
 * Näherung über TK Pmax; konservativ.
 * Referenzen §5.1: Jolywood ≈ 26,52 V · Aiko MCE54Db ≈ 29,85 V · Aiko MAH54Mw ≈ 30,57 V
 */
export function vmpHotV(
  module: ModuleType,
  params: DesignParams = DEFAULT_DESIGN_PARAMS,
): number {
  return module.vmpV * (1 + (module.tempCoeffPmaxPctPerK / 100) * (params.tCellMaxC - STC_TEMP_C));
}
