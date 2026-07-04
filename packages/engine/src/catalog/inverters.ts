import type { InverterType } from '../types';

/**
 * ⚠️⚠️ WECHSELRICHTER-KATALOG: BISHER NUR DUMMY-EINTRÄGE ⚠️⚠️
 *
 * Alle Werte FREI ERFUNDEN — Schema + Seed-Struktur lt. CLAUDE.md Bau-Reihenfolge 1;
 * die echte Modellliste (EcoFlow, Sungrow, SigEnergy, Huawei) liefert Genrih
 * (SPEC §6 TODO / §16 #3). Dummys NIEMALS für echte Planung oder Kalibrierung
 * verwenden. Echte Einträge: MPPT-Werte ausschließlich aus dem Hersteller-Datenblatt.
 *
 * Die zwei Dummys sind bewusst gegensätzlich gewählt, damit die Testfälle beide
 * Pfade zeigen: Standard-MPPT (fällt bei Jolywood-Strömen durch, vgl. SPEC §5.1 ⚡)
 * vs. High-Current-MPPT.
 */

export const DUMMY_WR_STANDARD_10K: InverterType = {
  id: 'dummy-standard-10k',
  name: 'DUMMY Standard-WR 10 kW — NICHT VERWENDEN',
  manufacturer: 'DUMMY',
  acPowerKw: 10,
  maxDcVoltageV: 1000,
  mpptCount: 2,
  mpptVoltageRange: [200, 950],
  startupVoltageV: 180,
  maxInputCurrentPerMpptA: 16,
  maxShortCircuitCurrentPerMpptA: 19,
  maxDcAcRatio: 1.35,
  stringsPerMppt: 2,
  compatibleBatteries: [],
  hasShadeManagement: false,
  isDummy: true,
};

export const DUMMY_WR_HIGHCURRENT_12K: InverterType = {
  id: 'dummy-highcurrent-12k',
  name: 'DUMMY High-Current-WR 12 kW — NICHT VERWENDEN',
  manufacturer: 'DUMMY',
  acPowerKw: 12,
  maxDcVoltageV: 1100,
  mpptCount: 2,
  mpptVoltageRange: [150, 1000],
  startupVoltageV: 150,
  maxInputCurrentPerMpptA: 32,
  maxShortCircuitCurrentPerMpptA: 44,
  maxDcAcRatio: 1.5,
  stringsPerMppt: 2,
  compatibleBatteries: ['dummy-speicher'],
  hasShadeManagement: true,
  isDummy: true,
};

export const INVERTERS: InverterType[] = [DUMMY_WR_STANDARD_10K, DUMMY_WR_HIGHCURRENT_12K];
