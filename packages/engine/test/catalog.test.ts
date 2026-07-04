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

describe('WR-Katalog (SPEC §6.1, PDF-verifiziert)', () => {
  const byId = (id: string) => {
    const wr = INVERTERS.find((w) => w.id === id);
    if (!wr) throw new Error(`WR ${id} fehlt im Katalog`);
    return wr;
  };

  it('enthält keine Dummy-Einträge mehr und 28 Klassen (SPEC §6.1; Huawei M1 raus, 05.07.2026)', () => {
    expect(INVERTERS).toHaveLength(28);
    expect(INVERTERS.some((wr) => wr.manufacturer === 'Huawei')).toBe(false);
    for (const wr of INVERTERS) {
      expect(wr.isDummy ?? false).toBe(false);
      expect(wr.mpptCount).toBe(wr.stringsPerMppt.length);
      expect(wr.mpptCount).toBe(wr.maxInputCurrentPerMpptA.length);
      expect(wr.mpptCount).toBe(wr.maxShortCircuitCurrentPerMpptA.length);
    }
  });

  it('Sungrow SH25T — Datenblatt Version 3', () => {
    const wr = byId('sungrow-sh25t');
    expect(wr.acPowerKw).toBe(25);
    expect(wr.maxDcVoltageV).toBe(1000);
    expect(wr.mpptVoltageRange).toEqual([150, 950]);
    expect(wr.startupVoltageV).toBe(180);
    expect(wr.mpptCount).toBe(3);
    expect(wr.stringsPerMppt).toEqual([2, 2, 1]);
    expect(wr.maxInputCurrentPerMpptA).toEqual([32, 32, 16]);
    expect(wr.maxShortCircuitCurrentPerMpptA).toEqual([40, 40, 20]);
    expect(wr.maxDcAcRatio).toBeCloseTo(2.0, 6); // 50.000 Wp / 25.000 W
    expect(wr.compatibleBatteries).toEqual(['sungrow-sbr']); // bestätigt 05.07.2026
  });

  it('EcoFlow PowerOcean 12K — Datenblatt 20241226', () => {
    const wr = byId('ecoflow-po-12k');
    expect(wr.acPowerKw).toBe(12);
    expect(wr.mpptVoltageRange).toEqual([200, 850]);
    expect(wr.startupVoltageV).toBe(160);
    expect(wr.maxInputCurrentPerMpptA).toEqual([16, 16]);
    expect(wr.maxShortCircuitCurrentPerMpptA).toEqual([24, 24]);
    expect(wr.maxDcAcRatio).toBeCloseTo(16000 / 12000, 6);
  });

  it('EcoFlow PowerOcean Plus 29K9 — heterogene MPPTs (PV1 doppelt)', () => {
    const wr = byId('ecoflow-pop-29k9');
    expect(wr.acPowerKw).toBe(29.9);
    expect(wr.mpptCount).toBe(3);
    expect(wr.stringsPerMppt).toEqual([2, 1, 1]);
    expect(wr.maxInputCurrentPerMpptA).toEqual([32, 16, 16]);
    expect(wr.maxShortCircuitCurrentPerMpptA).toEqual([38, 24, 24]);
    expect(wr.maxDcAcRatio).toBeCloseTo(40000 / 29900, 6);
  });

  it('Sigen Hybrid 12.0 TP2 — MPPT2 mit 2 Strings (16/32 A, 22/44 A)', () => {
    const wr = byId('sigen-hybrid-12-0-tp2');
    expect(wr.maxDcVoltageV).toBe(1100);
    expect(wr.mpptVoltageRange).toEqual([160, 1000]);
    expect(wr.startupVoltageV).toBe(180);
    expect(wr.stringsPerMppt).toEqual([1, 2]);
    expect(wr.maxInputCurrentPerMpptA).toEqual([16, 32]);
    expect(wr.maxShortCircuitCurrentPerMpptA).toEqual([22, 44]);
    expect(wr.maxDcAcRatio).toBe(2.0);
  });

  it('SigenStor EC — MPPT-Anzahl je Leistungsklasse (2/3/4)', () => {
    expect(byId('sigenstor-ec-8-0-tp').mpptCount).toBe(2);
    expect(byId('sigenstor-ec-15-0-tp').mpptCount).toBe(3);
    expect(byId('sigenstor-ec-30-0-tp').mpptCount).toBe(4);
    const wr = byId('sigenstor-ec-30-0-tp');
    expect(wr.maxInputCurrentPerMpptA).toEqual([16, 16, 16, 16]);
    expect(wr.maxShortCircuitCurrentPerMpptA).toEqual([20, 20, 20, 20]);
    expect(wr.maxDcAcRatio).toBeCloseTo(1.6, 6); // 48.000 Wp / 30.000 W
  });
});
