// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  neuesProjekt,
  vollFeldFuer,
  modulById,
  neueGaubenFlaeche,
  type Projekt,
} from '../lib/model';
import { satteldachSeitenEcken } from '../lib/gauben-geometrie';
import type { Ecken } from '../lib/foto-geometrie';
import { SchrittBelegung } from './SchrittBelegung';

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
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

  const projektMitSatteldachgaube = (): Projekt => {
    const basis = projektMitFoto();
    const eltern = basis.flaechen[0]!;
    const aussen: Ecken = [[200, 520], [600, 520], [600, 220], [200, 220]];
    const first: [Ecken[0], Ecken[0]] = [[400, 190], [400, 540]];
    const seiten = satteldachSeitenEcken(aussen, first, {
      ...eltern,
      foto: {
        ...basis.fotos[0]!,
        traufePx: null,
        eckenPx: eltern.fotoZuordnungen![0]!.eckenPx,
      },
    })!;
    const modul = modulById(basis.modulId);
    const baue = (nr: number, seite: 'links' | 'rechts', eckenPx: Ecken) => {
      const grund = neueGaubenFlaeche(nr, seite === 'links' ? 'B' : 'C', 'satteldach', eltern.id, seite, 'gaube-1');
      return {
        ...grund,
        breiteM: 3,
        hoeheM: 2.4,
        felder: [vollFeldFuer(grund, modul)],
        inaktiv: seite === 'links' ? ['0-0'] : [],
        fotoZuordnungen: [{
          fotoId: 'foto-1',
          traufePx: null,
          eckenPx,
          perspektiveBestaetigt: true,
          markierungFertig: true,
        }],
      };
    };
    const links = baue(2, 'links', seiten.links);
    const rechts = baue(3, 'rechts', seiten.rechts);
    return {
      ...basis,
      flaechen: [{
        ...eltern,
        gaubenAussparungen: [{
          gaubenGruppeId: 'gaube-1',
          rechteck: { xM: 2, yM: 0.8, breiteM: 4, hoeheM: 3 },
          fotoEckenPx: aussen,
        }],
      }, links, rechts],
      mppts: [[{ id: 'S1', flaecheId: links.id, anzahl: 1 }]],
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

  it('bearbeitet beide Satteldachseiten über dieselben sechs Punkte und speichert nur einmal', async () => {
    const start = projektMitSatteldachgaube();
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole, getAllByRole, findByRole } = render(<TestApp />);
    fireEvent.click(getByRole('button', { name: 'Perspektive von Gaube 1, zweite Dachseite bearbeiten' }));
    const editor = await findByRole('img', { name: 'Gaube im Dachfoto markieren' });
    expect(getAllByRole('button', { name: /Gaubenpunkt/ })).toHaveLength(6);
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600,
      toJSON: () => ({}),
    });
    const ersterGriff = getByRole('button', { name: 'Gaubenpunkt 1' });
    const pointer = (art: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(art, { bubbles: true, clientX, clientY });
      Object.defineProperty(event, 'pointerId', { value: 11 });
      fireEvent(ersterGriff, event);
    };
    const modulPfadVorher = editor.querySelector('clipPath polygon')?.getAttribute('points');
    pointer('pointerdown', 200, 520);
    pointer('pointermove', 800, 100);
    pointer('pointerup', 800, 100);
    expect((getByRole('button', { name: 'Markierung übernehmen' }) as HTMLButtonElement).disabled).toBe(true);
    expect(editor.querySelector('clipPath polygon')?.getAttribute('points')).toBe(modulPfadVorher);
    pointer('pointerdown', 800, 100);
    pointer('pointermove', 200, 520);
    pointer('pointerup', 200, 520);
    expect((getByRole('button', { name: 'Markierung übernehmen' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(editor, { key: 'ArrowRight' });
    expect(letzterStand.flaechen[0]!.gaubenAussparungen![0]!.fotoEckenPx![0]).toEqual([200, 520]);
    fireEvent.click(getByRole('button', { name: 'Markierung übernehmen' }));
    await waitFor(() => expect(letzterStand.flaechen[0]!.gaubenAussparungen![0]!.fotoEckenPx![0]).toEqual([201, 520]));
    expect(letzterStand.flaechen[1]!.felder).toEqual(start.flaechen[1]!.felder);
    expect(letzterStand.flaechen[1]!.inaktiv).toEqual(['0-0']);
    expect(letzterStand.flaechen[1]!.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
    expect(letzterStand.flaechen[2]!.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
  });

  it('löscht von der zweiten Karte die ganze Gaubengruppe und stellt sie per Rückgängig wieder her', async () => {
    const start = projektMitSatteldachgaube();
    let letzterStand = start;
    const bestaetigen = vi.spyOn(window, 'confirm').mockReturnValue(false);
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole } = render(<TestApp />);
    const loeschen = getByRole('button', { name: 'Gaube 1, zweite Dachseite löschen' });
    fireEvent.click(loeschen);
    expect(letzterStand.flaechen).toHaveLength(3);
    expect(bestaetigen.mock.calls[0]![0]).toContain('Beide Dachseiten');

    bestaetigen.mockReturnValue(true);
    fireEvent.click(loeschen);
    await waitFor(() => expect(letzterStand.flaechen).toHaveLength(1));
    expect(letzterStand.flaechen[0]!.gaubenAussparungen).toEqual([]);
    expect(letzterStand.mppts).toEqual([[]]);
    expect(letzterStand.fotos).toEqual(start.fotos);

    fireEvent.click(getByRole('button', { name: /Rückgängig/ }));
    await waitFor(() => expect(letzterStand.flaechen).toHaveLength(3));
    expect(letzterStand.flaechen[0]!.gaubenAussparungen).toEqual(start.flaechen[0]!.gaubenAussparungen);
    expect(letzterStand.mppts).toEqual(start.mppts);
  });
});
