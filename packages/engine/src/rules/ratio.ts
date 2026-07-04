import { DC_AC_WARN_RATIO } from '../constants/auslegung';
import { fmt } from '../format';
import type { PlanCalc } from '../plan';
import type { RuleResult } from '../types';

/**
 * R11: DC:AC-Ratio (SPEC §7) — Warnung ab 1,2, harter Fehler oberhalb des
 * Katalogwerts (maxDcAcRatio, Default 1,35 lt. SPEC §6).
 */
export function checkR11(calc: PlanCalc): RuleResult[] {
  const ac = calc.inverter.acPowerKw;
  const max = calc.inverter.maxDcAcRatio;
  const ratio = calc.kwp / ac;
  if (ratio > max) {
    return [
      {
        rule: 'R11',
        status: 'fail',
        message:
          `DC:AC-Verhältnis ${fmt(ratio, 2)} (${fmt(calc.kwp, 2)} kWp an ${fmt(ac)} kW AC) ` +
          `> Herstellergrenze ${fmt(max, 2)}.`,
      },
    ];
  }
  if (ratio >= DC_AC_WARN_RATIO) {
    return [
      {
        rule: 'R11',
        status: 'warn',
        message:
          `DC:AC-Verhältnis ${fmt(ratio, 2)} (${fmt(calc.kwp, 2)} kWp an ${fmt(ac)} kW AC) ` +
          `≥ ${fmt(DC_AC_WARN_RATIO, 1)} — Überbelegung prüfen (harte Grenze ${fmt(max, 2)}).`,
      },
    ];
  }
  return [
    {
      rule: 'R11',
      status: 'ok',
      message: `DC:AC-Verhältnis ${fmt(ratio, 2)} unter Warnschwelle ${fmt(DC_AC_WARN_RATIO, 1)}.`,
    },
  ];
}
