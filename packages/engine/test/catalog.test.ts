import { describe, expect, it } from 'vitest';
import {
  AIKO_A460_MAH54MW,
  AIKO_A460_MCE54DB,
  JOLYWOOD_JW_HD96N_R2_460,
  MODULES,
} from '../src/catalog/modules';
import { INVERTERS } from '../src/catalog/inverters';

/**
 * Wächter gegen Tippfehler im Seed: Erwartungswerte sind 1:1 die Datenblatt-
 * Zahlen (docs/datenblaetter/, dokumentiert in SPEC §5.1).
 */

describe('Modulkatalog (SPEC §5.1, PDF-verifiziert)', () => {
  it('Jolywood JW-HD96N-R2-460 — Datenblatt Version 2025.01, Spalte 460 W', () => {
    const m = JOLYWOOD_JW_HD96N_R2_460;
    expect(m.id).toBe('jw-hd96n-r2-460');
    expect(m.pmaxW).toBe(460);
    expect(m.vocV).toBe(35.31);
    expect(m.iscA).toBe(16.0);
    expect(m.vmpV).toBe(30.34);
    expect(m.impA).toBe(15.16);
    expect(m.tempCoeffVocPctPerK).toBe(-0.25);
    expect(m.tempCoeffPmaxPctPerK).toBe(-0.28);
    expect(m.maxSystemVoltageV).toBe(1500);
    expect(m.maxSeriesFuseA).toBe(35);
    expect(m.cells).toBe(96);
    expect([m.lengthMm, m.widthMm, m.heightMm]).toEqual([1762, 1134, 30]);
    expect(m.weightKg).toBe(24.6);
    expect(m.renderSymbol).toBe('jolywood_niwa_black');
  });

  it('Aiko A460-MCE54Db — Datenblatt DSDr_EN_2405_V1.5, Spalte A460', () => {
    const m = AIKO_A460_MCE54DB;
    expect(m.id).toBe('aiko-a460-mce54db');
    expect(m.pmaxW).toBe(460);
    expect(m.vocV).toBe(40.4);
    expect(m.iscA).toBe(14.58);
    expect(m.vmpV).toBe(33.8);
    expect(m.impA).toBe(13.62);
    expect(m.tempCoeffVocPctPerK).toBe(-0.22);
    expect(m.tempCoeffPmaxPctPerK).toBe(-0.26);
    expect(m.maxSystemVoltageV).toBe(1500);
    expect(m.maxSeriesFuseA).toBe(25);
    expect(m.cells).toBe(108);
    expect([m.lengthMm, m.widthMm, m.heightMm]).toEqual([1762, 1134, 30]);
    expect(m.weightKg).toBe(24.5);
    expect(m.renderSymbol).toBe('aiko_abc');
  });

  it('Aiko A460-MAH54Mw — Datenblatt DS_DE_2407_V1.3, Spalte A460', () => {
    const m = AIKO_A460_MAH54MW;
    expect(m.id).toBe('aiko-a460-mah54mw');
    expect(m.pmaxW).toBe(460);
    expect(m.vocV).toBe(41.06);
    expect(m.iscA).toBe(14.25);
    expect(m.vmpV).toBe(34.62);
    expect(m.impA).toBe(13.29);
    expect(m.tempCoeffVocPctPerK).toBe(-0.22);
    expect(m.tempCoeffPmaxPctPerK).toBe(-0.26);
    expect(m.maxSystemVoltageV).toBe(1500);
    expect(m.maxSeriesFuseA).toBe(25);
    expect(m.cells).toBe(108);
    expect([m.lengthMm, m.widthMm, m.heightMm]).toEqual([1757, 1134, 30]);
    expect(m.weightKg).toBe(21.5);
    expect(m.renderSymbol).toBe('aiko_abc');
  });

  it('Katalog enthält genau die 3 bestätigten Module', () => {
    expect(MODULES.map((m) => m.id).sort()).toEqual([
      'aiko-a460-mah54mw',
      'aiko-a460-mce54db',
      'jw-hd96n-r2-460',
    ]);
  });
});

describe('WR-Katalog (SPEC §6)', () => {
  it('enthält bisher NUR klar markierte Dummy-Einträge (Modellliste = SPEC §6 TODO)', () => {
    expect(INVERTERS.length).toBeGreaterThan(0);
    for (const wr of INVERTERS) {
      expect(wr.isDummy).toBe(true);
      expect(wr.name).toContain('DUMMY');
      expect(wr.manufacturer).toBe('DUMMY');
    }
  });
});
