// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchrittBelegung } from './SchrittBelegung';
import { neuesProjekt, type Projekt } from '../lib/model';
import { EntwurfNavigationProvider } from '../lib/entwurf-navigation';
const matrix = { a: 1, b: 0, inverse: () => matrix };
const screenCTM = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getScreenCTM');
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return { x: this.x, y: this.y }; } });
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => matrix });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if (screenCTM) Object.defineProperty(SVGElement.prototype, 'getScreenCTM', screenCTM); else delete (SVGElement.prototype as unknown as { getScreenCTM?: unknown }).getScreenCTM;
});
function setup() {
  const start = neuesProjekt(); const projekt: Projekt = { ...start, fotos: [{ id: 'bild', name: 'Dach', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', breitePx: 1000, hoehePx: 600 }],
    flaechen: [{ ...start.flaechen[0]!, massStatus: 'bestaetigt', massEingabeOffen: false, grunddatenFertig: true, felder: [], fotoZuordnungen: [{ fotoId: 'bild', traufePx: null, eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]], perspektiveBestaetigt: true, markierungFertig: true }] }] };
  const change = vi.fn(); const ui = render(<EntwurfNavigationProvider><SchrittBelegung projekt={projekt} onChange={change} /></EntwurfNavigationProvider>);
  fireEvent.click(ui.getByRole('button', { name: 'Dachmaße' })); fireEvent.click(ui.getByRole('button', { name: 'Dachrand nachzeichnen' }));
  return { ...ui, change };
}
describe('Bildfokus beim Dachzeichnen', () => {
  it('erhält Formular, native Punktaktionen und festen Abschluss beim Vergrößern und Zurückkehren', () => {
    const ui = setup(); const name = ui.getByLabelText('Name der Fläche'); fireEvent.change(name, { target: { value: 'Hauptdach West' } });
    fireEvent.click(ui.getByRole('button', { name: 'Bild vergrößern' }));
    expect(ui.getByRole('dialog', { name: /Dachrand nachzeichnen/ }).getAttribute('data-bildfokus')).toBe('true');
    const bild = ui.getByRole('img', { name: 'Dachrand und Ziegel im Foto markieren' });
    for (const [x, y] of [[100, 500], [900, 500], [500, 100]]) fireEvent.click(bild, { clientX: x, clientY: y });
    expect((ui.getByRole('button', { name: 'Dachrand fertig – weiter' }) as HTMLButtonElement).disabled).toBe(false);
    expect(ui.getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Eingaben anzeigen' }));
    expect((ui.getByLabelText('Name der Fläche') as HTMLInputElement).value).toBe('Hauptdach West');
    expect(ui.getAllByRole('button', { name: /Dachrand Ecke/ })).toHaveLength(3); expect(ui.change).not.toHaveBeenCalled();
  });
  it('zeigt beim nächsten Schritt die Eingaben wieder und lässt Escape nur den Bildfokus schließen', () => {
    const ui = setup(); fireEvent.click(ui.getByRole('button', { name: 'Bild vergrößern' }));
    const bild = ui.getByRole('img', { name: 'Dachrand und Ziegel im Foto markieren' });
    for (const [x, y] of [[100, 500], [900, 500], [500, 100]]) fireEvent.click(bild, { clientX: x, clientY: y });
    fireEvent.click(ui.getByRole('button', { name: 'Dachrand fertig – weiter' }));
    expect(ui.queryByRole('dialog', { name: /Ziegel als Maßstab/ })).toBeNull(); expect(ui.getByLabelText('Abstände quer')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Bild vergrößern' }));
    fireEvent.keyDown(ui.getByRole('dialog', { name: /Ziegel als Maßstab/ }), { key: 'Escape' });
    expect(ui.queryByRole('dialog', { name: /Ziegel als Maßstab/ })).toBeNull();
    expect(ui.getByLabelText('Abstände quer')).toBeTruthy(); expect(ui.queryByRole('heading', { name: 'Maßentwurf noch offen', hidden: true })).toBeNull(); expect(ui.change).not.toHaveBeenCalled();
  });
});
