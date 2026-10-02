// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
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
import { EntwurfNavigationProvider } from '../lib/entwurf-navigation';
import { EditorSitzungProvider } from '../lib/editor-sitzung';

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
  vi.useRealTimers();
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
        massStatus: 'bestaetigt',
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
        massStatus: 'bestaetigt',
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
    tasten: MouseEventInit = {},
  ) => {
    const event = new MouseEvent(art, { bubbles: true, clientX, clientY, ...tasten });
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
        massStatus: 'bestaetigt' as const,
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

  it('fasst eine gehaltene Pfeilaktion zusammen und stellt die vollständige Bewegung wieder her', async () => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 4, hoeheM: 3, quer: false }]);
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole } = render(<TestApp />);
    fireEvent.click(getByRole('button', { name: 'Alle auswählen' }));
    const rechts = getByRole('button', { name: 'nach rechts' });
    vi.useFakeTimers();
    fireEvent.pointerDown(rechts, { pointerId: 1 });
    act(() => vi.advanceTimersByTime(520));
    fireEvent.pointerUp(rechts, { pointerId: 1 });
    expect(letzterStand.flaechen[0]!.felder![0]!.xM).toBe(1.5);
    expect(getByRole('button', { name: '↶ Rückgängig (1)' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /Rückgängig/ }));
    expect(letzterStand.flaechen[0]!.felder![0]!.xM).toBe(1);
    fireEvent.click(getByRole('button', { name: /Wiederherstellen/ }));
    expect(letzterStand.flaechen[0]!.felder![0]!.xM).toBe(1.5);
  });

  it('stellt ein gelöschtes Foto einschließlich seiner Zuordnungen ohne Datenkopie wieder her', () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const start = projektMitFoto();
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole } = render(<TestApp />);
    fireEvent.click(getByRole('button', { name: 'Fotos' }));
    fireEvent.click(getByRole('button', { name: 'Löschen' }));
    expect(letzterStand.fotos).toHaveLength(0);
    expect(letzterStand.flaechen[0]!.fotoZuordnungen).toHaveLength(0);
    fireEvent.click(getByRole('button', { name: /Rückgängig/ }));
    expect(letzterStand.fotos[0]).toBe(start.fotos[0]);
    expect(letzterStand.flaechen[0]!.fotoZuordnungen).toBe(start.flaechen[0]!.fotoZuordnungen);
  });

  it('bietet bei offenen Maßen keine erste Belegung an', () => {
    const start = projektMitFreiraum();
    start.flaechen[0]!.massStatus = 'offen';
    const { queryByRole, getAllByText } = render(<SchrittBelegung projekt={start} onChange={vi.fn()} />);
    expect(queryByRole('button', { name: 'Automatisch belegen' })).toBeNull();
    expect(getAllByText(/Maße.*bestätig/i).length).toBeGreaterThan(0);
  });

  it('öffnet vorhandene Umrisse und die erste Gaube direkt, ohne gespeicherte Geometrie zu ändern', () => {
    const start = projektMitFoto();
    start.flaechen[0]!.umrissM = [[0, 0], [10, 0], [8, 5], [0, 5]];
    const onChange = vi.fn();
    const ui = render(<SchrittBelegung projekt={start} onChange={onChange} />);
    const dach = within(ui.getByRole('group', { name: 'Dach bearbeiten' }));
    fireEvent.click(dach.getByRole('button', { name: 'Umriss' }));
    expect(ui.getAllByTestId('umriss-griff')).toHaveLength(4);
    expect((ui.getByRole('button', { name: 'Umriss übernehmen' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(dach.getByRole('button', { name: 'Umriss' }));
    expect(ui.getAllByTestId('umriss-griff')).toHaveLength(4);
    fireEvent.click(dach.getByRole('button', { name: 'Aussparungen' }));
    expect(ui.queryAllByTestId('umriss-griff')).toHaveLength(0);
    expect(ui.getByRole('button', { name: 'Aussparungen überspringen · Belegen' })).toBeTruthy();
    fireEvent.click(dach.getByRole('button', { name: 'Gauben' }));
    expect(ui.getByRole('button', { name: 'Satteldachgaube' })).toBeTruthy();
    expect(ui.getByRole('button', { name: 'Im Foto markieren →' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Auswählen' }));
    expect(ui.getByRole('img', { name: /^Belegungsfläche/ })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('schützt den Maßentwurf auch beim direkten Wechsel zum Dachumriss', () => {
    const start = projektMitFoto();
    const onChange = vi.fn();
    const ui = render(<EntwurfNavigationProvider><SchrittBelegung projekt={start} onChange={onChange} /></EntwurfNavigationProvider>);
    fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '20' } });
    const umriss = within(ui.getByRole('group', { name: 'Dach bearbeiten' })).getByRole('button', { name: 'Umriss' });
    fireEvent.click(umriss);
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben', hidden: true }));
    expect((ui.getByLabelText(/^Traufe/) as HTMLInputElement).value).toBe('20');
    fireEvent.click(umriss);
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen', hidden: true }));
    expect(ui.getByRole('button', { name: 'Umriss übernehmen' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('bestätigt eine alte unbelegte Gaube, ohne Schätzungen zu Messungen umzubenennen', () => {
    const start = projektMitSatteldachgaube();
    start.flaechen[1] = { ...start.flaechen[1]!, felder: [], massStatus: 'offen', gaubenMessung: { quelle: 'nachbardach', qualitaet: 'geschaetzt' } };
    start.flaechen[2] = { ...start.flaechen[2]!, massStatus: 'offen', gaubenMessung: { quelle: 'nachbardach', qualitaet: 'geschaetzt' } };
    let letzterStand = start;
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const ui = render(<TestApp />);
    fireEvent.click(ui.getByRole('button', { name: 'Gauben' }));
    fireEvent.click(ui.getAllByText('Maß verbessern')[0]!);
    const breite = ui.getAllByLabelText(/^Breite/)[0]!;
    fireEvent.change(breite, { target: { value: '' } });
    fireEvent.click(ui.getAllByRole('button', { name: /m übernehmen/ })[0]!);
    expect(letzterStand.flaechen[1]!.massStatus).toBe('offen');
    fireEvent.change(breite, { target: { value: '3' } });
    fireEvent.click(ui.getAllByRole('button', { name: /m übernehmen/ })[0]!);
    expect(letzterStand.flaechen[1]!.massStatus).toBe('bestaetigt');
    expect(letzterStand.flaechen[1]!.gaubenMessung).toEqual({ quelle: 'nachbardach', qualitaet: 'geschaetzt' });
    expect(letzterStand.flaechen[2]).toBe(start.flaechen[2]);
  });

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
        massStatus: 'bestaetigt',
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
    const { getByRole } = render(<TestApp />);
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
    fireEvent.click(getByRole('button', { name: '+ Feld zeichnen' }));
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

  it('legt im Auswahlwerkzeug auch durch Ziehen im Leerraum kein Feld an', () => {
    const start = projektMitFreiraum();
    const onChange = vi.fn();
    const ui = render(<SchrittBelegung projekt={start} onChange={onChange} />);
    const svg = ui.getByRole('img', { name: /^Belegungsfläche/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    sendePointer(svg, 'pointerdown', 100, 450);
    sendePointer(svg, 'pointermove', 900, 150);
    sendePointer(svg, 'pointerup', 900, 150);
    expect(onChange).not.toHaveBeenCalled();
    expect(ui.getByRole('button', { name: 'Auswählen' }).getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['shiftKey', 'ctrlKey', 'metaKey'] as const)('wählt einzeln, mit %s mehrfach und zieht die Gruppe ohne versehentlich abzuwählen', (tastenName) => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 3, hoeheM: 3, quer: false }, { xM: 6, yM: 1, breiteM: 3, hoeheM: 3, quer: false }]);
    let stand = start;
    function App() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { stand = neu; setProjekt(neu); }} />;
    }
    const ui = render(<App />);
    const svg = ui.getByRole('img', { name: /^Belegungsfläche/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    const klick = (x: number, tasten: MouseEventInit = {}) => {
      sendePointer(svg, 'pointerdown', x, 333, tasten);
      sendePointer(svg, 'pointerup', x, 333, tasten);
    };
    klick(350);
    klick(650);
    expect(ui.getByText('1 von 2 ausgewählt')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'nach rechts' }));
    expect(stand.flaechen[0]!.felder!.map((x) => x.xM)).toEqual([1, 6.1]);
    klick(350, { [tastenName]: true });
    expect(ui.getByText('2 von 2 ausgewählt')).toBeTruthy();
    sendePointer(svg, 'pointerdown', 350, 333);
    sendePointer(svg, 'pointermove', 380, 333);
    sendePointer(svg, 'pointerup', 380, 333);
    expect(stand.flaechen[0]!.felder!.map((x) => x.xM)).toEqual([1.5, 6.6]);
    expect(ui.getByText('2 von 2 ausgewählt')).toBeTruthy();
    // Das zuerst ausgewählte Feld anklicken: tatsächlicher Treffer, nicht letzter Gruppenindex.
    klick(650);
    expect(ui.getByText('1 von 2 ausgewählt')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'nach rechts' }));
    expect(stand.flaechen[0]!.felder!.map((x) => x.xM)).toEqual([1.5, 6.7]);
    // Escape funktioniert auch mit Fokus auf einer Pfeilaktion außerhalb des SVG.
    fireEvent.keyDown(ui.getByRole('button', { name: 'nach rechts' }), { key: 'Escape' });
    expect(ui.queryByText('1 von 2 ausgewählt')).toBeNull();
  });

  it('entfernt Module beider Felder ohne Auswahl und stellt sie einzeln oder per Undo wieder her', () => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 3, hoeheM: 3, quer: false }, { xM: 6, yM: 1, breiteM: 3, hoeheM: 3, quer: false }]);
    let stand = start;
    function App() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { stand = neu; setProjekt(neu); }} />;
    }
    const ui = render(<App />);
    fireEvent.click(ui.getByRole('button', { name: 'Module entfernen' }));
    for (const index of [0, 1]) fireEvent.click(ui.container.querySelector(`[data-modul-key^="f${index}:"]`)!);
    expect(stand.flaechen[0]!.felder!.map((x) => x.leer?.length)).toEqual([1, 1]);
    expect(ui.queryByText(/von 2 ausgewählt/)).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: /Rückgängig/ }));
    expect(stand.flaechen[0]!.felder!.map((x) => x.leer?.length ?? 0)).toEqual([1, 0]);
    fireEvent.click(ui.getByRole('button', { name: 'Module entfernen' }));
    fireEvent.click(ui.container.querySelector('[data-modul-leer="true"]')!);
    expect(stand.flaechen[0]!.felder!.map((x) => x.leer?.length ?? 0)).toEqual([0, 0]);
  });

  it('legt ein Feld mit zwei einzelnen Eckpunkten als genau eine Änderung an', () => {
    const start = projektMitFreiraum();
    let stand = start;
    function App() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { stand = neu; setProjekt(neu); }} />;
    }
    const ui = render(<App />);
    const svg = ui.getByRole('img', { name: /^Belegungsfläche/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    fireEvent.click(ui.getByRole('button', { name: '+ Feld zeichnen' }));
    fireEvent.click(ui.getByRole('button', { name: 'Mit zwei Punkten zeichnen' }));
    sendePointer(svg, 'pointerdown', 250, 430);
    sendePointer(svg, 'pointerup', 250, 430);
    expect(stand.flaechen[0]!.felder).toEqual([]);
    expect(ui.getByText('Gegenüberliegende Ecke antippen.')).toBeTruthy();
    sendePointer(svg, 'pointerdown', 700, 170);
    sendePointer(svg, 'pointerup', 700, 170);
    expect(stand.flaechen[0]!.felder).toHaveLength(1);
    expect(ui.getByRole('button', { name: '↶ Rückgängig (1)' })).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: /Rückgängig/ }));
    expect(stand.flaechen[0]!.felder).toEqual([]);
  });

  it('ändert die Vorgabe neuer Felder ohne bestehende Felder zu drehen und dreht nur die Auswahl', () => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 3, hoeheM: 3, quer: false }, { xM: 6, yM: 1, breiteM: 3, hoeheM: 3, quer: false }]);
    let stand = start;
    function App() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { stand = neu; setProjekt(neu); }} />;
    }
    const ui = render(<App />);
    expect(ui.queryByRole('button', { name: 'Quer' })).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: '+ Feld zeichnen' }));
    fireEvent.change(ui.getByRole('combobox', { name: 'Ausrichtung neuer Felder' }), { target: { value: 'quer' } });
    expect(stand.flaechen[0]!.felder).toBe(start.flaechen[0]!.felder);
    fireEvent.click(ui.getByRole('button', { name: 'Auswählen' }));
    const svg = ui.getByRole('img', { name: /^Belegungsfläche/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    sendePointer(svg, 'pointerdown', 350, 320);
    sendePointer(svg, 'pointerup', 350, 320);
    fireEvent.click(ui.getByRole('button', { name: 'Quer' }));
    expect(stand.flaechen[0]!.felder!.map((f) => f.quer)).toEqual([true, false]);
    expect(stand.flaechen[0]!.ausrichtung).toBe('quer');
  });

  it('verwirft die Modellgeste sofort beim zweiten Finger und committet nicht über das Window-Sicherheitsnetz', () => {
    const start = projektMitFreiraum();
    const onChange = vi.fn();
    const ui = render(<SchrittBelegung projekt={start} onChange={onChange} />);
    const svg = ui.getByRole('img', { name: /^Belegungsfläche/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    fireEvent.click(ui.getByRole('button', { name: '+ Feld zeichnen' }));
    const touch = (art: string, id: number, x: number, y: number, target: Element | Window = svg) => {
      const event = new MouseEvent(art, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: 'touch' } });
      fireEvent(target, event);
    };
    touch('pointerdown', 1, 250, 430);
    touch('pointermove', 1, 700, 170);
    touch('pointerdown', 2, 600, 300);
    touch('pointermove', 1, 900, 100);
    touch('pointerup', 1, 900, 100, window);
    touch('pointerup', 2, 600, 300, window);
    expect(onChange).not.toHaveBeenCalled();
    expect(svg.querySelector('[data-modul-darstellung="kontur"]')).toBeNull();
  });

  it('zeigt nur eine aktive Canvas und wechselt Hauptdach und Gaubenseite über Bildlabel', () => {
    const start = projektMitSatteldachgaube();
    const onChange = vi.fn();
    const ui = render(<SchrittBelegung projekt={start} onChange={onChange} />);
    expect(ui.getAllByTestId('editor-viewport')).toHaveLength(1);
    expect(ui.getAllByRole('img', { name: /^Belegungsfläche/ })).toHaveLength(1);
    fireEvent.click(ui.getByRole('button', { name: 'Satteldachgaube rechts im Foto auswählen' }));
    expect((ui.getByRole('combobox', { name: 'Aktive Dachfläche' }) as HTMLSelectElement).value).toBe(start.flaechen[2]!.id);
    expect(ui.getAllByRole('img', { name: /^Belegungsfläche/ })).toHaveLength(1);
    expect(ui.getByRole('img', { name: /^Belegungsfläche Satteldachgaube rechts/ })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('schützt den Perspektiventwurf vor dem Flächenwechsel mit Verwerfen oder Bleiben', () => {
    const start = projektMitSatteldachgaube();
    const ui = render(<EntwurfNavigationProvider><SchrittBelegung projekt={start} onChange={vi.fn()} /></EntwurfNavigationProvider>);
    fireEvent.click(ui.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(ui.getAllByRole('button', { name: 'Perspektive bearbeiten' })[0]!);
    fireEvent.keyDown(ui.getByRole('img', { name: /Perspektive von Dachfläche 1 bearbeiten/ }), { key: 'ArrowRight' });
    fireEvent.change(ui.getByRole('combobox', { name: 'Aktive Dachfläche' }), { target: { value: start.flaechen[2]!.id } });
    expect((ui.getByRole('combobox', { name: 'Aktive Dachfläche' }) as HTMLSelectElement).value).toBe(start.flaechen[0]!.id);
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben', hidden: true }));
    expect(ui.getByTestId('perspektiv-griffe')).toBeTruthy();
    fireEvent.change(ui.getByRole('combobox', { name: 'Aktive Dachfläche' }), { target: { value: start.flaechen[2]!.id } });
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen', hidden: true }));
    expect((ui.getByRole('combobox', { name: 'Aktive Dachfläche' }) as HTMLSelectElement).value).toBe(start.flaechen[2]!.id);
  });

  it.each([true, false])('bewegt per Touch nur das Fadenkreuz und erhält den Perspektiventwurf beim zweiten Finger (Markierung fertig: %s)', (markierungFertig) => {
    const start = projektMitFoto();
    start.flaechen[0]!.felder = [];
    start.flaechen[0]!.fotoZuordnungen![0]!.markierungFertig = markierungFertig;
    const onChange = vi.fn();
    const ui = render(<SchrittBelegung projekt={start} onChange={onChange} />);
    fireEvent.click(ui.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(ui.getAllByRole('button', { name: 'Perspektive bearbeiten' })[0]!);
    const svg = ui.getByRole('img', { name: /Perspektive von Dachfläche 1 bearbeiten/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    // Eine vorherige abgeschlossene Korrektur darf der Gestenabbruch erhalten.
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    const vorher = ui.getByTestId('perspektiv-griffe').querySelector('polygon')!.getAttribute('points');
    const griff = ui.getByRole('button', { name: 'Perspektive Ecke 1' });
    const touch = (target: Element, art: string, id: number, x: number, y: number) => {
      const event = new MouseEvent(art, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: 'touch' } });
      fireEvent(target, event);
    };
    touch(griff, 'pointerdown', 1, 1, 600);
    touch(griff, 'pointermove', 1, 30, 560);
    expect(ui.getByTestId('foto-fadenkreuz')).toBeTruthy();
    expect(ui.getByTestId('perspektiv-griffe').querySelector('polygon')!.getAttribute('points')).toBe(vorher);
    touch(svg, 'pointerdown', 2, 700, 200);
    expect(ui.getByTestId('perspektiv-griffe').querySelector('polygon')!.getAttribute('points')).toBe(vorher);
    touch(griff, 'pointerup', 1, 30, 560);
    touch(svg, 'pointermove', 2, 710, 210);
    touch(svg, 'pointerup', 2, 700, 200);
    fireEvent.click(svg);
    expect(ui.getByTestId('perspektiv-griffe').querySelector('polygon')!.getAttribute('points')).toBe(vorher);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('behält Auswahl und Bildzoom bei einem erneuten Öffnen desselben Projekts', () => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 3, hoeheM: 3, quer: false }]);
    function App() {
      const [zeigen, setZeigen] = useState(true);
      return <EditorSitzungProvider projektId="eins"><button onClick={() => setZeigen(!zeigen)}>Schritt wechseln</button>{zeigen && <SchrittBelegung projekt={start} onChange={vi.fn()} />}</EditorSitzungProvider>;
    }
    const ui = render(<App />);
    fireEvent.click(ui.getByRole('button', { name: 'Alle auswählen' }));
    fireEvent.click(ui.getByRole('button', { name: 'Vergrößern' }));
    fireEvent.click(ui.getByRole('button', { name: 'Schritt wechseln' }));
    fireEvent.click(ui.getByRole('button', { name: 'Schritt wechseln' }));
    expect(ui.getByText('1 von 1 ausgewählt')).toBeTruthy();
    expect(ui.getByLabelText('Zoom 125 Prozent')).toBeTruthy();
  });

  it('erhält eine Bestandsbelegung ohne Foto als bearbeitbare metrische Ansicht', () => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 3, hoeheM: 3, quer: false }]);
    start.fotos = [];
    start.flaechen[0]!.fotoZuordnungen = [];
    start.flaechen[0]!.massStatus = 'bestand';
    const ui = render(<SchrittBelegung projekt={start} onChange={vi.fn()} />);
    expect(ui.getByRole('img', { name: /^Belegungsfläche/ })).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Alle auswählen' }));
    expect(ui.getByRole('button', { name: 'nach rechts' })).toBeTruthy();
  });

  it('sperrt Feldbewegungen in der Maßvorschau bis der Geometrieentwurf übernommen wurde', () => {
    const start = projektMitFreiraum([{ xM: 1, yM: 1, breiteM: 3, hoeheM: 3, quer: false }]);
    const onChange = vi.fn();
    const ui = render(<EntwurfNavigationProvider><SchrittBelegung projekt={start} onChange={onChange} /></EntwurfNavigationProvider>);
    fireEvent.click(ui.getByRole('button', { name: 'Alle auswählen' }));
    fireEvent.click(ui.getByRole('button', { name: 'Dachdetails' }));
    fireEvent.change(ui.getByLabelText(/^Traufe/), { target: { value: '20' } });
    const svg = ui.getByRole('img', { name: /^Belegungsfläche/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
    sendePointer(svg, 'pointerdown', 290, 350);
    sendePointer(svg, 'pointermove', 500, 350);
    sendePointer(svg, 'pointerup', 500, 350);
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(start.flaechen[0]!.felder![0]!.xM).toBe(1);
    fireEvent.click(ui.getByRole('button', { name: 'Vergrößern' }));
    expect(ui.getByLabelText('Zoom 125 Prozent')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
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
    fireEvent.click(getByRole('button', { name: 'Mehr' }));
    fireEvent.click(getAllByRole('button', { name: 'Perspektive bearbeiten' })[0]!);

    const svg = getAllByRole('img', { name: /Perspektive von Dachfläche 1 bearbeiten/ })[0]!;
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(getByTestId('perspektiv-griffe').querySelector('polygon')?.getAttribute('points')).toContain('1,600');
    expect(letzterStand.flaechen[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([0, 600]);

    fireEvent.click(getByRole('button', { name: 'Abbrechen' }));
    expect(letzterStand.flaechen[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([0, 600]);

    fireEvent.click(getByRole('button', { name: 'Mehr' }));
    fireEvent.click(getAllByRole('button', { name: 'Perspektive bearbeiten' })[0]!);
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
    fireEvent.change(getByRole('combobox', { name: 'Aktive Dachfläche' }), { target: { value: start.flaechen[2]!.id } });
    fireEvent.click(getByRole('button', { name: 'Dachdetails' }));
    fireEvent.click(getAllByRole('button', { name: 'Perspektive bearbeiten' })[0]!);
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

  it('löscht von der zweiten Dachseite die ganze Gaubengruppe und stellt sie per Rückgängig wieder her', async () => {
    const start = projektMitSatteldachgaube();
    let letzterStand = start;
    const bestaetigen = vi.spyOn(window, 'confirm').mockReturnValue(false);
    function TestApp() {
      const [projekt, setProjekt] = useState(start);
      return <SchrittBelegung projekt={projekt} onChange={(neu) => { letzterStand = neu; setProjekt(neu); }} />;
    }
    const { getByRole } = render(<TestApp />);
    fireEvent.change(getByRole('combobox', { name: 'Aktive Dachfläche' }), { target: { value: start.flaechen[2]!.id } });
    fireEvent.click(getByRole('button', { name: 'Dachdetails' }));
    const loeschen = getByRole('button', { name: 'Gaube löschen' });
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
