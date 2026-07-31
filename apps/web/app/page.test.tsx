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
  it('legt einen sicheren Erststand an, übernimmt Projektdaten und durchläuft alle drei Schritte', async () => {
    const { getByLabelText, getByRole, findByRole } = render(<Home />);
    await findByRole('button', { name: '+ Neu' });
    expect((getByLabelText('Projekt') as HTMLSelectElement).value).toMatch(/^prj-/);

    fireEvent.change(getByLabelText('Kunde'), { target: { value: 'Familie Audit' } });
    fireEvent.change(getByLabelText('Adresse'), { target: { value: 'Testweg 1' } });
    expect((getByLabelText('Kunde') as HTMLInputElement).value).toBe('Familie Audit');
    expect((getByLabelText('Adresse') as HTMLInputElement).value).toBe('Testweg 1');
    expect((getByRole('button', { name: 'Weiter →' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(getByRole('button', { name: 'Weiter →' }));
    expect((await findByRole('button', { name: '2. Dach & Belegung' })).getAttribute('aria-current')).toBe('step');
    fireEvent.click(getByRole('button', { name: 'Automatisch füllen' }));
    expect(await findByRole('button', { name: 'Leeren' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Quer' }));
    expect(getByRole('button', { name: 'Quer' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(getByRole('button', { name: 'Weiter →' }));
    expect((await findByRole('button', { name: '3. Export' })).getAttribute('aria-current')).toBe('step');
    expect(getByRole('heading', { name: 'Zusammenfassung' })).toBeTruthy();
  });

  it('dupliziert und löscht Projekte ohne jemals den letzten aktiven Stand zu verlieren', async () => {
    const { getByRole, findByRole, getByText } = render(<Home />);
    await findByRole('button', { name: 'Duplizieren' });
    fireEvent.click(getByRole('button', { name: 'Duplizieren' }));
    expect(getByText('2 Projekte')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Löschen' }));
    expect(getByText('1 Projekt')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(getByText('1 Projekt')).toBeTruthy());
    expect((getByRole('combobox', { name: 'Projekt' }) as HTMLSelectElement).value).not.toBe('');
  });
});
