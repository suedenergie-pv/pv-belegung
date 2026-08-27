// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuesProjekt, vollFeldFuer, modulById, type Projekt } from '../lib/model';
import { SchrittBelegung } from './SchrittBelegung';

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Belegungsbedienung', () => {
  const projektMitFoto = (): Projekt => {
    const basis = neuesProjekt();
    const flaeche = basis.flaechen[0]!;
    const modul = modulById(basis.modulId);
    return {
      ...basis,
      fotos: [{
        id: 'foto-1',
        name: 'Testfoto',
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 1000,
        hoehePx: 600,
      }],
      flaechen: [{
        ...flaeche,
        grunddatenFertig: true,
        felder: [vollFeldFuer(flaeche, modul)],
        fotoZuordnungen: [{
          fotoId: 'foto-1',
          traufePx: null,
          eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]],
          perspektiveBestaetigt: true,
          markierungFertig: true,
        }],
      }],
    };
  };

  it('zeigt beide Aktionen im Leerzustand und nimmt die automatische Belegung zurück', async () => {
    const basis = neuesProjekt();
    const start: Projekt = {
      ...basis,
      fotos: [{
        id: 'foto-1',
        name: 'Testfoto',
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 1000,
        hoehePx: 600,
      }],
      flaechen: [{
        ...basis.flaechen[0]!,
        grunddatenFertig: true,
        felder: [],
        fotoZuordnungen: [{
          fotoId: 'foto-1',
          traufePx: null,
          eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]],
          perspektiveBestaetigt: true,
          markierungFertig: true,
        }],
      }],
    };
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole, getAllByRole } = render(<TestApp />);
    expect(getByRole('button', { name: '+ Belegungsbereich zeichnen' })).toBeTruthy();
    const automatisch = getAllByRole('button', { name: 'Automatisch belegen' });
    fireEvent.click(automatisch.at(-1)!);
    await waitFor(() => expect(letzterStand.flaechen[0]!.felder?.length).toBe(1));
    fireEvent.click(getByRole('button', { name: /Rückgängig/ }));
    await waitFor(() => expect(letzterStand.flaechen[0]!.felder).toEqual([]));
  });

  it('ändert die Hauptdach-Perspektive erst beim Speichern und nimmt sie vollständig zurück', async () => {
    const start = projektMitFoto();
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole, getAllByRole, getByTestId } = render(<TestApp />);
    fireEvent.click(getByRole('button', { name: 'Perspektive bearbeiten' }));

    const svg = getAllByRole('img', { name: /Perspektive von Dachfläche 1 bearbeiten/ })[0]!;
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(getByTestId('perspektiv-griffe').querySelector('polygon')?.getAttribute('points')).toContain('1,600');
    expect(letzterStand.flaechen[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([0, 600]);

    fireEvent.click(getByRole('button', { name: 'Abbrechen' }));
    expect(letzterStand.flaechen[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([0, 600]);

    fireEvent.click(getByRole('button', { name: 'Perspektive bearbeiten' }));
    fireEvent.keyDown(getAllByRole('img', { name: /Perspektive von Dachfläche 1 bearbeiten/ })[0]!, { key: 'ArrowRight' });
    fireEvent.click(getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(letzterStand.flaechen[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([1, 600]));

    fireEvent.click(getByRole('button', { name: /Rückgängig/ }));
    await waitFor(() => expect(letzterStand.flaechen[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([0, 600]));
  });
});
