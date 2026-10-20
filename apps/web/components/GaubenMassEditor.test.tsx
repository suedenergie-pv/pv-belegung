// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntwurfNavigationProvider, useEntwurfNavigation } from '../lib/entwurf-navigation';
import { modulById, neueGaubenFlaeche, neuesProjekt, vollFeldFuer, type GaubenMessung } from '../lib/model';
import { EditorAktionsRahmen, EditorAktionsZiel } from './EditorAktionen';
import { GaubenMassEditor } from './GaubenMassEditor';

beforeEach(() => {
  vi.stubGlobal('React', React);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function editor(messung: GaubenMessung | undefined = { quelle: 'nachbardach', qualitaet: 'geschaetzt' }, portal = false) {
  const modul = modulById(neuesProjekt().modulId);
  const flaeche = { ...neueGaubenFlaeche(2, 'B', 'satteldach', 'hauptdach', 'links', 'gaube-1'), breiteM: 3, hoeheM: 2.5, gaubenMessung: messung };
  flaeche.felder = [{ ...vollFeldFuer(flaeche, modul), leer: ['0-0'] }];
  const vorher = structuredClone(flaeche);
  const speichern = vi.fn(); const abbrechen = vi.fn(); const weiter = vi.fn();
  function Test() {
    const nav = useEntwurfNavigation();
    const formular = <GaubenMassEditor flaeche={flaeche} modul={modul} onSpeichern={speichern} onAbbrechen={abbrechen} />;
    return <><button onClick={() => nav.weiter(weiter)}>Andere Dachseite</button>{portal ? <EditorAktionsRahmen><main>{formular}</main><footer><EditorAktionsZiel /></footer></EditorAktionsRahmen> : formular}</>;
  }
  return { ...render(<EntwurfNavigationProvider><Test /></EntwurfNavigationProvider>), flaeche, vorher, speichern, abbrechen, weiter };
}

describe('Gaubenmaße als geschützter Entwurf', () => {
  it('zeigt das Formular offen und bestätigt im festen Aktionsziel ausschließlich die ausgewählte Seite', () => {
    const ui = editor(undefined, true);
    expect(ui.container.querySelector('details')).toBeNull();
    const speichern = ui.getByRole('button', { name: 'Maße übernehmen' });
    expect(speichern.closest('footer')).not.toBeNull();
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4.2' } });
    expect(ui.speichern).not.toHaveBeenCalled();
    expect(ui.getByText(/Vorschau:.*Module auf dieser Gaubenseite/)).toBeTruthy();
    expect(ui.flaeche).toEqual(ui.vorher);
    fireEvent.click(speichern);
    expect(ui.speichern).toHaveBeenCalledExactlyOnceWith(4.2, 2.5, { quelle: 'nachbardach', qualitaet: 'geschaetzt' });
    expect(ui.flaeche).toEqual(ui.vorher);
  });

  it.each(['', '0', '-1', 'NaN'])('sperrt ungültige Eingabe %s ohne alte Zahlen oder eine NaN-Vorschau zu übernehmen', (wert) => {
    const ui = editor();
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: wert } });
    const knopf = ui.getByRole('button', { name: 'Maße übernehmen' }) as HTMLButtonElement;
    expect(knopf.disabled).toBe(true);
    expect(ui.getByText('Vorschau nach Eingabe gültiger Maße.')).toBeTruthy();
    fireEvent.click(knopf);
    expect(ui.speichern).not.toHaveBeenCalled();
    expect(ui.flaeche).toEqual(ui.vorher);
  });

  it('fokussiert fehlerhafte Maße bei Navigation-Übernehmen und bleibt auf der Seite', () => {
    const ui = editor();
    const breite = ui.getByLabelText(/^Breite/);
    fireEvent.change(breite, { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: 'Andere Dachseite' }));
    expect(ui.getByRole('dialog')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: /^Übernehmen$/ }));
    expect(ui.speichern).not.toHaveBeenCalled();
    expect(ui.weiter).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(breite);
  });

  it('schützt schon die Änderung der Quelle und verwirft Werte vor dem Seitenwechsel', () => {
    const ui = editor();
    fireEvent.click(ui.getByRole('button', { name: 'Ziegel zählen' }));
    fireEvent.change(ui.getByLabelText(/^Deckbreite/), { target: { value: '35' } });
    fireEvent.click(ui.getByRole('button', { name: 'Andere Dachseite' }));
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben' }));
    expect(ui.weiter).not.toHaveBeenCalled();
    expect((ui.getByLabelText(/^Deckbreite/) as HTMLInputElement).value).toBe('35');
    fireEvent.click(ui.getByRole('button', { name: 'Andere Dachseite' }));
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen' }));
    expect(ui.weiter).toHaveBeenCalledOnce();
    expect(ui.speichern).not.toHaveBeenCalled();
    expect((ui.getByLabelText(/^Breite/) as HTMLInputElement).value).toBe('3');
    fireEvent.click(ui.getByRole('button', { name: 'Andere Dachseite' }));
    expect(ui.weiter).toHaveBeenCalledTimes(2);
  });

  it('meldet vor explizitem Abbrechen den Entwurf ab und verändert keine bestehende Belegung', () => {
    const ui = editor();
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4' } });
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(ui.abbrechen).toHaveBeenCalledOnce();
    expect(ui.speichern).not.toHaveBeenCalled();
    expect(ui.flaeche).toEqual(ui.vorher);
    fireEvent.click(ui.getByRole('button', { name: 'Andere Dachseite' }));
    expect(ui.weiter).toHaveBeenCalledOnce();
    expect(ui.queryByRole('dialog')).toBeNull();
  });

  it('übernimmt eine bewusst als Aufmaß benannte Messung mit ihrer Herkunft', () => {
    const ui = editor();
    fireEvent.click(ui.getByRole('button', { name: 'Aufmaß' }));
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '3.25' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.speichern).toHaveBeenCalledExactlyOnceWith(3.25, 2.5, { quelle: 'aufmass', qualitaet: 'bestaetigt' });
  });

  it('berechnet Ziegelmaße nur aus gültigen Zählwerten und erhält sie nachvollziehbar', () => {
    const ui = editor();
    fireEvent.click(ui.getByRole('button', { name: 'Ziegel zählen' }));
    fireEvent.change(ui.getByLabelText(/^Reihenabstand/), { target: { value: '' } });
    expect((ui.getByRole('button', { name: 'Maße übernehmen' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(ui.getByLabelText(/^Reihenabstand/), { target: { value: '32' } });
    fireEvent.change(ui.getByLabelText(/^Ziegel quer/), { target: { value: '12' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.speichern).toHaveBeenCalledExactlyOnceWith(3.6, 2.56, { quelle: 'ziegel', qualitaet: 'gemessen', ziegelQuer: 12, deckbreiteCm: 30, ziegelReihen: 8, reihenabstandCm: 32 });
  });

  it('stuft eine vorhandene unsichere Messung nicht ohne bewusste Quellenbestätigung hoch', () => {
    const ui = editor({ quelle: 'aufmass', qualitaet: 'geschaetzt' });
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '3.5' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.speichern).toHaveBeenCalledExactlyOnceWith(3.5, 2.5, { quelle: 'aufmass', qualitaet: 'geschaetzt' });
  });

  it('übernimmt einen gültigen Entwurf auch über den geschützten Seitenwechsel genau einmal', () => {
    const ui = editor();
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '3.8' } });
    fireEvent.click(ui.getByRole('button', { name: 'Andere Dachseite' }));
    fireEvent.click(ui.getByRole('button', { name: /^Übernehmen$/ }));
    expect(ui.speichern).toHaveBeenCalledExactlyOnceWith(3.8, 2.5, { quelle: 'nachbardach', qualitaet: 'geschaetzt' });
    expect(ui.weiter).toHaveBeenCalledOnce();
  });
});
