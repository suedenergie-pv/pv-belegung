/**
 * Typen lt. SPEC: ModuleType (§5), InverterType (§6), String-Engine-I/O (§7).
 * Interface-Felder exakt wie in der SPEC definiert; Ergänzungen sind kommentiert.
 */

export interface ModuleType {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  cells: number;
  // Elektrik @ STC — Quelle: Hersteller-Datenblatt, Version dokumentieren
  pmaxW: number;
  vocV: number;
  iscA: number;
  vmpV: number;
  impA: number;
  tempCoeffVocPctPerK: number; // negativ
  tempCoeffPmaxPctPerK: number; // negativ
  maxSystemVoltageV: number; // 1500
  maxSeriesFuseA: number;
  // Rendering
  renderSymbol: 'jolywood_niwa_black' | 'aiko_abc'; // SPEC §11.2
}

export interface InverterType {
  id: string;
  name: string;
  manufacturer: string;
  acPowerKw: number;
  maxDcVoltageV: number; // absolute Grenze (Winter-Voc!)
  mpptCount: number;
  mpptVoltageRange: [number, number]; // [Vmin, Vmax] pro MPPT
  startupVoltageV: number;
  /**
   * Je MPPT (Länge = mpptCount, Index 0 = MPPT 1) — reale WR haben ungleiche
   * MPPTs (SPEC §6 Schema-Update 04.07.2026, z. B. Sungrow SH-T 32/32/16 A).
   */
  maxInputCurrentPerMpptA: number[]; // R6
  maxShortCircuitCurrentPerMpptA: number[]; // R7
  /**
   * R12 (optional, je MPPT): Kurzschlussgrenze PRO STRING-EINGANG — nur setzen,
   * wo das Datenblatt sie explizit nennt (PO Plus PV1: 19 A je Stecker).
   * Fehlt der Wert, nutzt R12 die MPPT-Grenze (R7) als Fallback.
   */
  maxShortCircuitCurrentPerStringA?: number[];
  maxDcAcRatio: number; // Überbelegungsgrenze lt. Hersteller, sonst Default 1.35
  stringsPerMppt: number[]; // je MPPT
  /** Speicher-Kompatibilität als Flag-Liste (SPEC §6; v1 ohne Rechenlogik). */
  compatibleBatteries: string[];
  /**
   * R9-Ausnahme „WR mit Schatten-Management" (SPEC §7 R9). Die SPEC nennt das
   * Flag, definiert aber keinen Feldnamen — Name siehe OFFENE_FRAGEN.md.
   */
  hasShadeManagement: boolean;
  /**
   * true = Platzhalter mit FREI ERFUNDENEN Werten (CLAUDE.md Bau-Reihenfolge 1),
   * niemals für echte Planung oder Kalibrierung verwenden.
   */
  isDummy?: boolean;
}

/** Auslegungsparameter (SPEC §7, Admin-konfigurierbar). */
export interface DesignParams {
  /** Winter-Leerlauf, °C (Default −15) */
  tMinC: number;
  /** Sommer-Volllast Zelltemperatur, °C (Default +70) */
  tCellMaxC: number;
  /** Sicherheitsfaktor Kurzschlussstrom R7/R12 (Default 1,0 = STC-Direktvergleich, SPEC §7 06.07.2026) */
  iscSafetyFactor: number;
}

/** Ausrichtung einer Dachfläche — Minimalausschnitt aus RoofPlane (SPEC §4.1) für R9. */
export interface PlaneOrientation {
  id: string;
  azimuthDeg: number;
  pitchDeg: number;
}

export interface PlannedModule {
  moduleTypeId: string;
  planeId: string;
}

/** Ein String = Serienschaltung der gelisteten Module. */
export interface PlannedString {
  id: string;
  modules: PlannedModule[];
}

export interface MpptAssignment {
  /** 1-basiert; muss ≤ inverter.mpptCount sein */
  mpptIndex: number;
  strings: PlannedString[];
}

export interface StringPlanInput {
  inverter: InverterType;
  /** Katalog(-Ausschnitt) zur Auflösung der moduleTypeId */
  moduleTypes: ModuleType[];
  planes: PlaneOrientation[];
  mppts: MpptAssignment[];
  params?: Partial<DesignParams>;
}

export const RULE_IDS = [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type RuleStatus = 'ok' | 'warn' | 'fail';

export interface RuleResult {
  rule: RuleId;
  status: RuleStatus;
  /** Immer konkret mit Zahlen (SPEC §7 Fehlerdarstellung), niemals nur „ungültig". */
  message: string;
  mpptIndex?: number;
  stringId?: string;
}

export interface StringSummary {
  id: string;
  mpptIndex: number;
  moduleCount: number;
  /** Stringspannung Winter-Leerlauf (Summe Voc_cold), V */
  vocColdV: number;
  /** Stringspannung Sommer-Volllast (Summe Vmp_hot), V */
  vmpHotV: number;
}

export interface StringPlanResult {
  /** true = keine Regel mit status 'fail' (Warnungen erlaubt). Nur gültige Pläne sind exportierbar (SPEC §7). */
  valid: boolean;
  results: RuleResult[];
  /** Zusammenfassung pro Regel fürs Export-Payload `regelPruefung` (SPEC §13). */
  regeln: Record<RuleId, RuleStatus>;
  /** kWp = Σ Module × Pmax (SPEC §9) */
  kwp: number;
  dcAcRatio: number;
  strings: StringSummary[];
}
