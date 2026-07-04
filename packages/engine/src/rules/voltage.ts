import { fmt } from '../format';
import type { PlanCalc } from '../plan';
import { vocColdV, vmpHotV } from '../temperature';
import type { RuleId, RuleResult } from '../types';

/**
 * Spannungs- und Fensterregeln R1–R5 (SPEC §7).
 * Jede Prüfung liefert pro Verstoß einen konkreten Fehler mit Zahlen,
 * sonst genau ein Ok-Ergebnis pro Regel.
 */

function ok(rule: RuleId, message: string): RuleResult[] {
  return [{ rule, status: 'ok', message }];
}

/** R1: n × Voc_cold ≤ maxDcVoltageV */
export function checkR1(calc: PlanCalc): RuleResult[] {
  const limit = calc.inverter.maxDcVoltageV;
  const fails: RuleResult[] = [];
  for (const s of calc.allStrings) {
    if (s.vocColdSumV > limit) {
      const nMax = s.uniformType
        ? Math.floor(limit / vocColdV(s.uniformType, calc.params))
        : null;
      fails.push({
        rule: 'R1',
        status: 'fail',
        stringId: s.id,
        message:
          `String ${s.id}: ${s.moduleCount} Module gehen nicht: Winter-Voc ${fmt(s.vocColdSumV)} V ` +
          `> WR-Maximum ${fmt(limit)} V.` +
          (nMax !== null ? ` Maximal ${nMax} Module pro String.` : ''),
      });
    }
  }
  return fails.length > 0 ? fails : ok('R1', `Winter-Voc aller Strings ≤ WR-Maximum ${fmt(limit)} V.`);
}

/** R2: n × Voc_cold ≤ module.maxSystemVoltageV */
export function checkR2(calc: PlanCalc): RuleResult[] {
  const fails: RuleResult[] = [];
  for (const s of calc.allStrings) {
    if (s.vocColdSumV > s.minMaxSystemVoltageV) {
      fails.push({
        rule: 'R2',
        status: 'fail',
        stringId: s.id,
        message:
          `String ${s.id}: ${s.moduleCount} Module gehen nicht: Winter-Voc ${fmt(s.vocColdSumV)} V ` +
          `> zulässige Modul-Systemspannung ${fmt(s.minMaxSystemVoltageV)} V.`,
      });
    }
  }
  return fails.length > 0 ? fails : ok('R2', 'Winter-Voc aller Strings ≤ zulässige Modul-Systemspannung.');
}

/** R3: n × Vmp_hot ≥ mpptVmin */
export function checkR3(calc: PlanCalc): RuleResult[] {
  const vmin = calc.inverter.mpptVoltageRange[0];
  const fails: RuleResult[] = [];
  for (const s of calc.allStrings) {
    if (s.vmpHotSumV < vmin) {
      const nMin = s.uniformType
        ? Math.ceil(vmin / vmpHotV(s.uniformType, calc.params))
        : null;
      fails.push({
        rule: 'R3',
        status: 'fail',
        stringId: s.id,
        message:
          `String ${s.id}: ${s.moduleCount} Module sind zu wenig: Vmp bei +${fmt(calc.params.tCellMaxC)} °C ` +
          `${fmt(s.vmpHotSumV)} V < MPPT-Minimum ${fmt(vmin)} V.` +
          (nMin !== null ? ` Mindestens ${nMin} Module pro String.` : ''),
      });
    }
  }
  return fails.length > 0 ? fails : ok('R3', `Sommer-Vmp aller Strings ≥ MPPT-Minimum ${fmt(vmin)} V.`);
}

/** R4: n × Vmp_STC ≤ mpptVmax */
export function checkR4(calc: PlanCalc): RuleResult[] {
  const vmax = calc.inverter.mpptVoltageRange[1];
  const fails: RuleResult[] = [];
  for (const s of calc.allStrings) {
    if (s.vmpStcSumV > vmax) {
      fails.push({
        rule: 'R4',
        status: 'fail',
        stringId: s.id,
        message:
          `String ${s.id}: ${s.moduleCount} Module gehen nicht: Vmp bei STC ${fmt(s.vmpStcSumV)} V ` +
          `> MPPT-Maximum ${fmt(vmax)} V.`,
      });
    }
  }
  return fails.length > 0 ? fails : ok('R4', `STC-Vmp aller Strings ≤ MPPT-Maximum ${fmt(vmax)} V.`);
}

/** R5: n × Vmp_hot ≥ startupVoltageV */
export function checkR5(calc: PlanCalc): RuleResult[] {
  const startup = calc.inverter.startupVoltageV;
  const fails: RuleResult[] = [];
  for (const s of calc.allStrings) {
    if (s.vmpHotSumV < startup) {
      fails.push({
        rule: 'R5',
        status: 'fail',
        stringId: s.id,
        message:
          `String ${s.id}: ${s.moduleCount} Module sind zu wenig: Vmp bei +${fmt(calc.params.tCellMaxC)} °C ` +
          `${fmt(s.vmpHotSumV)} V < Anlaufspannung ${fmt(startup)} V.`,
      });
    }
  }
  return fails.length > 0 ? fails : ok('R5', `Sommer-Vmp aller Strings ≥ Anlaufspannung ${fmt(startup)} V.`);
}
