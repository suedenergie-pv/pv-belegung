import type { InverterType } from '../types';

/**
 * Wechselrichter-Katalog Heimbereich bis 30 kWp (SPEC §6.1, Stand 04.07.2026).
 * Alle Werte aus den Datenblatt-PDFs in docs/datenblaetter/ — Änderungen NUR
 * mit neuem Datenblatt + SPEC-Update. `maxDcAcRatio` = max. PV-Eingangsleistung
 * lt. Datenblatt / AC-Nennleistung (als exakter Bruch hinterlegt).
 *
 * Speicher-IDs (nur Kompatibilitäts-Flag, v1 ohne Rechenlogik):
 * ecoflow-powerocean-lfp · sungrow-sbh · sungrow-sbr · sigenstor-bat · huawei-luna2000-s1
 */

/** EcoFlow PowerOcean 3-phasig. Quelle: PowerOcean (three-phase)_Datasheet_DE 20241226.pdf */
function ecoflowPowerOcean(klasse: string, acPowerKw: number, maxPvW: number): InverterType {
  return {
    id: `ecoflow-po-${klasse.toLowerCase()}`,
    name: `EcoFlow PowerOcean EF HD-P3-${klasse}-S1`,
    manufacturer: 'EcoFlow',
    acPowerKw,
    maxDcVoltageV: 1000,
    mpptCount: 2,
    mpptVoltageRange: [200, 850],
    startupVoltageV: 160,
    maxInputCurrentPerMpptA: [16, 16],
    maxShortCircuitCurrentPerMpptA: [24, 24],
    maxDcAcRatio: maxPvW / (acPowerKw * 1000),
    stringsPerMppt: [1, 1],
    compatibleBatteries: ['ecoflow-powerocean-lfp'],
    hasShadeManagement: false,
  };
}

/**
 * EcoFlow PowerOcean Plus 3-phasig. Quelle: ...Plus Three-Phase_Datasheet_DE_20241225.pdf
 * PV1: 2 Strings (16 A/19 A je String → 32 A/38 A je MPPT), PV2/PV3: je 1 String 16 A/24 A.
 * ⚠️ Per-String-Grenze 19 A an PV1 wird von R7 (MPPT-Ebene) nicht abgedeckt — OFFENE_FRAGEN.
 */
function ecoflowPowerOceanPlus(klasse: string, acPowerKw: number, maxPvW: number): InverterType {
  return {
    id: `ecoflow-pop-${klasse.toLowerCase()}`,
    name: `EcoFlow PowerOcean Plus EF HD-P3-${klasse}-S1`,
    manufacturer: 'EcoFlow',
    acPowerKw,
    maxDcVoltageV: 1000,
    mpptCount: 3,
    mpptVoltageRange: [200, 850],
    startupVoltageV: 160,
    maxInputCurrentPerMpptA: [32, 16, 16],
    maxShortCircuitCurrentPerMpptA: [38, 24, 24],
    // Datenblatt PV1: „19×2" = 19 A je String-Eingang (R12) — Jolywood (20,0 A) fällt hier durch
    maxShortCircuitCurrentPerStringA: [19, 24, 24],
    maxDcAcRatio: maxPvW / (acPowerKw * 1000),
    stringsPerMppt: [2, 1, 1],
    compatibleBatteries: ['ecoflow-powerocean-lfp'],
    hasShadeManagement: false,
  };
}

/**
 * Sigenergy Sigen Hybrid TP2 (3-phasig). Quelle: Sigenergy Sigen Hybrid Inverter 3.0-12.0 TP2.pdf
 * 10.0/12.0 TP2: MPPT2 mit 2 Strings (32 A/44 A). Max. PV = 2,0 × AC (alle Klassen).
 */
function sigenHybridTp2(klasse: string, acPowerKw: number, mppt2Doppelt: boolean): InverterType {
  return {
    id: `sigen-hybrid-${klasse.replace('.', '-')}-tp2`,
    name: `Sigenergy Sigen Hybrid ${klasse} TP2`,
    manufacturer: 'Sigenergy',
    acPowerKw,
    maxDcVoltageV: 1100,
    mpptCount: 2,
    mpptVoltageRange: [160, 1000],
    startupVoltageV: 180,
    maxInputCurrentPerMpptA: mppt2Doppelt ? [16, 32] : [16, 16],
    maxShortCircuitCurrentPerMpptA: mppt2Doppelt ? [22, 44] : [22, 22],
    maxDcAcRatio: 2.0,
    stringsPerMppt: mppt2Doppelt ? [1, 2] : [1, 1],
    compatibleBatteries: ['sigenstor-bat'],
    hasShadeManagement: false,
  };
}

/**
 * Sigenergy SigenStor EC (Sigen Energy Controller, 3-phasig, Stack-System).
 * Quelle: Sigenergy Sigen Energy Controller.pdf. Max. PV = 1,6 × AC; je MPPT 1 String, 16 A/20 A.
 */
function sigenstorEc(klasse: string, acPowerKw: number, mpptCount: number): InverterType {
  return {
    id: `sigenstor-ec-${klasse.replace('.', '-')}-tp`,
    name: `Sigenergy SigenStor EC ${klasse} TP`,
    manufacturer: 'Sigenergy',
    acPowerKw,
    maxDcVoltageV: 1100,
    mpptCount,
    mpptVoltageRange: [160, 1000],
    startupVoltageV: 180,
    maxInputCurrentPerMpptA: Array.from({ length: mpptCount }, () => 16),
    maxShortCircuitCurrentPerMpptA: Array.from({ length: mpptCount }, () => 20),
    maxDcAcRatio: 1.6,
    stringsPerMppt: Array.from({ length: mpptCount }, () => 1),
    compatibleBatteries: ['sigenstor-bat'],
    hasShadeManagement: false,
  };
}

/**
 * Sungrow SH15/20/25T (3-phasiger Hybrid, High-Current: max. 16 A pro Strang).
 * Quelle: Datenblatt_Sungrow_sh15-20-25t.pdf. MPPTs: 2/2/1 Strings, 32/32/16 A, SC 40/40/20 A.
 * Max. PV = 2,0 × AC. Einschaltspannung 180 V (MPPT-Bereich ab 150 V).
 * Speicher: SBR (bestätigt Genrih 05.07.2026; Datenblatt nennt nur „Lithium-Ionen 100–700 V").
 */
function sungrowShT(klasse: string, acPowerKw: number): InverterType {
  return {
    id: `sungrow-${klasse.toLowerCase()}`,
    name: `Sungrow ${klasse}`,
    manufacturer: 'Sungrow',
    acPowerKw,
    maxDcVoltageV: 1000,
    mpptCount: 3,
    mpptVoltageRange: [150, 950],
    startupVoltageV: 180,
    maxInputCurrentPerMpptA: [32, 32, 16],
    maxShortCircuitCurrentPerMpptA: [40, 40, 20],
    maxDcAcRatio: 2.0,
    stringsPerMppt: [2, 2, 1],
    compatibleBatteries: ['sungrow-sbr'],
    hasShadeManagement: false,
  };
}

// Huawei SUN2000-3–10KTL-M1: NICHT im Katalog (Entscheidung Genrih 05.07.2026).
// Grund: nur 11 A Eingangs-/15 A Kurzschlussstrom pro MPPT — unter dem Imp aller
// Katalogmodule, jeder String fällt durch R6/R7. Datenblatt bleibt im Repo.

export const INVERTERS: InverterType[] = [
  // EcoFlow PowerOcean (Main-Marke)
  ecoflowPowerOcean('6K0', 6, 10000),
  ecoflowPowerOcean('8K0', 8, 12000),
  ecoflowPowerOcean('10K', 10, 14000),
  ecoflowPowerOcean('12K', 12, 16000),
  // EcoFlow PowerOcean Plus
  ecoflowPowerOceanPlus('15K0', 15, 30000),
  ecoflowPowerOceanPlus('20K0', 20, 35000),
  ecoflowPowerOceanPlus('25K0', 25, 40000),
  ecoflowPowerOceanPlus('29K9', 29.9, 40000),
  // Sigenergy Sigen Hybrid TP2
  sigenHybridTp2('3.0', 3, false),
  sigenHybridTp2('4.0', 4, false),
  sigenHybridTp2('5.0', 5, false),
  sigenHybridTp2('6.0', 6, false),
  sigenHybridTp2('8.0', 8, false),
  sigenHybridTp2('10.0', 10, true),
  sigenHybridTp2('12.0', 12, true),
  // Sigenergy SigenStor EC (Stack-System)
  sigenstorEc('5.0', 5, 2),
  sigenstorEc('6.0', 6, 2),
  sigenstorEc('8.0', 8, 2),
  sigenstorEc('10.0', 10, 3),
  sigenstorEc('12.0', 12, 3),
  sigenstorEc('15.0', 15, 3),
  sigenstorEc('17.0', 17, 4),
  sigenstorEc('20.0', 20, 4),
  sigenstorEc('25.0', 25, 4),
  sigenstorEc('30.0', 30, 4),
  // Sungrow
  sungrowShT('SH15T', 15),
  sungrowShT('SH20T', 20),
  sungrowShT('SH25T', 25),
];
