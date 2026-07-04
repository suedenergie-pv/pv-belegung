import { fmt } from '../format';
import type { PlanCalc } from '../plan';
import type { RuleId, RuleResult } from '../types';

/**
 * Stromregeln R6–R7 (SPEC §7). Der Haupt-Filter der WR-Auswahl bei den hohen
 * Modulströmen (Jolywood Isc 16 A → 20 A Anforderung, SPEC §5.1 ⚡).
 */

function ok(rule: RuleId, message: string): RuleResult[] {
  return [{ rule, status: 'ok', message }];
}

/** R6: Σ Imp der parallelen Strings ≤ maxInputCurrentPerMpptA[mppt] (Limit je MPPT, SPEC §6) */
export function checkR6(calc: PlanCalc): RuleResult[] {
  const fails: RuleResult[] = [];
  for (const mppt of calc.mppts) {
    const limit = calc.inverter.maxInputCurrentPerMpptA[mppt.mpptIndex - 1]!;
    const sumImp = mppt.strings.reduce((sum, s) => sum + s.impA, 0);
    if (sumImp > limit) {
      fails.push({
        rule: 'R6',
        status: 'fail',
        mpptIndex: mppt.mpptIndex,
        message:
          `MPPT ${mppt.mpptIndex}: Betriebsstrom ${fmt(sumImp)} A (${mppt.strings.length} parallele ` +
          `Strings) > max. Eingangsstrom ${fmt(limit)} A dieses MPPTs.`,
      });
    }
  }
  return fails.length > 0
    ? fails
    : ok('R6', 'Betriebsstrom aller MPPTs innerhalb der jeweiligen Eingangsstrom-Grenze.');
}

/** R7: Σ Isc × 1,25 ≤ maxShortCircuitCurrentPerMpptA[mppt] (Limit je MPPT, SPEC §6) */
export function checkR7(calc: PlanCalc): RuleResult[] {
  const factor = calc.params.iscSafetyFactor;
  const fails: RuleResult[] = [];
  for (const mppt of calc.mppts) {
    const limit = calc.inverter.maxShortCircuitCurrentPerMpptA[mppt.mpptIndex - 1]!;
    const sumIsc = mppt.strings.reduce((sum, s) => sum + s.iscA, 0);
    const demand = sumIsc * factor;
    if (demand > limit) {
      fails.push({
        rule: 'R7',
        status: 'fail',
        mpptIndex: mppt.mpptIndex,
        message:
          `MPPT ${mppt.mpptIndex}: Kurzschlussstrom ${fmt(sumIsc, 2)} A × ${fmt(factor, 2)} = ` +
          `${fmt(demand, 2)} A > zulässige ${fmt(limit)} A dieses MPPTs.`,
      });
    }
  }
  return fails.length > 0
    ? fails
    : ok('R7', `Kurzschlussstrom (×${fmt(factor, 2)}) aller MPPTs innerhalb der jeweiligen Grenze.`);
}
