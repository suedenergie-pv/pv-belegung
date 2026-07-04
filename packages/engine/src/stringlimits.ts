import { resolveParams, vocColdV, vmpHotV } from './temperature';
import type { DesignParams, InverterType, ModuleType } from './types';

/**
 * Max. Module pro String aus R1 (WR-DC-Grenze) und R2 (Systemspannung Modul).
 * Konservativ abgerundet. Referenz §5.1: 1000-V-WR → Jolywood 25, beide Aiko 22.
 */
export function maxModulesPerString(
  module: ModuleType,
  inverter: InverterType,
  params?: Partial<DesignParams>,
): number {
  const voc = vocColdV(module, resolveParams(params));
  return Math.floor(Math.min(inverter.maxDcVoltageV, module.maxSystemVoltageV) / voc);
}

/**
 * Min. Module pro String aus R3 (MPPT-Untergrenze) und R5 (Anlaufspannung),
 * jeweils bei Vmp_hot. Konservativ aufgerundet.
 */
export function minModulesPerString(
  module: ModuleType,
  inverter: InverterType,
  params?: Partial<DesignParams>,
): number {
  const vmp = vmpHotV(module, resolveParams(params));
  return Math.ceil(Math.max(inverter.mpptVoltageRange[0], inverter.startupVoltageV) / vmp);
}
