// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  neuesProjekt,
  perspektiveQuelle,
  rahmenBreiteVon,
  rasterFuer,
  vollFeldFuer,
  modulById,
  neueGaubenFlaeche,
  type Projekt,
} from '../lib/model';
import { satteldachSeitenEcken } from '../lib/gauben-geometrie';
import { homographie, projiziere, type Ecken } from '../lib/foto-geometrie';
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

  const projektMitFreiraum = (
    felder: NonNullable<Projekt['flaechen'][number]['felder']> = [],
  ): Projekt => {
    const basis = neuesProjekt();
    return {
      ...basis,
      fotos: [{
        id: 'foto-1',
        name: 'Testfoto mit Rand',
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 1000,
        hoehePx: 600,
      }],
      flaechen: [{
        ...basis.flaechen[0]!,
        breiteM: 10,
        hoeheM: 6,
        dachform: 'rechteck',
        grunddatenFertig: true,
        felder,
        fotoZuordnungen: [{
          fotoId: 'foto-1',
          traufePx: null,
          // Das Dach belegt bewusst nur einen Teil des Fotos. Der freie Bildrand
          // muss für überstehende Belegungsfelder nutzbar bleiben.
          eckenPx: [[200, 500], [800, 500], [800, 100], [200, 100]],
          perspektiveBestaetigt: true,
          markierungFertig: true,
        }],
      }],
    };
  };

  const sendePointer = (
    ziel: Element,
    art: 'pointerdown' | 'pointermove' | 'pointerup',
    clientX: number,
    clientY: number,
  ) => {
    const event = new MouseEvent(art, { bubbles: true, clientX, clientY });
    Object.defineProperty(event, 'pointerId', { value: 17 });
    fireEvent(ziel, event);
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

  it('zieht neue Belegungsbereiche frei über den markierten Dachrahmen hinaus auf', async () => {
    const start = projektMitFreiraum();
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole } = render(<TestApp />);
    const svg = getByRole('img', { name: /^Belegungsfläche Dachfläche 1/ }) as unknown as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600,
      toJSON: () => ({}),
    });

    // Von links außerhalb der Dachmarkierung bis rechts außerhalb ziehen.
    sendePointer(svg, 'pointerdown', 100, 450);
    sendePointer(svg, 'pointermove', 900, 150);
    sendePointer(svg, 'pointerup', 900, 150);

    await waitFor(() => expect(letzterStand.flaechen[0]!.felder).toHaveLength(1));
    const feld = letzterStand.flaechen[0]!.felder![0]!;
    expect(feld.xM).toBeLessThan(0);
    expect(feld.breiteM).toBeGreaterThan(10);
  });

  it('zeichnet ein zweites Feld auch dann, wenn der Zug im ersten Feld beginnt', async () => {
    const start = projektMitFreiraum([
      { xM: 1, yM: 1, breiteM: 4, hoeheM: 4, quer: false },
    ]);
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole, findByText } = render(<TestApp />);
    const svg = getByRole('img', { name: /^Belegungsfläche Dachfläche 1/ }) as unknown as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600,
      toJSON: () => ({}),
    });
    const flaeche = start.flaechen[0]!;
    const h = homographie(
      rahmenBreiteVon(flaeche),
      flaeche.hoeheM,
      flaeche.fotoZuordnungen![0]!.eckenPx!,
      perspektiveQuelle(flaeche),
    )!;
    const fotoPunkt = (xM: number, yM: number) => projiziere(h, [xM, yM]);

    // Der Start liegt bewusst im ersten Feld (x 1–5 m). Ohne ausdrücklichen
    // Zeichenmodus würde dieser Zug das vorhandene Rechteck verschieben.
    fireEvent.click(getByRole('button', { name: '+ Feld zeichnen' }));
    expect(getByRole('button', { name: '+ Feld zeichnen' }).getAttribute('aria-pressed')).toBe('true');
    const startPunkt = fotoPunkt(3, 2);
    const endePunkt = fotoPunkt(8, 5);
    sendePointer(svg, 'pointerdown', startPunkt[0], startPunkt[1]);
    sendePointer(svg, 'pointermove', endePunkt[0], endePunkt[1]);
    sendePointer(svg, 'pointerup', endePunkt[0], endePunkt[1]);

    await waitFor(() => expect(letzterStand.flaechen[0]!.felder).toHaveLength(2));
    await findByText('1 von 2 ausgewählt');
    expect(getByRole('button', { name: '+ Feld zeichnen' }).getAttribute('aria-pressed')).toBe('false');
    const raster = rasterFuer(letzterStand.flaechen[0]!, modulById(letzterStand.modulId));
    expect(new Set(raster.positionen.map((p) => p.feld))).toEqual(new Set([0, 1]));
  });

  it('vergrößert und verschiebt bestehende Belegungsbereiche frei über den Dachrahmen', async () => {
    const basis = projektMitFreiraum([
      { xM: 1, yM: 1, breiteM: 2, hoeheM: 2, quer: false },
    ]);
    const start: Projekt = {
      ...basis,
      flaechen: [{
        ...basis.flaechen[0]!,
        // Der rechte Feldgriff (3 m / 2 m) liegt mitten im Hindernis. Trotzdem
        // muss der blaue Griff den Zug erhalten und das Feld vergrößern.
        hindernisse: [{ xM: 2.5, yM: 1.5, breiteM: 1, hoeheM: 1 }],
      }],
    };
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole, findByText } = render(<TestApp />);
    const svg = getByRole('img', { name: /^Belegungsfläche Dachfläche 1/ }) as unknown as SVGSVGElement;
    const normalesRechteck = {
      x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600,
      toJSON: () => ({}),
    };
    const rechteckSpy = vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(normalesRechteck);
    const flaeche = start.flaechen[0]!;
    const ecken = flaeche.fotoZuordnungen![0]!.eckenPx!;
    const h = homographie(
      rahmenBreiteVon(flaeche),
      flaeche.hoeheM,
      ecken,
      perspektiveQuelle(flaeche),
    )!;
    const fotoPunkt = (xM: number, yM: number) => projiziere(h, [xM, yM]);

    // Feld antippen, damit seine Größen-Griffe aktiv werden.
    const innen = fotoPunkt(2, 2);
    sendePointer(svg, 'pointerdown', innen[0], innen[1]);
    sendePointer(svg, 'pointerup', innen[0], innen[1]);
    await findByText('1 von 1 ausgewählt');

    // Rechten Griff (x=3 m) weit über die rechte Dachkante (x=10 m) ziehen.
    const griff = fotoPunkt(3, 2);
    const gross = fotoPunkt(12, 2);
    sendePointer(svg, 'pointerdown', griff[0], griff[1]);
    // Ein einzelner ungültiger Messpunkt (hier: kurzzeitig 0×0-Viewport) darf
    // den laufenden Zug nicht mehr abbrechen.
    rechteckSpy.mockReturnValueOnce({
      ...normalesRechteck,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
    });
    sendePointer(svg, 'pointermove', gross[0], gross[1]);
    sendePointer(svg, 'pointermove', gross[0], gross[1]);
    await waitFor(() => {
      expect(svg.querySelector('[data-modul-darstellung="kontur"]')).toBeTruthy();
      expect(svg.querySelector('[data-modul-darstellung="detail"]')).toBeNull();
    });
    sendePointer(svg, 'pointerup', gross[0], gross[1]);
    await waitFor(() => expect(letzterStand.flaechen[0]!.felder![0]!.breiteM).toBeGreaterThan(10));
    await waitFor(() => expect(svg.querySelector('[data-modul-darstellung="detail"]')).toBeTruthy());

    // Danach das weiterhin ausgewählte Feld über die linke Dachkante hinausschieben.
    const links = fotoPunkt(-2, 2);
    sendePointer(svg, 'pointerdown', innen[0], innen[1]);
    sendePointer(svg, 'pointermove', links[0], links[1]);
    sendePointer(svg, 'pointerup', links[0], links[1]);
    await waitFor(() => expect(letzterStand.flaechen[0]!.felder![0]!.xM).toBeLessThan(0));
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
