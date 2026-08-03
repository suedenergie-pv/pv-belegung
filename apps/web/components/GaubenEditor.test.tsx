// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ecken } from '../lib/foto-geometrie';
import { neueFlaeche, neueGaubenFlaeche } from '../lib/model';
import { GaubenEditor } from './GaubenEditor';

beforeEach(() => {
  vi.stubGlobal('React', React);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('Gauben-Serienworkflow', () => {
  it('übernimmt Typ und Maße einer Gaube direkt für die nächste Markierung', () => {
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
    fireEvent.click(getByRole('button', { name: 'Anlegen & nächste gleiche markieren' }));

    expect(onErstellen).toHaveBeenCalledTimes(1);
    expect(getByText(/Gaubenumriss: 4 Ecke/)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Belegung bearbeiten' }));
    expect(container.querySelector<HTMLDetailsElement>('details[data-gauben-gruppe="gaube-1"]')?.open).toBe(true);
  });
});
