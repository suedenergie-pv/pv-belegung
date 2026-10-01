// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ecken } from '../lib/foto-geometrie';
import { neueFlaeche, neueGaubenFlaeche, neuesProjekt } from '../lib/model';
import { GaubenEditor } from './GaubenEditor';
import { EntwurfNavigationProvider, useEntwurfNavigation } from '../lib/entwurf-navigation';

beforeEach(() => {
  vi.stubGlobal('React', React);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Gauben-Serienworkflow', () => {
  it('schützt auch offene und ungültige Gaubenmaße bei Navigation und bietet eine Modulvorschau', () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    const eltern = { ...neueFlaeche(1, 'A'), foto: { dataUrl: 'data:image/png;base64,AA==', breitePx: 1000, hoehePx: 700, traufePx: null, eckenPx: [[50, 650], [950, 650], [850, 50], [150, 50]] as Ecken } };
    const gaube = { ...neueGaubenFlaeche(2, 'B', 'flachdach', eltern.id, undefined, 'g1'), breiteM: 3, hoeheM: 2.5, gaubenMessung: { quelle: 'nachbardach' as const, qualitaet: 'geschaetzt' as const } };
    const speichern = vi.fn(); const weiter = vi.fn();
    function Test() { const nav = useEntwurfNavigation(); return <><button onClick={() => nav.weiter(weiter)}>Zum Export</button><GaubenEditor eltern={eltern} gauben={[gaube]} projekt={{ ...neuesProjekt(), flaechen: [eltern, gaube] }} onErstellen={vi.fn()} onLoeschen={vi.fn()} onMasseAendern={speichern} onMarkierungAendern={vi.fn()} /></>; }
    const ui = render(<EntwurfNavigationProvider><Test /></EntwurfNavigationProvider>);
    fireEvent.click(ui.getByText('Maß verbessern'));
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4' } });
    expect(ui.getByText(/Vorschau:.*Module auf dieser Gaubenseite/)).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    expect(ui.getByRole('dialog')).toBeTruthy(); expect(weiter).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben' }));
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    fireEvent.click(ui.getByRole('button', { name: /^Übernehmen$/ }));
    expect(speichern).not.toHaveBeenCalled(); expect(weiter).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: /^Abbrechen$/ }));
    expect((ui.getByLabelText(/^Breite/) as HTMLInputElement).value).toBe('3');
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4' } });
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen' }));
    expect(weiter).toHaveBeenCalledTimes(1); expect(speichern).not.toHaveBeenCalled();
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4' } });
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    fireEvent.click(ui.getByRole('button', { name: /^Übernehmen$/ }));
    expect(speichern).toHaveBeenCalledWith('g1', gaube.id, 4, 2.5, { quelle: 'nachbardach', qualitaet: 'geschaetzt' });
    expect(weiter).toHaveBeenCalledTimes(2);
  });
  it('übernimmt Typ und Maße einer Gaube direkt für die nächste Markierung', () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const eltern = {
      ...neueFlaeche(1, 'A'),
      foto: {
        dataUrl: 'data:image/png;base64,AA==',
        breitePx: 1000,
        hoehePx: 700,
        traufePx: null,
        eckenPx: [[50, 650], [950, 650], [850, 50], [150, 50]] as Ecken,
      },
    };
    const gaube = {
      ...neueGaubenFlaeche(2, 'B', 'flachdach', eltern.id, undefined, 'gaube-1'),
      breiteM: 2.4,
      hoeheM: 2.1,
      gaubenMessung: { quelle: 'aufmass' as const, qualitaet: 'bestaetigt' as const },
      fotoZuordnung: {
        fotoId: 'foto-1',
        traufePx: null,
        eckenPx: [[200, 500], [400, 500], [380, 300], [220, 300]] as Ecken,
      },
    };
    const onErstellen = vi.fn();
    const { container, getByRole, getByText, queryByText } = render(
      <>
        <GaubenEditor
          eltern={eltern}
          gauben={[gaube]}
          projekt={{ ...neuesProjekt(), flaechen: [eltern, gaube] }}
          onErstellen={onErstellen}
          onLoeschen={vi.fn()}
          onMasseAendern={vi.fn()}
          onMarkierungAendern={vi.fn()}
        />
        <details data-gauben-gruppe="gaube-1" />
      </>,
    );

    fireEvent.click(getByRole('button', { name: '+ Gleiche markieren' }));

    const foto = getByRole('img', { name: 'Gaube im Dachfoto markieren' });
    expect(foto).toBeTruthy();
    expect(queryByText('Wie kommen die Maße zustande?')).toBeNull();

    vi.spyOn(foto, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 700,
      width: 1000,
      height: 700,
      toJSON: () => ({}),
    });
    for (const [clientX, clientY] of [[200, 500], [400, 500], [380, 300], [220, 300]]) {
      fireEvent.click(foto, { clientX, clientY });
    }
    const ersterGriff = getByRole('button', { name: 'Gaubenpunkt 1' });
    const pointer = (art: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(art, { bubbles: true, clientX, clientY });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      fireEvent(ersterGriff, event);
    };
    pointer('pointerdown', 200, 500);
    pointer('pointermove', 190, 510);
    pointer('pointermove', 185, 515);
    pointer('pointermove', 180, 520);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    pointer('pointerup', 180, 520);
    fireEvent.click(getByRole('button', { name: 'Anlegen & nächste gleiche markieren' }));

    expect(onErstellen).toHaveBeenCalledTimes(1);
    expect(onErstellen.mock.calls[0]![0].aussen[0]).toEqual([180, 520]);
    expect(getByText(/Gaubenumriss: noch 4 Ecke/)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Belegung bearbeiten' }));
    expect(container.querySelector<HTMLDetailsElement>('details[data-gauben-gruppe="gaube-1"]')?.open).toBe(true);
  });

  it('setzt Markierungspunkte per Tastatur und bricht mit Escape ab', () => {
    const eltern = {
      ...neueFlaeche(1, 'A'),
      foto: {
        dataUrl: 'data:image/png;base64,AA==',
        breitePx: 1000,
        hoehePx: 700,
        traufePx: null,
        eckenPx: [[50, 650], [950, 650], [850, 50], [150, 50]] as Ecken,
      },
    };
    const { getByRole, getByText, queryByRole } = render(
      <GaubenEditor
        eltern={eltern}
        gauben={[]}
        projekt={{ ...neuesProjekt(), flaechen: [eltern] }}
        onErstellen={vi.fn()}
        onLoeschen={vi.fn()}
        onMasseAendern={vi.fn()}
        onMarkierungAendern={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: '+ Gaube' }));
    fireEvent.click(getByRole('button', { name: 'Im Foto markieren →' }));
    const foto = getByRole('img', { name: 'Gaube im Dachfoto markieren' });
    fireEvent.keyDown(foto, { key: 'ArrowRight' });
    fireEvent.keyDown(foto, { key: 'Enter' });
    expect(getByText(/Gaubenumriss: noch 3 Ecke/)).toBeTruthy();
    fireEvent.keyDown(foto, { key: 'Escape' });
    expect(queryByRole('img', { name: 'Gaube im Dachfoto markieren' })).toBeNull();
    expect(getByText('Wie kommen die Maße zustande?')).toBeTruthy();
  });
});
