// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ecken } from '../lib/foto-geometrie';
import { neuesProjekt, vollFeldFuer, modulById, type Flaeche } from '../lib/model';
import { SchrittFlaechen } from './SchrittFlaechen';
import { DachSkizze } from './DachSkizze';

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
    expect(queryByText('Dachform')).toBeNull();
    expect(getByLabelText('Ausrichtung')).toBeTruthy();
    expect(getByLabelText(/^Richtung in Grad/)).toBeTruthy();
    expect(getByLabelText(/^Dachneigung/)).toBeTruthy();
    expect(queryByText('Firstbreite oben')).toBeNull();

    fireEvent.change(getByLabelText(/^Breite oben/), { target: { value: '6' } });
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
    expect(getByLabelText(/^Breite oben/)).toBeTruthy();
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

    fireEvent.change(getByLabelText(/^Breite oben/), { target: { value: '6' } });

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
    const traufe = getByLabelText(/^Breite unten/);
    fireEvent.change(traufe, { target: { value: '-1' } });
    fireEvent.change(traufe, { target: { value: '' } });
    expect(getByText('Breite unten (Traufe) ist erforderlich.')).toBeTruthy();
    fireEvent.change(traufe, { target: { value: '-2' } });
    expect(getByText('Breite unten (Traufe) muss mindestens 1 sein.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});


describe('Verlässliche Dachskizzen', () => {
  for (const [versatz, start, ende] of [[-2,28,132.4],[0,62.8,167.2],[2,97.6,202]] as const) {
    it(`zeigt die obere Kante mit ${versatz} m Mittelpunktversatz an der richtigen Position`, () => {
      const f = {...neuesProjekt().flaechen[0]!, dachform:'schief' as const,firstBreiteM:6,firstVersatzM:versatz};
      const ui = render(<DachSkizze flaeche={f} />);
      const d = ui.container.querySelector('[data-kante="oben"]')!.getAttribute('d')!;
      const werte = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const erwartet = [start,27,ende];
      werte.forEach((wert,i) => expect(wert).toBeCloseTo(erwartet[i]!));
    });
  }

  it('zeichnet bei markiertem Dachrand alle Ecken und benennt nur die tatsächlichen Bezugsmaße', () => {
    const f: Flaeche = {...neuesProjekt().flaechen[0]!,fotoBezugsrahmen:true,umrissM:[[0,6],[10,6],[10,2],[6,0],[0,3]]};
    const ui = render(<DachSkizze flaeche={f} />);
    expect(ui.container.querySelector('[data-dachumriss]')!.getAttribute('d')!.match(/L/g)).toHaveLength(4);
    expect(ui.getByText('Gesamtbreite')).toBeTruthy();
    expect(ui.getByText('Tiefe')).toBeTruthy();
    expect(ui.queryByText('Breite oben')).toBeNull();
  });
});


it('ändert bei fünf unabhängigen Dachseiten ausschließlich die ausgewählte Teilfläche', () => {
  const basis = neuesProjekt();
  const projekt = {...basis, flaechen: Array.from({length:5}, (_,i) => ({
    ...basis.flaechen[0]!,id:`p${i+1}`,name:`Dachseite ${i+1}`,dachform:'trapez' as const,
    breiteM:20+i,firstBreiteM:12+i,azimutDeg:i*60,
  }))};
  const onChange = vi.fn();
  const ui = render(<SchrittFlaechen projekt={projekt} onChange={onChange} nurFlaecheId="p3" eingebettet entwurfsModus />);
  fireEvent.click(ui.getByRole('button', {name:'Rechts gerade'}));
  const neu = onChange.mock.calls[0]![0];
  expect(neu.flaechen[2]).toMatchObject({id:'p3',name:'Dachseite 3',breiteM:22,firstBreiteM:14,firstVersatzM:4,azimutDeg:120});
  for (const index of [0,1,3,4]) expect(neu.flaechen[index]).toBe(projekt.flaechen[index]);
});
