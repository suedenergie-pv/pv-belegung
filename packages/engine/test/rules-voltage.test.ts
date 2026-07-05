import { describe, expect, it } from 'vitest';
import { buildPlanCalc } from '../src/plan';
import { checkR1, checkR2, checkR3, checkR4, checkR5 } from '../src/rules/voltage';
import { mkInput, mkString, mppt, testInverter } from './helpers';

const JW = 'jw-hd96n-r2-460'; // Voc_cold ≈ 38,84 V · Vmp_hot ≈ 26,52 V · Vmp 30,34 V
const MCE = 'aiko-a485-mce54db'; // Voc_cold ≈ 44,50 V · Vmp_hot ≈ 30,29 V

function calcOf(...args: Parameters<typeof mkInput>) {
  return buildPlanCalc(mkInput(...args));
}

describe('R1 — Max. DC-Spannung (n × Voc_cold ≤ maxDcVoltageV)', () => {
  it('PASS: 25 × Jolywood am 1000-V-WR (971 V)', () => {
    const res = checkR1(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 25))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R1', status: 'ok' })]);
  });

  it('FAIL: 26 × Jolywood (1.010 V > 1.000 V), Meldung nennt Maximum 25', () => {
    const res = checkR1(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 26))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R1', status: 'fail', stringId: 'S1' })]);
    expect(res[0]!.message).toContain('26 Module');
    expect(res[0]!.message).toContain('Maximal 25 Module');
  });
});

describe('R2 — Systemspannung Modul (n × Voc_cold ≤ maxSystemVoltageV)', () => {
  it('PASS: 25 × Jolywood (971 V ≤ 1.500 V)', () => {
    const res = checkR2(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 25))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R2', status: 'ok' })]);
  });

  it('FAIL: 40 × Jolywood am (fiktiven) 1600-V-WR — 1.553,6 V > 1.500 V, R1 dabei ok', () => {
    const calc = calcOf(testInverter({ maxDcVoltageV: 1600 }), [
      mppt(1, mkString('S1', JW, 40)),
    ]);
    expect(checkR2(calc)).toEqual([
      expect.objectContaining({ rule: 'R2', status: 'fail', stringId: 'S1' }),
    ]);
    expect(checkR1(calc)).toEqual([expect.objectContaining({ rule: 'R1', status: 'ok' })]);
  });
});

describe('R3 — MPPT-Fenster unten (n × Vmp_hot ≥ mpptVmin)', () => {
  it('PASS: 7 × Aiko MCE54Db (212,0 V ≥ 200 V)', () => {
    const res = checkR3(calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 7))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R3', status: 'ok' })]);
  });

  it('FAIL: 6 × Aiko MCE54Db (181,7 V < 200 V), Meldung nennt Minimum 7 — R5 isoliert ok', () => {
    const calc = calcOf(testInverter({ startupVoltageV: 100 }), [
      mppt(1, mkString('S1', MCE, 6)),
    ]);
    const res = checkR3(calc);
    expect(res).toEqual([expect.objectContaining({ rule: 'R3', status: 'fail', stringId: 'S1' })]);
    expect(res[0]!.message).toContain('Mindestens 7 Module');
    expect(checkR5(calc)).toEqual([expect.objectContaining({ rule: 'R5', status: 'ok' })]);
  });
});

describe('R4 — MPPT-Fenster oben (n × Vmp_STC ≤ mpptVmax)', () => {
  it('PASS: 25 × Jolywood (758,5 V ≤ 950 V)', () => {
    const res = checkR4(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 25))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R4', status: 'ok' })]);
  });

  it('FAIL: 17 × Jolywood an MPPT-Max 500 V (515,8 V)', () => {
    const res = checkR4(
      calcOf(testInverter({ mpptVoltageRange: [200, 500] }), [mppt(1, mkString('S1', JW, 17))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R4', status: 'fail', stringId: 'S1' })]);
  });
});

describe('R5 — Anlaufspannung (n × Vmp_hot ≥ startupVoltageV)', () => {
  it('PASS: 8 × Jolywood (212,1 V ≥ 180 V)', () => {
    const res = checkR5(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 8))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R5', status: 'ok' })]);
  });

  it('FAIL: 8 × Jolywood bei Anlaufspannung 300 V (212,1 V) — R3 isoliert ok', () => {
    const calc = calcOf(
      testInverter({ mpptVoltageRange: [100, 950], startupVoltageV: 300 }),
      [mppt(1, mkString('S1', JW, 8))],
    );
    expect(checkR5(calc)).toEqual([
      expect.objectContaining({ rule: 'R5', status: 'fail', stringId: 'S1' }),
    ]);
    expect(checkR3(calc)).toEqual([expect.objectContaining({ rule: 'R3', status: 'ok' })]);
  });
});
