// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuesProjekt, vollFeldFuer, modulById, type Flaeche } from '../lib/model';
import { FlaechenInlineEditor } from './FlaechenInlineEditor';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function editor(bestand = false) {
  const projekt = neuesProjekt();
  const f = projekt.flaechen[0]!;
  if (bestand) {
    f.massStatus = 'bestand'; f.grunddatenFertig = true;
    f.felder = [{ ...vollFeldFuer(f, modulById(projekt.modulId)), leer: ['0-0'] }];
    f.fotoZuordnungen = [{ fotoId: 'bild', traufePx: null, perspektiveBestaetigt: true, markierungFertig: true, eckenPx: [[0,600],[1000,600],[1000,0],[0,0]] }];
  }
  const patch = vi.fn<(f: Partial<Flaeche>) => void>();
  const result = render(<FlaechenInlineEditor projekt={projekt} flaeche={f} index={0} onPatch={patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} />);
  if (bestand) fireEvent.click(result.getByRole('button', { name: 'Maße & Dachform' }));
  return { ...result, patch, f, projekt };
}
describe('Sichere Maßentwürfe', () => {
  it('überschreibt beim Übernehmen keine inzwischen geänderten Fotozuordnungen und Felder', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '12' } });
    const frisch = { ...ui.f, fotoZuordnungen: [{ fotoId: 'ersatz', traufePx: null, perspektiveBestaetigt: false }], felder: [{ ...ui.f.felder![0]!, xM: 2 }] };
    ui.rerender(<FlaechenInlineEditor projekt={{ ...ui.projekt, flaechen: [frisch] }} flaeche={frisch} index={0} onPatch={ui.patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} />);
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    const neu = ui.patch.mock.calls[0]![0];
    expect(neu.fotoZuordnungen).toBe(frisch.fotoZuordnungen);
    expect(neu.felder![0]!.xM).toBeCloseTo(2.4);
  });

  it('öffnet Foto-Maßvorschläge ausschließlich als prüfbaren Entwurf', () => {
    const ui = editor(true);
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    ui.rerender(<FlaechenInlineEditor projekt={ui.projekt} flaeche={ui.f} index={0} onPatch={ui.patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} massVorschlag={{ breiteM: 9, hoeheM: 5 }} />);
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('9');
    expect(ui.patch).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledWith(expect.objectContaining({ breiteM: 9, hoeheM: 5, massStatus: 'bestaetigt' }));
  });
  it('bestätigt gültige voreingestellte Werte nur nach Übernehmen', () => {
    const ui = editor();
    expect(ui.patch).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledWith(expect.objectContaining({ massStatus: 'bestaetigt', breiteM: 10, hoeheM: 6 }));
  });
  it('hält den bestehenden Plan bei Änderung und Abbrechen vollständig unverändert', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '12' } });
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.getByText(/Vorschau:/).textContent).toMatch(/Module/);
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.f.breiteM).toBe(10);
    expect(ui.f.felder![0]!.leer).toEqual(['0-0']);
  });
  it('übernimmt skalierte Geometrie und Bestätigung in genau einer Änderung', () => {
    const ui = editor(true);
    const breite = ui.f.felder![0]!.breiteM;
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '12' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledTimes(1);
    const neu = ui.patch.mock.calls[0]![0];
    expect(neu.massStatus).toBe('bestaetigt');
    expect(neu.felder![0]!.breiteM).toBeCloseTo(breite * 1.2);
    expect(neu.felder![0]!.leer).toEqual(['0-0']);
  });
  it('verhindert Übernahme leerer Eingaben statt alte Zahlen unbemerkt zu bestätigen', () => {
    const ui = editor();
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.getByRole('alert').textContent).toMatch(/korrigieren/);
  });
  it('zeigt Formwechsel samt Neukalibrierung als Vorschau und verwirft ihn sicher', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText('Dachform'), { target: { value: 'trapez' } });
    expect(ui.getByText(/Dachecken neu bestätigt/)).toBeTruthy();
    expect(ui.getByText(/Vorschau:/).textContent).toMatch(/→ 0 Module/);
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.f.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
  });
  it('meldet dem gemeinsamen Fotoeditor die reale Vorschau und räumt sie beim Abbrechen auf', () => {
    const projekt = neuesProjekt();
    const f = { ...projekt.flaechen[0]!, massStatus: 'bestaetigt' as const, grunddatenFertig: true };
    const onVorschau = vi.fn();
    const onSchliessen = vi.fn();
    const onPatch = vi.fn();
    const ui = render(<FlaechenInlineEditor projekt={projekt} flaeche={f} index={0} onPatch={onPatch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} kompakt initialOffen onVorschau={onVorschau} onSchliessen={onSchliessen} />);
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '12' } });
    expect(onVorschau).toHaveBeenLastCalledWith(expect.objectContaining({ breiteM: 12 }));
    expect(onPatch).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(onVorschau).toHaveBeenLastCalledWith(null);
    expect(onSchliessen).toHaveBeenCalledOnce();
    expect(onPatch).not.toHaveBeenCalled();
  });
});
