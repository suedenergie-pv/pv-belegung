import { buildPlanCalc } from './plan';
import { checkR6, checkR7 } from './rules/current';
import { checkR11 } from './rules/ratio';
import { checkR10, checkR8, checkR9 } from './rules/topology';
import { checkR1, checkR2, checkR3, checkR4, checkR5 } from './rules/voltage';
import { RULE_IDS } from './types';
import type { RuleId, RuleStatus, StringPlanInput, StringPlanResult } from './types';

/**
 * String-Engine (SPEC §7): prüft einen Stringplan gegen R1–R11.
 * Deterministische Datenblatt-Mathematik — kein LLM, keine Heuristik.
 * Alle Regeln müssen bestehen, sonst ist der Plan UNGÜLTIG und nicht exportierbar.
 */
export function checkStringPlan(input: StringPlanInput): StringPlanResult {
  const calc = buildPlanCalc(input);

  const results = [
    ...checkR1(calc),
    ...checkR2(calc),
    ...checkR3(calc),
    ...checkR4(calc),
    ...checkR5(calc),
    ...checkR6(calc),
    ...checkR7(calc),
    ...checkR8(calc),
    ...checkR9(calc),
    ...checkR10(calc),
    ...checkR11(calc),
  ];

  const rank: Record<RuleStatus, number> = { ok: 0, warn: 1, fail: 2 };
  const regeln = Object.fromEntries(RULE_IDS.map((id) => [id, 'ok'])) as Record<
    RuleId,
    RuleStatus
  >;
  for (const r of results) {
    if (rank[r.status] > rank[regeln[r.rule]]) {
      regeln[r.rule] = r.status;
    }
  }

  return {
    valid: results.every((r) => r.status !== 'fail'),
    results,
    regeln,
    kwp: calc.kwp,
    dcAcRatio: calc.kwp / calc.inverter.acPowerKw,
    strings: calc.allStrings.map((s) => ({
      id: s.id,
      mpptIndex: s.mpptIndex,
      moduleCount: s.moduleCount,
      vocColdV: s.vocColdSumV,
      vmpHotV: s.vmpHotSumV,
    })),
  };
}
