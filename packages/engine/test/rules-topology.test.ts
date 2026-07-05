import { describe, expect, it } from 'vitest';
import { buildPlanCalc } from '../src/plan';
import { checkR10, checkR8, checkR9 } from '../src/rules/topology';
import { mkInput, mkString, mppt, plane, testInverter } from './helpers';

const JW = 'jw-hd96n-r2-460';
const MCE = 'aiko-a485-mce54db';

function calcOf(...args: Parameters<typeof mkInput>) {
  return buildPlanCalc(mkInput(...args));
}

describe('R8 — Gleiche Stringlänge pro MPPT', () => {
  it('PASS: 2 parallele Strings mit je 10 Modulen', () => {
    const res = checkR8(
      calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10), mkString('S2', MCE, 10))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R8', status: 'ok' })]);
  });

  it('FAIL: 10 vs. 9 Module am selben MPPT', () => {
    const res = checkR8(
      calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10), mkString('S2', MCE, 9))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R8', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('10 vs. 9');
  });

  it('PASS: unterschiedliche Längen auf VERSCHIEDENEN MPPTs sind erlaubt', () => {
    const res = checkR8(
      calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10)), mppt(2, mkString('S2', MCE, 9))]),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R8', status: 'ok' })]);
  });
});

describe('R9 — Eine Ausrichtung pro MPPT', () => {
  const ostWest = [plane('p-ost', 90, 35), plane('p-west', 270, 35)];
  const gemischt = {
    id: 'S1',
    modules: [
      ...Array.from({ length: 5 }, () => ({ moduleTypeId: MCE, planeId: 'p-ost' })),
      ...Array.from({ length: 5 }, () => ({ moduleTypeId: MCE, planeId: 'p-west' })),
    ],
  };

  it('PASS: alle Module einer Ausrichtung', () => {
    const res = checkR9(calcOf(testInverter(), [mppt(1, mkString('S1', MCE, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R9', status: 'ok' })]);
  });

  it('FAIL: Ost- und West-Module am selben MPPT (WR ohne Schatten-Management)', () => {
    const res = checkR9(
      calcOf(testInverter(), [{ mpptIndex: 1, strings: [gemischt] }], { planes: ostWest }),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R9', status: 'fail', mpptIndex: 1 })]);
    expect(res[0]!.message).toContain('90°/35°');
    expect(res[0]!.message).toContain('270°/35°');
  });

  it('AUSNAHME: WR mit Schatten-Management erlaubt den Mix (SPEC §7 R9)', () => {
    const res = checkR9(
      calcOf(testInverter({ hasShadeManagement: true }), [{ mpptIndex: 1, strings: [gemischt] }], {
        planes: ostWest,
      }),
    );
    expect(res).toEqual([expect.objectContaining({ rule: 'R9', status: 'ok' })]);
  });
});

describe('R10 — Kein Modul-Mix im String', () => {
  it('PASS: sortenreiner String', () => {
    const res = checkR10(calcOf(testInverter(), [mppt(1, mkString('S1', JW, 10))]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R10', status: 'ok' })]);
  });

  it('FAIL: Jolywood + Aiko im selben String', () => {
    const mix = {
      id: 'S1',
      modules: [
        ...Array.from({ length: 5 }, () => ({ moduleTypeId: JW, planeId: 'p1' })),
        ...Array.from({ length: 5 }, () => ({ moduleTypeId: MCE, planeId: 'p1' })),
      ],
    };
    const res = checkR10(calcOf(testInverter(), [{ mpptIndex: 1, strings: [mix] }]));
    expect(res).toEqual([expect.objectContaining({ rule: 'R10', status: 'fail', stringId: 'S1' })]);
    expect(res[0]!.message).toContain(JW);
    expect(res[0]!.message).toContain(MCE);
  });
});
