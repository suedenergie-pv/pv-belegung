import { describe, expect, it } from 'vitest';
import { buildPlanCalc } from '../src/plan';
import { checkR12, checkR6, checkR7 } from '../src/rules/current';
import { mkInput, mkString, mppt, testInverter } from './helpers';

const JW = 'jw-hd96n-r2-460'; // Imp 15,16 A · Isc 16,00 A
const MCE = 'aiko-a485-mce54db'; // Imp 14,15 A · Isc 14,88 A
const MAH = 'aiko-a480-mah54mw'; // Imp 13,78 A · Isc 14,38 A
// Isc-Vergleich seit 06.07.2026 direkt (STC, Default-Faktor 1,0) — SPEC §7

function calcOf(...args: Parameters<typeof mkInput>) {
  return buildPlanCalc(mkInput(...args));
}

describe('R6 — Eingangsstrom (Σ Imp paralleler Strings ≤ maxInputCurrentPerMpptA)', () => {
  it('PASS: 1 × Aiko-MCE-String (14,15 A ≤ 16 A)', () => {
    const res = checkR6(calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R6', status: 'ok' })]);
  });

  it('FAIL: 2 parallele Aiko-MCE-Strings (28,30 A > 16 A)', () => {
    const res = checkR6(
      calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10), mkString('S2', MCE, 10))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R6', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('28,3');
  });
});

describe('R7 — Kurzschlussstrom (Σ Isc ≤ maxShortCircuitCurrentPerMpptA, STC direkt)', () => {
  it('PASS: 1 × Jolywood-String (16,00 A ≤ 19 A) — der korrigierte §5.1-⚡-Fall (06.07.2026)', () => {
    const res = checkR7(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 15))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R7', status: 'ok' })]);
  });

  it('FAIL: 2 parallele Aiko-MAH-Strings (28,76 A > 19 A)', () => {
    const res = checkR7(
      calcOf(testInverter(), [mppt(1, mkString('S1', MAH, 10), mkString('S2', MAH, 10))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R7', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('28,76');
  });

  it('Sicherheitsfaktor konfigurierbar: konservativ 1,25 → Jolywood 20,00 A > 19 A fällt durch', () => {
    const res = checkR7(
      calcOf(testInverter(), [mppt(1, mkString('S1', JW, 15))], {
        params: { iscSafetyFactor: 1.25 },
      }),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R7', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('1,25');
    expect(res[0]!.message).toContain('20');
  });
});

describe('R12 — Kurzschlussstrom je String-Eingang (SPEC §7, ergänzt 05.07.2026)', () => {
  // Fixture analog PowerOcean Plus PV1: MPPT-Grenze 38 A, aber nur 19 A je String-Eingang
  const poPlusArtig = () =>
    testInverter({
      maxShortCircuitCurrentPerMpptA: [38, 24],
      maxShortCircuitCurrentPerStringA: [19, 24],
    });

  it('PASS: Jolywood (16,0 A) am 19-A-String-Eingang — der EcoFlow-Plus-PV1-Praxisfall (06.07.2026)', () => {
    const res = checkR12(calcOf(poPlusArtig(), [mppt(1, mkString('S1', JW, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R12', status: 'ok' })]);
  });

  it('FAIL: Jolywood (16,0 A) an 15-A-String-Eingang — obwohl R7 (MPPT-Summe) besteht', () => {
    const knappeStringGrenze = testInverter({
      maxShortCircuitCurrentPerMpptA: [38, 24],
      maxShortCircuitCurrentPerStringA: [15, 24],
    });
    const calc = calcOf(knappeStringGrenze, [mppt(1, mkString('S1', JW, 10))]);
    expect(checkR7(calc)).toEqual([expect.objectContaining({ rule: 'R7', status: 'ok' })]);
    const res = checkR12(calc);
    expect(res).toEqual([
      expect.objectContaining({ rule: 'R12', status: 'fail', mpptIndex: 1, stringId: 'S1' }),
    ]);
    expect(res[0]!.message).toContain('je String-Eingang');
    expect(res[0]!.message).toContain('Modulanzahl im String ändert den Strom nicht');
  });

  it('konservativer Faktor 1,25: Jolywood (20,0 A) fällt am 19-A-String-Eingang durch', () => {
    const res = checkR12(
      calcOf(poPlusArtig(), [mppt(1, mkString('S1', JW, 10))], {
        params: { iscSafetyFactor: 1.25 },
      }),
    );
    expect(res).toEqual([
      expect.objectContaining({ rule: 'R12', status: 'fail', mpptIndex: 1, stringId: 'S1' }),
    ]);
  });

  it('Fallback ohne Datenblattwert: MPPT-Grenze gilt je String (R12 ≙ R7 bei 1 String)', () => {
    // testInverter ohne maxShortCircuitCurrentPerStringA → Limit = 19 A (MPPT-Grenze)
    const fail = checkR12(
      calcOf(testInverter({ maxShortCircuitCurrentPerMpptA: [15, 15] }), [
        mppt(1, mkString('S1', JW, 15)),
      ]),
    );
    expect(fail).toEqual([expect.objectContaining({ rule: 'R12', status: 'fail' })]);
    const pass = checkR12(calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 15))]));
    expect(pass).toEqual([expect.objectContaining({ rule: 'R12', status: 'ok' })]);
  });
});
