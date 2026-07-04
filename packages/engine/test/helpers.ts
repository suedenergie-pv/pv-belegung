import { MODULES } from '../src/catalog/modules';
import type {
  DesignParams,
  InverterType,
  MpptAssignment,
  PlaneOrientation,
  PlannedString,
  StringPlanInput,
} from '../src/types';

/**
 * Test-Fixtures. Der testInverter ist ein KONSTRUKT für Regel-Grenzfälle,
 * kein Katalogeintrag — echte WR-Werte kommen ausschließlich aus Datenblättern.
 */

export function plane(id: string, azimuthDeg = 180, pitchDeg = 35): PlaneOrientation {
  return { id, azimuthDeg, pitchDeg };
}

export function mkString(
  id: string,
  moduleTypeId: string,
  n: number,
  planeId = 'p1',
): PlannedString {
  return {
    id,
    modules: Array.from({ length: n }, () => ({ moduleTypeId, planeId })),
  };
}

export function mppt(mpptIndex: number, ...strings: PlannedString[]): MpptAssignment {
  return { mpptIndex, strings };
}

export function testInverter(over: Partial<InverterType> = {}): InverterType {
  return {
    id: 'test-wr',
    name: 'TEST-WR (Fixture, frei erfunden)',
    manufacturer: 'TEST',
    acPowerKw: 10,
    maxDcVoltageV: 1000,
    mpptCount: 2,
    mpptVoltageRange: [200, 950],
    startupVoltageV: 180,
    maxInputCurrentPerMpptA: [16, 16],
    maxShortCircuitCurrentPerMpptA: [19, 19],
    maxDcAcRatio: 1.35,
    stringsPerMppt: [2, 2],
    compatibleBatteries: [],
    hasShadeManagement: false,
    isDummy: true,
    ...over,
  };
}

export function mkInput(
  inverter: InverterType,
  mppts: MpptAssignment[],
  extra: { planes?: PlaneOrientation[]; params?: Partial<DesignParams> } = {},
): StringPlanInput {
  const input: StringPlanInput = {
    inverter,
    moduleTypes: MODULES,
    planes: extra.planes ?? [plane('p1')],
    mppts,
  };
  if (extra.params) {
    input.params = extra.params;
  }
  return input;
}
