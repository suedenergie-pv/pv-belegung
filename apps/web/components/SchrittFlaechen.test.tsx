// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ecken } from '../lib/foto-geometrie';
import { neuesProjekt, vollFeldFuer, modulById } from '../lib/model';
import { SchrittFlaechen } from './SchrittFlaechen';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Kompakte Flächengrunddaten', () => {
  it('zeigt alle häufigen Angaben zusammen und Sondermaße nur bei Bedarf', () => {
    const projekt = neuesProjekt();
    const onChange = vi.fn();
    const { getByLabelText, queryByText, rerender } = render(
      <SchrittFlaechen
        projekt={projekt}
        onChange={onChange}
        nurFlaecheId="p1"
        eingebettet
        onFertig={vi.fn()}
      />,
    );

    expect(getByLabelText('Art der Fläche')).toBeTruthy();
    expect(getByLabelText('Dachform')).toBeTruthy();
    expect(getByLabelText('Ausrichtung')).toBeTruthy();
    expect(getByLabelText(/^Azimut/)).toBeTruthy();
    expect(getByLabelText(/^Neigung/)).toBeTruthy();
    expect(queryByText('Firstbreite oben')).toBeNull();

    fireEvent.change(getByLabelText('Dachform'), { target: { value: 'trapez' } });
    const geaendert = onChange.mock.calls.at(-1)?.[0];
    rerender(
      <SchrittFlaechen
        projekt={geaendert}
        onChange={onChange}
        nurFlaecheId="p1"
        eingebettet
        onFertig={vi.fn()}
      />,
    );
    expect(getByLabelText(/^Firstbreite oben/)).toBeTruthy();
  });

  it('nennt beim Formwechsel die Folgen und setzt Geometrie kontrolliert zurück', () => {
    const basis = neuesProjekt();
    const flaeche = basis.flaechen[0]!;
    const projekt = {
      ...basis,
      flaechen: [{
        ...flaeche,
        felder: [{ ...vollFeldFuer(flaeche, modulById(basis.modulId)), leer: ['0-0'] }],
        umrissM: [[0, 0], [10, 0], [10, 6], [0, 6]] as [number, number][],
        fotoZuordnungen: [{
          fotoId: 'foto-1',
          traufePx: null,
          eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]] as Ecken,
          perspektiveBestaetigt: true,
          markierungFertig: true,
        }],
      }],
    };
    const bestaetigen = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <SchrittFlaechen projekt={projekt} onChange={onChange} nurFlaecheId="p1" eingebettet />,
    );

    fireEvent.change(getByLabelText('Dachform'), { target: { value: 'trapez' } });

    expect(bestaetigen.mock.calls[0]![0]).toMatch(/Belegungsbereich/);
    expect(bestaetigen.mock.calls[0]![0]).toMatch(/Fotoperspektive/);
    const neu = onChange.mock.calls[0]![0].flaechen[0];
    expect(neu.felder).toEqual([]);
    expect(neu.inaktiv).toEqual([]);
    expect(neu.umrissM).toBeUndefined();
    expect(neu.fotoZuordnungen[0].perspektiveBestaetigt).toBe(false);
    expect(neu.fotoZuordnungen[0].markierungFertig).toBe(false);
  });

  it('schreibt leere oder negative Maße nicht ins Projektmodell', () => {
    const onChange = vi.fn();
    const { getByLabelText, getByText } = render(
      <SchrittFlaechen projekt={neuesProjekt()} onChange={onChange} nurFlaecheId="p1" eingebettet />,
    );
    const traufe = getByLabelText(/^Traufe/);
    fireEvent.change(traufe, { target: { value: '' } });
    expect(getByText('Traufe ist erforderlich.')).toBeTruthy();
    fireEvent.change(traufe, { target: { value: '-2' } });
    expect(getByText('Traufe muss mindestens 1 sein.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
