// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuesProjekt, type Projekt } from '../lib/model';
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
});
