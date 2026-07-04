import { describe, expect, it } from 'vitest';
import {
  AIKO_A460_MAH54MW,
  AIKO_A460_MCE54DB,
  JOLYWOOD_JW_HD96N_R2_460,
} from '../src/catalog/modules';
import { maxModulesPerString, minModulesPerString } from '../src/stringlimits';
import { vocColdV, vmpHotV } from '../src/temperature';
import { testInverter } from './helpers';

/**
 * Rechen-Referenzen aus SPEC §5.1 / kalibrierung.md (−15 °C / +70 °C).
 * CLAUDE.md: Weicht die Engine von diesen Werten ab, ist die Engine falsch.
 */

describe('Temperaturkorrektur (SPEC §7)', () => {
  it('Voc_cold bei −15 °C trifft die §5.1-Referenzen', () => {
    expect(vocColdV(JOLYWOOD_JW_HD96N_R2_460)).toBeCloseTo(38.84, 2);
    expect(vocColdV(AIKO_A460_MCE54DB)).toBeCloseTo(43.96, 2);
    expect(vocColdV(AIKO_A460_MAH54MW)).toBeCloseTo(44.67, 2);
  });

  it('Voc_cold entspricht exakt der SPEC-Formel (Faktoren 1,10 bzw. 1,088)', () => {
    expect(vocColdV(JOLYWOOD_JW_HD96N_R2_460)).toBeCloseTo(35.31 * 1.1, 6);
    expect(vocColdV(AIKO_A460_MCE54DB)).toBeCloseTo(40.4 * 1.088, 6);
    expect(vocColdV(AIKO_A460_MAH54MW)).toBeCloseTo(41.06 * 1.088, 6);
  });

  it('Vmp_hot bei +70 °C trifft die §5.1-Referenzen', () => {
    expect(vmpHotV(JOLYWOOD_JW_HD96N_R2_460)).toBeCloseTo(26.52, 2);
    expect(vmpHotV(AIKO_A460_MCE54DB)).toBeCloseTo(29.85, 2);
    expect(vmpHotV(AIKO_A460_MAH54MW)).toBeCloseTo(30.57, 2);
  });

  it('Auslegungstemperaturen sind konfigurierbar (Admin, SPEC §7)', () => {
    // T_min −25 °C: Faktor 1 + 0,0025 × 50 = 1,125
    expect(vocColdV(JOLYWOOD_JW_HD96N_R2_460, { tMinC: -25, tCellMaxC: 70, iscSafetyFactor: 1.25 }))
      .toBeCloseTo(35.31 * 1.125, 6);
  });
});

describe('Stringlängen-Grenzen (R1/R2 bzw. R3/R5)', () => {
  const wr1000 = testInverter({ maxDcVoltageV: 1000 });

  it('max. Module/String am 1000-V-WR: Jolywood 25, beide Aiko 22 (SPEC §5.1)', () => {
    expect(maxModulesPerString(JOLYWOOD_JW_HD96N_R2_460, wr1000)).toBe(25);
    expect(maxModulesPerString(AIKO_A460_MCE54DB, wr1000)).toBe(22);
    expect(maxModulesPerString(AIKO_A460_MAH54MW, wr1000)).toBe(22);
  });

  it('R2 begrenzt zusätzlich über die Modul-Systemspannung', () => {
    // WR-Grenze 1600 V > Modul-Systemspannung 1500 V → 1500 V bindet:
    // floor(1500 / 38,841) = 38
    const wr1600 = testInverter({ maxDcVoltageV: 1600 });
    expect(maxModulesPerString(JOLYWOOD_JW_HD96N_R2_460, wr1600)).toBe(38);
  });

  it('min. Module/String aus MPPT-Minimum und Anlaufspannung', () => {
    // Jolywood: ceil(max(200, 180) / 26,517) = 8
    expect(minModulesPerString(JOLYWOOD_JW_HD96N_R2_460, testInverter())).toBe(8);
    // Aiko MCE54Db: ceil(200 / 29,845) = 7
    expect(minModulesPerString(AIKO_A460_MCE54DB, testInverter())).toBe(7);
  });
});
