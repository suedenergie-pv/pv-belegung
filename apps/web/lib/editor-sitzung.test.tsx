// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorSitzungProvider, leereEditorSitzung, useEditorSitzung } from './editor-sitzung';
import { SPEICHER_SCHLUESSEL } from './speicher';

const key = (id: string) => `${SPEICHER_SCHLUESSEL.aktuell}:editor-auswahl-v1:${encodeURIComponent(id)}`;
function Probe() {
  const [sitzung, patch] = useEditorSitzung();
  return <>
    <output data-testid="sitzung">{JSON.stringify(sitzung)}</output>
    <button onClick={() => patch({ aktiveFlaecheId: 'dach-5', ansichtJeFlaeche: { 'dach-5': 'foto-2' } })}>Fünftes Dach</button>
    <button onClick={() => patch({ aktiveFlaecheId: 'dach-2' })}>Zweites Dach</button>
    <button onClick={() => patch({ panel: 'details', modus: { art: 'feld_neu', flaecheId: 'dach-5' },
      auswahl: { flaecheId: 'dach-5', indices: [1] }, mehrfachauswahl: true, verschieben: true,
      ansichten: { 'dach-5': { zoom: 2, x: 10, y: 20 } } })}>Bearbeitung beginnen</button>
  </>;
}
const view = (id: string) => <EditorSitzungProvider projektId={id}><Probe /></EditorSitzungProvider>;
const stand = (ui: ReturnType<typeof render>) => JSON.parse(ui.getByTestId('sitzung').textContent!);
beforeEach(() => { vi.stubGlobal('React', React); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Dachauswahl nach erneutem Öffnen', () => {
  it('öffnet nach Reload dieselbe Dachfläche und Fotoansicht ohne einen alten Bearbeitungsmodus', () => {
    const ui = render(view('kundenprojekt'));
    fireEvent.click(ui.getByRole('button', { name: 'Fünftes Dach' }));
    fireEvent.click(ui.getByRole('button', { name: 'Bearbeitung beginnen' }));
    expect(JSON.parse(window.sessionStorage.getItem(key('kundenprojekt'))!)).toEqual({
      aktiveFlaecheId: 'dach-5', ansichtJeFlaeche: { 'dach-5': 'foto-2' },
    });
    ui.unmount();
    const neu = render(view('kundenprojekt'));
    expect(stand(neu)).toEqual({ ...leereEditorSitzung(), aktiveFlaecheId: 'dach-5', ansichtJeFlaeche: { 'dach-5': 'foto-2' } });
  });

  it('hält die Auswahl verschiedener Projekte auch beim Wechsel und erneuten Mount getrennt', () => {
    const ui = render(view('A'));
    fireEvent.click(ui.getByRole('button', { name: 'Fünftes Dach' }));
    ui.rerender(view('B'));
    expect(stand(ui)).toEqual(leereEditorSitzung());
    fireEvent.click(ui.getByRole('button', { name: 'Zweites Dach' }));
    ui.rerender(view('A'));
    expect(stand(ui).aktiveFlaecheId).toBe('dach-5');
    ui.unmount();
    const neu = render(view('B'));
    expect(stand(neu).aktiveFlaecheId).toBe('dach-2');
    expect(stand(neu).ansichtJeFlaeche).toEqual({});
  });

  it('liest die Auswahl nur im bestehenden Marken-/Kontonamensraum', () => {
    window.sessionStorage.setItem(`fremdes-konto:editor-auswahl-v1:A`, JSON.stringify({ aktiveFlaecheId: 'fremdes-dach' }));
    const ui = render(view('A'));
    expect(stand(ui).aktiveFlaecheId).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: 'Fünftes Dach' }));
    expect(window.sessionStorage.getItem(key('A'))).toContain('dach-5');
    expect(window.sessionStorage.getItem('fremdes-konto:editor-auswahl-v1:A')).toContain('fremdes-dach');
  });

  it.each(['{kaputt', 'null', '[]', '"text"'])('verträgt beschädigte gespeicherte Daten: %s', (roh) => {
    window.sessionStorage.setItem(key('A'), roh);
    const ui = render(view('A'));
    expect(stand(ui)).toEqual(leereEditorSitzung());
    fireEvent.click(ui.getByRole('button', { name: 'Fünftes Dach' }));
    expect(stand(ui).aktiveFlaecheId).toBe('dach-5');
  });

  it('filtert ungültige IDs und ignoriert eingeschleuste Werkzeugzustände', () => {
    window.sessionStorage.setItem(key('A'), JSON.stringify({ aktiveFlaecheId: 42,
      ansichtJeFlaeche: { dach1: 'foto1', dach2: {}, dach3: 7, dach4: '' }, panel: 'gauben', verschieben: true }));
    const ui = render(view('A'));
    expect(stand(ui)).toEqual({ ...leereEditorSitzung(), ansichtJeFlaeche: { dach1: 'foto1' } });
  });

  it('bleibt bedienbar, wenn der Browser den Sitzungsspeicher sperrt', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Gesperrt', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Voll', 'QuotaExceededError'); });
    const ui = render(view('A'));
    fireEvent.click(ui.getByRole('button', { name: 'Fünftes Dach' }));
    expect(stand(ui).aktiveFlaecheId).toBe('dach-5');
  });

  it('liest vor dem Client-Mount keinen Browserspeicher', () => {
    const lesen = vi.spyOn(Storage.prototype, 'getItem');
    renderToString(view('A'));
    expect(lesen).not.toHaveBeenCalled();
  });
});
