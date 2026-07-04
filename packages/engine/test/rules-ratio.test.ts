import { describe, expect, it } from 'vitest';
import { buildPlanCalc } from '../src/plan';
import { checkR11 } from '../src/rules/ratio';
import { mkInput, mkString, mppt, testInverter } from './helpers';

const JW = 'jw-hd96n-r2-460'; // 460 W

function calcOf(...args: Parameters<typeof mkInput>) {
  return buildPlanCalc(mkInput(...args));
}

describe('R11 — DC:AC-Ratio (Warnung ab 1,2, hart bei Katalogwert)', () => {
  it('OK: 10 Module = 4,6 kWp an 10 kW (0,46)', () => {
    const res = checkR11(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R11', status: 'ok' })]);
  });

  it('WARN: 27 Module = 12,42 kWp an 10 kW (1,24 ≥ 1,2, aber ≤ 1,35)', () => {
    const res = checkR11(
      calcOf(testInverter(), [mppt(1, mkString('S1', JW, 14)), mppt(2, mkString('S2', JW, 13))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R11', status: 'warn' })]);
    expect(res[0]!.message).toContain('1,24');
  });

  it('FAIL: 30 Module = 13,8 kWp an 10 kW (1,38 > 1,35)', () => {
    const res = checkR11(
      calcOf(testInverter(), [mppt(1, mkString('S1', JW, 15)), mppt(2, mkString('S2', JW, 15))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R11', status: 'fail' })]);
    expect(res[0]!.message).toContain('1,38');
    expect(res[0]!.message).toContain('1,35');
  });
});
