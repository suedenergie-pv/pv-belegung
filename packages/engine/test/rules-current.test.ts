import { describe, expect, it } from 'vitest';
import { buildPlanCalc } from '../src/plan';
import { checkR6, checkR7 } from '../src/rules/current';
import { mkInput, mkString, mppt, testInverter } from './helpers';

const JW = 'jw-hd96n-r2-460'; // Imp 15,16 A · Isc 16,00 A → ×1,25 = 20,00 A
const MCE = 'aiko-a460-mce54db'; // Imp 13,62 A · Isc 14,58 A → ×1,25 = 18,23 A
const MAH = 'aiko-a460-mah54mw'; // Imp 13,29 A · Isc 14,25 A → ×1,25 = 17,81 A

function calcOf(...args: Parameters<typeof mkInput>) {
  return buildPlanCalc(mkInput(...args));
}

describe('R6 — Eingangsstrom (Σ Imp paralleler Strings ≤ maxInputCurrentPerMpptA)', () => {
  it('PASS: 1 × Aiko-MCE-String (13,62 A ≤ 16 A)', () => {
    const res = checkR6(calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R6', status: 'ok' })]);
  });

  it('FAIL: 2 parallele Aiko-MCE-Strings (27,24 A > 16 A)', () => {
    const res = checkR6(
      calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10), mkString('S2', MCE, 10))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R6', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('27,2');
  });
});

describe('R7 — Kurzschlussstrom (Σ Isc × 1,25 ≤ maxShortCircuitCurrentPerMpptA)', () => {
  it('PASS: 1 × Aiko-MAH-String (17,81 A ≤ 19 A)', () => {
    const res = checkR7(calcOf(testInverter(), [mppt(1, mkString('S1', MAH, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R7', status: 'ok' })]);
  });

  it('FAIL: 1 × Jolywood-String (16,00 × 1,25 = 20,00 A > 19 A) — der §5.1-⚡-Fall', () => {
    const res = checkR7(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 15))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R7', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('1,25');
    expect(res[0]!.message).toContain('20');
  });

  it('Sicherheitsfaktor ist konfigurierbar (kalibrierung.md: fix 1,25 für alle Fälle)', () => {
    // Faktor 1,0: 16,00 A ≤ 19 A → ok
    const res = checkR7(
      calcOf(testInverter(), [mppt(1, mkString('S1', JW, 15))], {
        params: { iscSafetyFactor: 1.0 },
      }),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R7', status: 'ok' })]);
  });
});
