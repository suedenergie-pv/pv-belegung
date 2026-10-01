// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { neuerEintrag } from '../lib/model';
import { speichereProjekte } from '../lib/speicher';
import Home from './page';

beforeEach(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: new IDBFactory() });
  const daten = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => daten.get(key) ?? null,
      setItem: (key: string, value: string) => daten.set(key, value),
      removeItem: (key: string) => daten.delete(key),
      clear: () => daten.clear(),
    },
  });
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('React', React);
  vi.stubGlobal('confirm', vi.fn(() => true));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Projektverwaltung und Einstieg', () => {
  it('schützt einen Maßentwurf auch beim direkten Wechsel zum Verschiebewerkzeug', async () => {
    const ui = render(<Home />);
    await ui.findByRole('button', { name: '+ Neu' });
    fireEvent.click(ui.getByRole('button', { name: '2. Dach & Belegung' }));
    fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '12' } });
    fireEvent.click(ui.getByRole('button', { name: 'Foto verschieben' }));
    expect(ui.getByRole('dialog')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben' }));
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('12');
    expect(ui.getByRole('button', { name: 'Foto verschieben' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(ui.getByRole('button', { name: 'Foto verschieben' }));
    fireEvent.click(ui.getByRole('button', { name: 'Übernehmen' }));
    expect(ui.getByRole('button', { name: 'Foto verschieben' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('12');
    expect(ui.getByRole('button', { name: '↶ Rückgängig (1)' })).toBeTruthy();
  });

  it('löst Maßentwürfe vor Navigation mit Bleiben, Verwerfen oder Übernehmen auf', async () => {
    const ui = render(<Home />);
    await ui.findByRole('button', { name: '+ Neu' });
    fireEvent.click(ui.getByRole('button', { name: '2. Dach & Belegung' }));
    if (ui.getByRole('button', { name: 'Dachdetails' }).getAttribute('aria-expanded') !== 'true') fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '12' } });
    fireEvent.click(ui.getByRole('button', { name: '3. Export' }));
    expect(ui.getByRole('dialog')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben' }));
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('12');
    fireEvent.click(ui.getByRole('button', { name: '3. Export' }));
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen' }));
    expect(ui.getByRole('heading', { name: 'Zusammenfassung' })).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: '2. Dach & Belegung' }));
    if (ui.getByRole('button', { name: 'Dachdetails' }).getAttribute('aria-expanded') !== 'true') fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('10');
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '14' } });
    fireEvent.click(ui.getByRole('button', { name: '3. Export' }));
    fireEvent.click(ui.getByRole('button', { name: 'Übernehmen' }));
    fireEvent.click(ui.getByRole('button', { name: '2. Dach & Belegung' }));
    if (ui.getByRole('button', { name: 'Dachdetails' }).getAttribute('aria-expanded') !== 'true') fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('14');
    expect(ui.getByRole('button', { name: '↶ Rückgängig (1)' })).toBeTruthy();
  });

  it('lässt ungültige Maßentwürfe beim Navigieren im Editor und speichert keine alten Ersatzwerte', async () => {
    const ui = render(<Home />);
    await ui.findByRole('button', { name: '+ Neu' });
    fireEvent.click(ui.getByRole('button', { name: '2. Dach & Belegung' }));
    if (ui.getByRole('button', { name: 'Dachdetails' }).getAttribute('aria-expanded') !== 'true') fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: '3. Export' }));
    fireEvent.click(ui.getByRole('button', { name: 'Übernehmen' }));
    expect(ui.queryByRole('heading', { name: 'Zusammenfassung' })).toBeNull();
    expect(ui.getByRole('alert').textContent).toMatch(/korrigieren/);
    expect((ui.getByRole('button', { name: /↶ Rückgängig/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('behält Belegungs-Undo und Redo nach Export und erneutem Öffnen des Editors', async () => {
    const eintrag = neuerEintrag();
    eintrag.schritt = 1;
    eintrag.projekt.fotos = [{ id: 'foto', name: 'Dach', dataUrl: 'data:image/jpeg;base64,eA==', breitePx: 1000, hoehePx: 600 }];
    eintrag.projekt.flaechen[0] = {
      ...eintrag.projekt.flaechen[0]!, massStatus: 'bestaetigt', grunddatenFertig: true,
      fotoZuordnungen: [{ fotoId: 'foto', traufePx: null, eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]], perspektiveBestaetigt: true, markierungFertig: true }],
    };
    expect((await speichereProjekte({ aktivId: eintrag.id, projekte: [eintrag], workflowVersion: 2 })).status).toBe('erfolg');
    const { getByRole, getAllByRole, findAllByRole } = render(<Home />);
    const automatisch = await findAllByRole('button', { name: 'Automatisch belegen' });
    fireEvent.click(automatisch.at(-1)!);
    expect(getByRole('button', { name: '↶ Rückgängig (1)' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: '3. Export' }));
    fireEvent.click(getByRole('button', { name: '↶ Rückgängig (1)' }));
    fireEvent.click(getByRole('button', { name: '2. Dach & Belegung' }));
    expect(getByRole('button', { name: '+ Belegungsbereich zeichnen' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: '↷ Wiederherstellen' }));
    fireEvent.click(getByRole('button', { name: 'Mehr' }));
    expect(getAllByRole('button', { name: 'Automatisch belegen' })).toHaveLength(1);
    expect(getByRole('button', { name: 'Alle auswählen' })).toBeTruthy();
  });

  it('gruppiert fertige Eingaben und erhält Undo/Redo über Schritt- und Projektwechsel', async () => {
    const { getByLabelText, getByRole, findByRole } = render(<Home />);
    await findByRole('button', { name: '+ Neu' });
    const auswahl = getByLabelText('Aktuelles Projekt') as HTMLSelectElement;
    const erstesId = auswahl.value;
    const kunde = getByLabelText('Kunde');
    fireEvent.focus(kunde);
    fireEvent.change(kunde, { target: { value: 'F' } });
    fireEvent.change(kunde, { target: { value: 'Familie Eins' } });
    fireEvent.blur(kunde);
    expect(getByRole('button', { name: '↶ Rückgängig (1)' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: '3. Export' }));
    fireEvent.click(getByRole('button', { name: /↶ Rückgängig/ }));
    fireEvent.click(getByRole('button', { name: '1. Projekt' }));
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('');
    fireEvent.click(getByRole('button', { name: '↷ Wiederherstellen' }));
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('Familie Eins');

    fireEvent.click(getByRole('button', { name: '+ Neu' }));
    const zweitesId = auswahl.value;
    fireEvent.change(getByLabelText('Kunde'), { target: { value: 'Familie Zwei' } });
    fireEvent.change(auswahl, { target: { value: erstesId } });
    fireEvent.click(getByRole('button', { name: /↶ Rückgängig/ }));
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('');
    fireEvent.change(auswahl, { target: { value: zweitesId } });
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('Familie Zwei');
    fireEvent.click(getByRole('button', { name: /↶ Rückgängig/ }));
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('');
  });

  it('zeigt bei beschädigter Speicherung die Reparaturansicht statt eines leeren Projekts', async () => {
    window.localStorage.setItem('pv-belegung-projekte-v2', '{kaputt');
    const { findByRole, getByRole } = render(<Home />);
    expect(await findByRole('heading', { name: 'Gespeicherter Stand muss repariert werden' })).toBeTruthy();
    expect(getByRole('button', { name: 'Rohdaten sichern' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Bewusst leeren Stand anlegen' }));
    expect(await findByRole('heading', { name: 'Projekt' })).toBeTruthy();
  });

  it('legt einen sicheren Erststand an, übernimmt Projektdaten und durchläuft alle drei Schritte', async () => {
    const { getByLabelText, getByRole, getByTestId, findByRole, queryByRole, getByText } = render(<Home />);
    await findByRole('button', { name: '+ Neu' });
    expect((getByLabelText('Aktuelles Projekt') as HTMLSelectElement).value).toMatch(/^prj-/);

    fireEvent.change(getByLabelText('Kunde'), { target: { value: 'Familie Audit' } });
    fireEvent.change(getByLabelText('Adresse'), { target: { value: 'Testweg 1' } });
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('Familie Audit');
    expect((getByLabelText('Adresse') as HTMLInputElement).value).toBe('Testweg 1');
    expect((getByRole('button', { name: 'Weiter →' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(getByRole('button', { name: 'Weiter →' }));
    expect((await findByRole('button', { name: '2. Dach & Belegung' })).getAttribute('aria-current')).toBe('step');
    expect(getByRole('toolbar', { name: 'Werkzeuge für Dachfläche 1' })).toBeTruthy();
    expect(getByTestId('arbeitsbereich-p1').className).not.toContain('lg:grid-cols');
    expect(getByText('Foto für Dachfläche 1 hinzufügen')).toBeTruthy();
    expect(queryByRole('button', { name: 'Hochkant' })).toBeNull();
    expect(queryByRole('button', { name: 'Automatisch belegen' })).toBeNull();
    fireEvent.click(getByRole('button', { name: '3. Export' }));
    expect((await findByRole('button', { name: '3. Export' })).getAttribute('aria-current')).toBe('step');
    expect(getByRole('heading', { name: 'Zusammenfassung' })).toBeTruthy();
  });

  it('dupliziert und löscht Projekte ohne jemals den letzten aktiven Stand zu verlieren', async () => {
    const { getByRole, getAllByRole, findByRole, getByText } = render(<Home />);
    await findByRole('button', { name: '+ Neu' });
    fireEvent.click(getByText('Projektaktionen ···'));
    fireEvent.click(getByRole('button', { name: 'Projekt duplizieren' }));
    await waitFor(() => expect(getAllByRole('option')).toHaveLength(2));
    fireEvent.click(getByRole('button', { name: 'Projekt löschen' }));
    await waitFor(() => expect(getAllByRole('option')).toHaveLength(1));
    expect(getByRole('button', { name: 'Rückgängig' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(getAllByRole('option')).toHaveLength(2));
    fireEvent.click(getByRole('button', { name: 'Projekt löschen' }));
    fireEvent.click(getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(getAllByRole('option')).toHaveLength(1));
    expect((getByRole('combobox', { name: 'Aktuelles Projekt' }) as HTMLSelectElement).value).not.toBe('');
  });
});
