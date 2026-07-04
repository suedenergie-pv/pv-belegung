import type { PlanCalc } from '../plan';
import type { RuleId, RuleResult } from '../types';

/**
 * Topologieregeln R8–R10 (SPEC §7): Stringlängen-Gleichheit, eine Ausrichtung
 * pro MPPT, kein Modul-Mix im String.
 */

function ok(rule: RuleId, message: string): RuleResult[] {
  return [{ rule, status: 'ok', message }];
}

/** R8: parallele Strings am selben MPPT haben identische Modulanzahl */
export function checkR8(calc: PlanCalc): RuleResult[] {
  const fails: RuleResult[] = [];
  for (const mppt of calc.mppts) {
    const counts = [...new Set(mppt.strings.map((s) => s.moduleCount))];
    if (counts.length > 1) {
      fails.push({
        rule: 'R8',
        status: 'fail',
        mpptIndex: mppt.mpptIndex,
        message:
          `MPPT ${mppt.mpptIndex}: parallele Strings ungleich lang (${counts.join(' vs. ')} Module) — ` +
          `am selben MPPT müssen alle Strings gleich viele Module haben.`,
      });
    }
  }
  return fails.length > 0 ? fails : ok('R8', 'Alle parallelen Strings pro MPPT gleich lang.');
}

/**
 * R9: nur eine Ausrichtung (Azimut/Neigung) pro MPPT.
 * Ausnahme: WR mit Schatten-Management (Flag am Katalogeintrag).
 */
export function checkR9(calc: PlanCalc): RuleResult[] {
  if (calc.inverter.hasShadeManagement) {
    return ok('R9', 'WR hat Schatten-Management — Ausrichtungs-Mix pro MPPT zulässig (SPEC §7 R9-Ausnahme).');
  }
  const fails: RuleResult[] = [];
  for (const mppt of calc.mppts) {
    const orientations = [...new Set(mppt.strings.flatMap((s) => s.orientationKeys))];
    if (orientations.length > 1) {
      fails.push({
        rule: 'R9',
        status: 'fail',
        mpptIndex: mppt.mpptIndex,
        message:
          `MPPT ${mppt.mpptIndex}: ${orientations.length} Ausrichtungen (${orientations.join(', ')}) ` +
          `am selben MPPT — WR ohne Schatten-Management erlaubt nur eine Ausrichtung pro MPPT.`,
      });
    }
  }
  return fails.length > 0 ? fails : ok('R9', 'Je MPPT nur eine Ausrichtung belegt.');
}

/** R10: ein String = ein ModuleType */
export function checkR10(calc: PlanCalc): RuleResult[] {
  const fails: RuleResult[] = [];
  for (const s of calc.allStrings) {
    if (s.moduleTypeIds.length > 1) {
      fails.push({
        rule: 'R10',
        status: 'fail',
        stringId: s.id,
        message:
          `String ${s.id}: Modul-Mix (${s.moduleTypeIds.join(', ')}) — ` +
          `ein String = ein Modultyp.`,
      });
    }
  }
  return fails.length > 0 ? fails : ok('R10', 'Alle Strings sortenrein.');
}
