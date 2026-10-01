// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorViewport } from './EditorViewport';
import { EditorSitzungProvider, useEditorSitzung, STANDARD_ANSICHT } from '../lib/editor-sitzung';

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function pointer(ziel: Element, art: string, id: number, x: number, y: number) {
  const e = new MouseEvent(art, { bubbles: true, clientX: x, clientY: y, cancelable: true });
  Object.defineProperties(e, { pointerId: { value: id }, pointerType: { value: 'touch' } });
  fireEvent(ziel, e);
}

describe('EditorViewport Eingabetrennung', () => {
  it('bewegt das Fadenkreuz relativ bei Zoom und bestätigt ausschließlich über die getrennte Leiste', () => {
    const modell = vi.fn(), bestaetigung = vi.fn();
    function Test() {
      const [ansicht, setAnsicht] = useState({ zoom: 2, x: 0, y: 0 });
      const [punkt, setPunkt] = useState<[number, number]>([500, 250]);
      return <EditorViewport ansicht={ansicht} onAnsichtChange={setAnsicht} bildSeitenverhaeltnis={2}
        punktSteuerung={{ aktiv: true, aktivieren: () => {}, punkt, onBewegen: setPunkt, breitePx: 1000, hoehePx: 500, aktion: 'Punkt setzen', onBestaetigen: () => bestaetigung(punkt) }}>
        <svg data-testid="bild" data-punkt={punkt.join(',')} onPointerDown={modell} onClick={modell} />
      </EditorViewport>;
    }
    const ui = render(<Test />), bild = ui.getByTestId('bild'), knopf = ui.getByRole('button', { name: 'Punkt setzen' }) as HTMLButtonElement;
    pointer(bild, 'pointerdown', 1, 100, 100);
    expect(knopf.disabled).toBe(true);
    pointer(bild, 'pointermove', 1, 300, 200);
    pointer(bild, 'pointerup', 1, 300, 200);
    fireEvent.click(bild);
    expect(bild.getAttribute('data-punkt')).toBe('600,300');
    expect(modell).not.toHaveBeenCalled(); expect(bestaetigung).not.toHaveBeenCalled();
    fireEvent.click(knopf);
    expect(bestaetigung).toHaveBeenCalledExactlyOnceWith([600, 300]);
    pointer(bild, 'pointerdown', 1, 300, 200);
    pointer(bild, 'pointerdown', 2, 700, 200);
    pointer(bild, 'pointermove', 2, 900, 200);
    pointer(bild, 'pointerup', 2, 900, 200);
    pointer(bild, 'pointermove', 1, 400, 300);
    pointer(bild, 'pointerup', 1, 400, 300);
    fireEvent.click(bild);
    expect(bestaetigung).toHaveBeenCalledTimes(1);
    expect(bild.getAttribute('data-punkt')).toBe('600,300');
    expect(ui.getByTestId('editor-bild-transform').style.transform).toContain('scale(3)');
    pointer(bild, 'pointerdown', 3, 300, 200); pointer(bild, 'pointercancel', 3, 300, 200);
    expect(knopf.disabled).toBe(false);
    pointer(knopf, 'pointerdown', 4, 10, 10); pointer(knopf, 'pointerup', 4, 10, 10);
    fireEvent.click(knopf, { detail: 1 });
    expect(bestaetigung).toHaveBeenCalledTimes(2);
    pointer(knopf, 'pointerdown', 5, 10, 10); pointer(knopf, 'pointermove', 5, 10, 40); pointer(knopf, 'pointerup', 5, 10, 40);
    expect(bestaetigung).toHaveBeenCalledTimes(2);
  });
  it('bricht die Werkzeugbewegung beim zweiten Finger ab und fängt auch den Restfinger ab', () => {
    const modellDown = vi.fn(); const modellUp = vi.fn(); const modellKlick = vi.fn(); const abbruch = vi.fn(); const ansicht = vi.fn();
    const ui = render(<EditorViewport bildSeitenverhaeltnis={2} onAnsichtChange={ansicht} onGesteAbbrechen={abbruch}>
      <svg data-testid="bild" onPointerDown={modellDown} onPointerUp={modellUp} onClick={modellKlick} />
    </EditorViewport>);
    const bild = ui.getByTestId('bild');
    pointer(bild, 'pointerdown', 1, 200, 200); pointer(bild, 'pointermove', 1, 250, 200);
    pointer(bild, 'pointerdown', 2, 600, 200); pointer(bild, 'pointermove', 2, 800, 200);
    pointer(bild, 'pointerup', 2, 800, 200); pointer(bild, 'pointermove', 1, 300, 200); pointer(bild, 'pointerup', 1, 300, 200);
    fireEvent.click(bild);
    expect(modellDown).toHaveBeenCalledTimes(1); expect(abbruch).toHaveBeenCalledTimes(1);
    expect(modellUp).not.toHaveBeenCalled(); expect(modellKlick).not.toHaveBeenCalled();
    expect(ansicht).toHaveBeenCalled(); expect(ansicht.mock.calls[0]![0].zoom).toBeGreaterThan(1);
  });
  it('lässt Einzelgesten durch und verändert mit Zoomknöpfen nur die Ansicht', () => {
    const up = vi.fn();
    function Test() { const [ansicht, set] = useState(STANDARD_ANSICHT); return <EditorViewport bildSeitenverhaeltnis={2} ansicht={ansicht} onAnsichtChange={set}><svg data-testid="bild" onPointerUp={up} /></EditorViewport>; }
    const ui = render(<Test />); const bild = ui.getByTestId('bild');
    pointer(bild, 'pointerdown', 1, 200, 200); pointer(bild, 'pointerup', 1, 250, 200);
    expect(up).toHaveBeenCalledTimes(1);
    fireEvent.click(ui.getByRole('button', { name: 'Vergrößern' }));
    expect(ui.getByTestId('editor-bild-transform').style.transform).toContain('scale(1.25)');
    fireEvent.click(ui.getByRole('button', { name: 'Alles anzeigen' }));
    expect(ui.getByTestId('editor-bild-transform').style.transform).toContain('scale(1)');
    expect(up).toHaveBeenCalledTimes(1);
  });
  it('blockiert das aktive Werkzeug im Verschiebemodus', () => {
    const down = vi.fn(); const up = vi.fn(); const ansicht = vi.fn();
    const ui = render(<EditorViewport verschieben bildSeitenverhaeltnis={2} onAnsichtChange={ansicht}><svg data-testid="bild" onPointerDown={down} onPointerUp={up} /></EditorViewport>);
    const bild = ui.getByTestId('bild');
    pointer(bild, 'pointerdown', 1, 200, 200); pointer(bild, 'pointermove', 1, 300, 250); pointer(bild, 'pointerup', 1, 300, 250);
    expect(down).not.toHaveBeenCalled(); expect(up).not.toHaveBeenCalled();
    expect(ansicht.mock.calls[0]![0].zoom).toBe(1);
    expect(ansicht.mock.calls[0]![0].x).toBeCloseTo(.1);
    expect(ansicht.mock.calls[0]![0].y).toBeCloseTo(.1);
  });
});

it('behält die Ansicht je Projekt auch nach Aus- und Einbau des Editors', () => {
  function Editor() { const [s, patch] = useEditorSitzung(); return <button onClick={() => patch({ aktiveFlaecheId: 'nord', ansichten: { foto: { zoom: 2, x: .1, y: 0 } } })}>{s.aktiveFlaecheId ?? 'leer'}:{s.ansichten.foto?.zoom ?? 1}</button>; }
  const ui = render(<EditorSitzungProvider projektId="a"><Editor /></EditorSitzungProvider>);
  fireEvent.click(ui.getByRole('button')); expect(ui.getByText('nord:2')).toBeTruthy();
  ui.rerender(<EditorSitzungProvider projektId="b"><Editor /></EditorSitzungProvider>); expect(ui.getByText('leer:1')).toBeTruthy();
  ui.rerender(<EditorSitzungProvider projektId="a"><span>Export</span></EditorSitzungProvider>);
  ui.rerender(<EditorSitzungProvider projektId="a"><Editor /></EditorSitzungProvider>); expect(ui.getByText('nord:2')).toBeTruthy();
});
