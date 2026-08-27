// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './page';

beforeEach(() => {
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Projektverwaltung und Einstieg', () => {
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
    expect(getByText('Noch kein Drohnenbild zugeordnet')).toBeTruthy();
    expect(queryByRole('button', { name: 'Hochkant' })).toBeNull();
    expect(queryByRole('button', { name: 'Automatisch belegen' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Weiter →' }));
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
