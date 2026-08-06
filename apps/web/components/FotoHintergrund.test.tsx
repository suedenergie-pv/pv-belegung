// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { neueFlaeche, type Flaeche } from '../lib/model';
import { FotoHintergrund } from './FotoHintergrund';

function matchMedia(coarse: boolean) {
  return vi.fn().mockReturnValue({
    matches: coarse,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Foto-Markierung auf Tablet und PC', () => {
  const flaeche: Flaeche = {
    ...neueFlaeche(1, 'A'),
    breiteM: 10,
    hoeheM: 6,
    foto: {
      dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      breitePx: 1000,
      hoehePx: 600,
      traufePx: null,
      eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]],
    },
    markierungFertig: false,
  };

  it('zeigt die separate Fadenkreuzbedienung nur bei grobem Zeiger', async () => {
    vi.stubGlobal('matchMedia', matchMedia(true));
    const { findByRole } = render(<FotoHintergrund flaeche={flaeche} onPatch={vi.fn()} fotoVerwalten={false} />);
    expect(await findByRole('button', { name: 'Fadenkreuz bedienen' })).toBeTruthy();
  });

  it('verändert auf dem PC weder Oberfläche noch bestehende Mausbedienung', async () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    const { findByRole, queryByRole } = render(<FotoHintergrund flaeche={flaeche} onPatch={vi.fn()} fotoVerwalten={false} />);
    await waitFor(() => expect(queryByRole('button', { name: 'Fadenkreuz bedienen' })).toBeNull());
    expect((await findByRole('toolbar', { name: 'Werkzeuge für die Foto-Markierung' })).className).toContain('sticky');
  });

  it('setzt per simuliertem Klick nach einem Swipe ein Hindernis in Meterkoordinaten', async () => {
    vi.stubGlobal('matchMedia', matchMedia(true));
    const onPatch = vi.fn();
    const { container, findByRole, getByRole } = render(
      <FotoHintergrund flaeche={flaeche} onPatch={onPatch} fotoVerwalten={false} />,
    );
    fireEvent.click(await findByRole('button', { name: 'Fadenkreuz bedienen' }));
    fireEvent.click(getByRole('button', { name: 'Punkt setzen' }));
    const svg = container.querySelector('svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 300, width: 500, height: 300,
      toJSON: () => ({}),
    });
    const pointer = (art: string, x: number, y: number) => {
      const event = new MouseEvent(art, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        pointerType: { value: 'touch' },
      });
      fireEvent(svg, event);
    };
    pointer('pointerdown', 100, 100);
    pointer('pointermove', 200, 200);
    pointer('pointerup', 200, 200);
    fireEvent.click(getByRole('button', { name: 'Punkt setzen' }));
    const patch = onPatch.mock.calls[0]![0];
    expect(patch.hindernisse).toHaveLength(1);
    expect(patch.hindernisse![0]!.xM).toBeCloseTo(5);
    expect(patch.hindernisse![0]!.yM).toBeCloseTo(3);
    expect(patch.hindernisse![0]!.breiteM).toBeCloseTo(2);
    expect(patch.hindernisse![0]!.hoeheM).toBeCloseTo(2);
  });

  it('behält beim Neuausrichten einer Zusatzperspektive die gemeinsame Geometrie', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    const onPatch = vi.fn();
    const { getByRole } = render(
      <FotoHintergrund
        flaeche={{ ...flaeche, markierungFertig: true, umrissM: [[0, 0], [10, 0], [10, 6], [0, 6]] }}
        onPatch={onPatch}
        fotoVerwalten={false}
        geometrieBehalten
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Ausrichtung neu (First + 4 Ecken)' }));
    expect('umrissM' in onPatch.mock.calls[0]![0]).toBe(false);
  });
});
