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
      perspektiveBestaetigt: true,
    },
    markierungFertig: false,
  };

  it('zeigt die separate Fadenkreuzbedienung nur bei grobem Zeiger', async () => {
    vi.stubGlobal('matchMedia', matchMedia(true));
    const { findByRole } = render(<FotoHintergrund flaeche={flaeche} onPatch={vi.fn()} fotoVerwalten={false} />);
    expect(await findByRole('button', { name: 'Fadenkreuz bedienen' })).toBeTruthy();
  });

  it('verwendet auf dem PC keinen konkurrierenden Sticky-Layer', async () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    const { findByRole, queryByRole } = render(<FotoHintergrund flaeche={flaeche} onPatch={vi.fn()} fotoVerwalten={false} />);
    await waitFor(() => expect(queryByRole('button', { name: 'Fadenkreuz bedienen' })).toBeNull());
    expect((await findByRole('toolbar', { name: 'Werkzeuge für die Foto-Markierung' })).className).not.toContain('sticky');
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

  it('ändert bei „Markierung ändern“ weder Perspektive noch gemeinsame Geometrie', () => {
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

    fireEvent.click(getByRole('button', { name: '✎ Markierung ändern' }));
    expect('umrissM' in onPatch.mock.calls[0]![0]).toBe(false);
    expect('foto' in onPatch.mock.calls[0]![0]).toBe(false);
  });

  it('speichert den vierten Eckpunkt erst nach ausdrücklichem Übernehmen', async () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    const onPatch = vi.fn();
    const ohneEcken: Flaeche = {
      ...flaeche,
      foto: {
        dataUrl: flaeche.foto!.dataUrl,
        breitePx: 1000,
        hoehePx: 600,
        traufePx: null,
        perspektiveBestaetigt: false,
      },
    };
    const { container, getByRole, findByRole } = render(
      <FotoHintergrund flaeche={ohneEcken} onPatch={onPatch} fotoVerwalten={false} />,
    );
    fireEvent.click(getByRole('button', { name: /Überspringen/ }));
    const svg = container.querySelector('svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600,
      toJSON: () => ({}),
    });
    for (const [x, y] of [[0, 600], [1000, 600], [1000, 0], [0, 0]]) {
      fireEvent.click(svg, { clientX: x, clientY: y });
    }
    expect(onPatch).not.toHaveBeenCalled();
    fireEvent.click(await findByRole('button', { name: '4 Ecken übernehmen' }));
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch.mock.calls[0]![0].foto.perspektiveBestaetigt).toBe(true);
  });

  it('lädt einen vorhandenen Dachumriss in verschiebbare Griffe und speichert erst beim Übernehmen', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    const onPatch = vi.fn();
    const mitUmriss: Flaeche = {
      ...flaeche,
      umrissM: [[0, 0], [10, 0], [10, 6], [0, 6]],
    };
    const { container, getAllByTestId, getByRole } = render(
      <FotoHintergrund flaeche={mitUmriss} onPatch={onPatch} fotoVerwalten={false} />,
    );

    fireEvent.click(getByRole('button', { name: /Dachumriss/ }));
    const griffe = getAllByTestId('umriss-griff');
    expect(griffe).toHaveLength(4);
    expect(onPatch).not.toHaveBeenCalled();

    const svg = container.querySelector('svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600,
      toJSON: () => ({}),
    });
    const ersterKreis = griffe[0]!.querySelector('circle')!;
    const startX = Number(ersterKreis.getAttribute('cx'));
    const startY = Number(ersterKreis.getAttribute('cy'));
    const zielX = startX < 500 ? startX + 100 : startX - 100;
    const zielY = startY < 300 ? startY + 100 : startY - 100;
    fireEvent.mouseDown(svg, { clientX: startX, clientY: startY });
    fireEvent.mouseMove(svg, { clientX: zielX, clientY: zielY });
    fireEvent.mouseUp(svg);
    expect(onPatch).not.toHaveBeenCalled();

    fireEvent.click(getByRole('button', { name: /Umriss übernehmen/ }));
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch.mock.calls[0]![0].umrissM[0][0]).toBeCloseTo(1);
    expect(onPatch.mock.calls[0]![0].umrissM[0][1]).toBeCloseTo(1);
  });

  it('entfernt nur den manuellen Umriss und erklärt den verbleibenden Perspektivrahmen', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    const onPatch = vi.fn();
    const mitUmriss: Flaeche = {
      ...flaeche,
      umrissM: [[0, 0], [10, 0], [10, 6], [0, 6]],
    };
    const { getByRole, getByText, queryByRole, rerender } = render(
      <FotoHintergrund flaeche={mitUmriss} onPatch={onPatch} fotoVerwalten={false} />,
    );
    fireEvent.click(getByRole('button', { name: /Dachumriss/ }));
    fireEvent.click(getByRole('button', { name: 'Manuellen Umriss entfernen' }));
    expect(onPatch).toHaveBeenCalledWith({ umrissM: undefined, inaktiv: [] });

    rerender(<FotoHintergrund flaeche={{ ...mitUmriss, umrissM: undefined }} onPatch={onPatch} fotoVerwalten={false} />);
    expect(getByRole('button', { name: /Perspektivrahmen bearbeiten/ })).toBeTruthy();
    expect(queryByRole('button', { name: 'Manuellen Umriss entfernen' })).toBeNull();
    expect(getByText(/Kein manueller Dachumriss vorhanden/)).toBeTruthy();
  });
});
