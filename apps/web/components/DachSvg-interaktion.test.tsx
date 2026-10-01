// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DachSvg } from './DachSvg';
import { neueFlaeche, modulById, rasterFuer, type Flaeche } from '../lib/model';
import type { Ecken } from '../lib/foto-geometrie';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const modul = modulById('jw-hd96n-r2-460');
function flaeche(): Flaeche {
  return { ...neueFlaeche(1, 'A'), breiteM: 10, hoeheM: 6, massStatus: 'bestaetigt', felder: [],
    foto: { dataUrl: 'data:image/png;base64,AA==', breitePx: 1000, hoehePx: 600, traufePx: null, eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]] } };
}
function box(svg: Element) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
}
function pointer(ziel: Element, art: string, x: number, y: number) {
  const e = new MouseEvent(art, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: 1 }); fireEvent(ziel, e);
}

it('adressiert einen Feldgriff ausdrücklich statt die Fotopixel als Meter-Toleranz zu deuten', () => {
  const f = flaeche(); const griff = vi.fn(); const down = vi.fn();
  const ui = render(<DachSvg flaeche={f} raster={rasterFuer(f, modul)} modul={modul}
    felderAnzeige={[{ rect: { xM: 1, yM: 1, breiteM: 4, hoeheM: 3 }, ausgewaehlt: true }]}
    pointer={{ onDownM: down, onGriffDownM: griff, onMoveM: vi.fn(), onUpM: vi.fn() }} />);
  box(ui.container.querySelector('svg')!);
  pointer(ui.container.querySelector('[data-feld-griff="e"]')!, 'pointerdown', 500, 350);
  expect(griff).toHaveBeenCalledTimes(1);
  expect(griff.mock.calls[0]!.slice(0, 2)).toEqual([0, 'e']);
  expect(griff.mock.calls[0]![2][0]).toBeCloseTo(5);
  expect(griff.mock.calls[0]![2][1]).toBeCloseTo(3.5);
  expect(down).not.toHaveBeenCalled();
});

it('verwirft nur die laufende Perspektivgeste bei einem zweiten Finger und erhält frühere Entwurfsänderungen', () => {
  const f = flaeche();
  const start = [[30, 580], [1000, 600], [1000, 0], [0, 0]] as Ecken;
  function Test({ revision }: { revision: number }) {
    const [ecken, setEcken] = useState(start);
    return <><output data-testid="punkte">{JSON.stringify(ecken)}</output><DachSvg flaeche={f} raster={rasterFuer(f, modul)} modul={modul} cancelRevision={revision}
      perspektivEditor={{ ecken, ausgewaehlt: 0, pruefung: { status: 'ok', meldungen: [], massstabVerhaeltnis: 1 }, onAendern: setEcken, onAuswaehlen: vi.fn(), onAbbrechen: vi.fn() }} /></>;
  }
  const ui = render(<Test revision={0} />); box(ui.container.querySelector('svg')!);
  const griff = ui.getByRole('button', { name: 'Perspektive Ecke 1' });
  pointer(griff, 'pointerdown', 40, 570); pointer(griff, 'pointermove', 80, 530);
  expect(JSON.parse(ui.getByTestId('punkte').textContent!)[0]).toEqual([80, 530]);
  ui.rerender(<Test revision={1} />);
  expect(JSON.parse(ui.getByTestId('punkte').textContent!)).toEqual(start);
  pointer(griff, 'pointermove', 100, 510); pointer(griff, 'pointerup', 100, 510);
  expect(JSON.parse(ui.getByTestId('punkte').textContent!)).toEqual(start);
});
