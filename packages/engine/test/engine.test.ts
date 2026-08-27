import { describe, expect, it } from 'vitest';
import { checkStringPlan } from '../src/engine';
import { mkInput, mkString, mppt, testInverter } from './helpers';

const JW = 'jw-hd96n-r2-460';
const MCE = 'aiko-a485-mce54db';

// Fixture analog eines High-Current-WR (frei erfunden, nur für Tests)
const highCurrentFixture = () =>
  testInverter({
    acPowerKw: 12,
    maxDcVoltageV: 1100,
    mpptVoltageRange: [150, 1000],
    startupVoltageV: 150,
    maxInputCurrentPerMpptA: [32, 32],
    maxShortCircuitCurrentPerMpptA: [44, 44],
    maxDcAcRatio: 1.5,
  });

describe('checkStringPlan — Orchestrierung R1–R11 (SPEC §7)', () => {
  it('gültiger Plan: 2 × 12 Aiko MCE54Db am Standard-Fixture-WR → alle Regeln ok', () => {
    const res = checkStringPlan(
      mkInput(testInverter(), [
        mppt(1, mkString('S1', MCE, 12)),
        mppt(2, mkString('S2', MCE, 12)),
      ]),
    );
    expect(res.valid).toBe(true);
    expect(Object.values(res.regeln).every((s) => s === 'ok')).toBe(true);
    expect(res.kwp).toBeCloseTo(11.64, 6);
    expect(res.strings).toHaveLength(2);
    expect(res.strings[0]!.vocColdV).toBeCloseTo(12 * 44.4992, 3);
    expect(res.strings[0]!.vmpHotV).toBeCloseTo(12 * 30.2869, 2);
    // Ergebnis enthält für jede der 12 Regeln mindestens einen Eintrag
    expect(new Set(res.results.map((r) => r.rule)).size).toBe(12);
  });

  it('mehrfach ungültiger Plan meldet alle verletzten Regeln konkret', () => {
    // MPPT 1: 26er- und 25er-Jolywood-String parallel → R1 (26er), R6, R7, R8; gesamt R11
    const res = checkStringPlan(
      mkInput(testInverter(), [mppt(1, mkString('S1', JW, 26), mkString('S2', JW, 25))]),
    );
    expect(res.valid).toBe(false);
    expect(res.regeln.R1).toBe('fail');
    expect(res.regeln.R6).toBe('fail');
    expect(res.regeln.R7).toBe('fail');
    expect(res.regeln.R8).toBe('fail');
    expect(res.regeln.R11).toBe('fail'); // 23,46 kWp an 10 kW
    expect(res.regeln.R2).toBe('ok');
    // SPEC §7: niemals nur „ungültig" — jede Fail-Meldung enthält Zahlen
    for (const r of res.results.filter((x) => x.status === 'fail')) {
      expect(r.message).toMatch(/\d/);
    }
  });

  it('Warnung (R11 ≥ 1,2) macht den Plan NICHT ungültig', () => {
    // 32 × Jolywood am High-Current-Fixture: 14,72 kWp / 12 kW = 1,23
    const res = checkStringPlan(
      mkInput(highCurrentFixture(), [
        mppt(1, mkString('S1', JW, 16)),
        mppt(2, mkString('S2', JW, 16)),
      ]),
    );
    expect(res.valid).toBe(true);
    expect(res.regeln.R11).toBe('warn');
    expect(res.dcAcRatio).toBeCloseTo(1.2267, 3);
  });

  it('Strukturfehler werfen statt Regelergebnis (ungültige Eingaben, SPEC §1)', () => {
    expect(() => checkStringPlan(mkInput(testInverter(), []))).toThrow(/Keine MPPT-Zuordnung/);
    expect(() => checkStringPlan(mkInput(testInverter(), [mppt(1)]))).toThrow(/keine Strings/);
    expect(() =>
      checkStringPlan(
        mkInput(testInverter(), [
          mppt(1, mkString('S1', JW, 10)),
          mppt(1, mkString('S2', JW, 10)),
        ]),
      ),
    ).toThrow(/MPPT 1 ist doppelt/);
    expect(() =>
      checkStringPlan(
        mkInput(testInverter(), [
          mppt(1, mkString('S1', JW, 10)),
          mppt(2, mkString('S1', JW, 10)),
        ]),
      ),
    ).toThrow(/String-ID 'S1' ist doppelt/);
    expect(() =>
      checkStringPlan(mkInput(testInverter(), [mppt(3, mkString('S1', JW, 10))])),
    ).toThrow(/MPPT-Index 3/);
    expect(() =>
      checkStringPlan(mkInput(testInverter(), [mppt(1, mkString('S1', 'gibt-es-nicht', 5))])),
    ).toThrow(/Unbekannter Modultyp/);
    expect(() =>
      checkStringPlan(mkInput(testInverter(), [mppt(1, { id: 'S1', modules: [] })])),
    ).toThrow(/keine Module/);
    expect(() =>
      checkStringPlan(mkInput(testInverter(), [mppt(1, mkString('S1', JW, 5, 'fremde-flaeche'))])),
    ).toThrow(/Unbekannte Dachfläche/);
  });
});
