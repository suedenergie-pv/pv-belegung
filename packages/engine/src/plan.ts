import { resolveParams, vocColdV, vmpHotV } from './temperature';
import type {
  DesignParams,
  InverterType,
  ModuleType,
  PlaneOrientation,
  StringPlanInput,
} from './types';

/** Vorberechnete Größen eines Strings für die Regeln R1–R11. */
export interface StringCalc {
  id: string;
  mpptIndex: number;
  moduleCount: number;
  /** Modultyp des Strings, falls sortenrein — sonst null (String scheitert an R10). */
  uniformType: ModuleType | null;
  /** distinct moduleTypeIds im String (R10) */
  moduleTypeIds: string[];
  vocColdSumV: number;
  vmpHotSumV: number;
  vmpStcSumV: number;
  /** Stringstrom = max. Modulwert (Serie; bei Mix konservativ, Mix scheitert ohnehin an R10). */
  impA: number;
  iscA: number;
  /** kleinste zulässige Systemspannung der beteiligten Module (R2, konservativ) */
  minMaxSystemVoltageV: number;
  pmaxSumW: number;
  /** distinct Ausrichtungen "azimut°/neigung°" der belegten Flächen (R9) */
  orientationKeys: string[];
}

export interface MpptCalc {
  mpptIndex: number;
  strings: StringCalc[];
}

export interface PlanCalc {
  inverter: InverterType;
  params: DesignParams;
  mppts: MpptCalc[];
  allStrings: StringCalc[];
  kwp: number;
}

export function orientationKey(plane: PlaneOrientation): string {
  return `${plane.azimuthDeg}°/${plane.pitchDeg}°`;
}

/**
 * Baut die Rechenbasis für die Regelprüfung auf. Strukturfehler (unbekannte IDs,
 * leere Strings, MPPT-Index außerhalb des WR) sind Programmier-/UI-Fehler und
 * werfen — sie sind kein Regelergebnis (SPEC §1: ungültige Eingaben dürfen gar
 * nicht erst entstehen).
 */
export function buildPlanCalc(input: StringPlanInput): PlanCalc {
  const params = resolveParams(input.params);
  const inverter = input.inverter;
  if (
    inverter.maxInputCurrentPerMpptA.length !== inverter.mpptCount ||
    inverter.maxShortCircuitCurrentPerMpptA.length !== inverter.mpptCount ||
    inverter.stringsPerMppt.length !== inverter.mpptCount ||
    (inverter.maxShortCircuitCurrentPerStringA !== undefined &&
      inverter.maxShortCircuitCurrentPerStringA.length !== inverter.mpptCount)
  ) {
    throw new Error(
      `WR ${inverter.id}: MPPT-Arrays müssen Länge ${inverter.mpptCount} (mpptCount) haben — Katalogfehler.`,
    );
  }
  const moduleById = new Map(input.moduleTypes.map((m) => [m.id, m]));
  const planeById = new Map(input.planes.map((p) => [p.id, p]));

  if (input.mppts.length === 0) {
    throw new Error('Keine MPPT-Zuordnung vorhanden.');
  }
  const mpptIndizes = new Set<number>();
  const stringIds = new Set<string>();
  for (const mppt of input.mppts) {
    if (mpptIndizes.has(mppt.mpptIndex)) {
      throw new Error(`MPPT ${mppt.mpptIndex} ist doppelt zugeordnet.`);
    }
    mpptIndizes.add(mppt.mpptIndex);
    if (mppt.strings.length === 0) {
      throw new Error(`MPPT ${mppt.mpptIndex} enthält keine Strings.`);
    }
    for (const string of mppt.strings) {
      if (!string.id.trim()) throw new Error('String-ID darf nicht leer sein.');
      if (stringIds.has(string.id)) throw new Error(`String-ID '${string.id}' ist doppelt vergeben.`);
      stringIds.add(string.id);
    }
  }

  const mppts: MpptCalc[] = input.mppts.map((mppt) => {
    if (
      !Number.isInteger(mppt.mpptIndex) ||
      mppt.mpptIndex < 1 ||
      mppt.mpptIndex > inverter.mpptCount
    ) {
      throw new Error(
        `MPPT-Index ${mppt.mpptIndex} ungültig — WR ${inverter.id} hat ${inverter.mpptCount} MPPTs.`,
      );
    }

    const strings: StringCalc[] = mppt.strings.map((s) => {
      if (s.modules.length === 0) {
        throw new Error(`String ${s.id} enthält keine Module.`);
      }

      let vocColdSumV = 0;
      let vmpHotSumV = 0;
      let vmpStcSumV = 0;
      let impA = 0;
      let iscA = 0;
      let minMaxSystemVoltageV = Number.POSITIVE_INFINITY;
      let pmaxSumW = 0;
      const typeIds = new Set<string>();
      const orientations = new Set<string>();

      for (const pm of s.modules) {
        const moduleType = moduleById.get(pm.moduleTypeId);
        if (!moduleType) {
          throw new Error(`Unbekannter Modultyp '${pm.moduleTypeId}' in String ${s.id}.`);
        }
        const plane = planeById.get(pm.planeId);
        if (!plane) {
          throw new Error(`Unbekannte Dachfläche '${pm.planeId}' in String ${s.id}.`);
        }
        vocColdSumV += vocColdV(moduleType, params);
        vmpHotSumV += vmpHotV(moduleType, params);
        vmpStcSumV += moduleType.vmpV;
        impA = Math.max(impA, moduleType.impA);
        iscA = Math.max(iscA, moduleType.iscA);
        minMaxSystemVoltageV = Math.min(minMaxSystemVoltageV, moduleType.maxSystemVoltageV);
        pmaxSumW += moduleType.pmaxW;
        typeIds.add(moduleType.id);
        orientations.add(orientationKey(plane));
      }

      const moduleTypeIds = [...typeIds];
      const firstTypeId = moduleTypeIds[0];
      return {
        id: s.id,
        mpptIndex: mppt.mpptIndex,
        moduleCount: s.modules.length,
        uniformType:
          moduleTypeIds.length === 1 && firstTypeId ? (moduleById.get(firstTypeId) ?? null) : null,
        moduleTypeIds,
        vocColdSumV,
        vmpHotSumV,
        vmpStcSumV,
        impA,
        iscA,
        minMaxSystemVoltageV,
        pmaxSumW,
        orientationKeys: [...orientations],
      };
    });

    return { mpptIndex: mppt.mpptIndex, strings };
  });

  const allStrings = mppts.flatMap((m) => m.strings);
  const kwp = allStrings.reduce((sum, s) => sum + s.pmaxSumW, 0) / 1000;

  return { inverter, params, mppts, allStrings, kwp };
}
