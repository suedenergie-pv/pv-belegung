// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ecken } from '../lib/foto-geometrie';
import { neueFlaeche, neueGaubenFlaeche, neuesProjekt, type Flaeche } from '../lib/model';
import { GaubenEditor } from './GaubenEditor';
import { EntwurfNavigationProvider, useEntwurfNavigation } from '../lib/entwurf-navigation';
import { satteldachSeitenEcken } from '../lib/gauben-geometrie';

beforeEach(() => {
  vi.stubGlobal('React', React);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
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
    fireEvent.click(ui.getByRole('button', { name: 'Dachmaße ändern' }));
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4' } });
    expect(ui.getByText(/Vorschau:.*Module/)).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    expect(ui.getByRole('dialog')).toBeTruthy(); expect(weiter).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben' }));
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    fireEvent.click(ui.getByRole('button', { name: /^Übernehmen$/ }));
    expect(speichern).not.toHaveBeenCalled(); expect(weiter).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen verwerfen' }));
    expect(ui.getByRole('button', { name: 'Maße & Neigung' }).getAttribute('aria-pressed')).toBe('true');
    expect((ui.getByLabelText(/^Breite/) as HTMLInputElement).value).toBe('3');
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4' } });
    fireEvent.click(ui.getByRole('button', { name: 'Zum Export' }));
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen' }));
    expect(weiter).toHaveBeenCalledTimes(1); expect(speichern).not.toHaveBeenCalled();
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

    fireEvent.click(getByRole('button', { name: 'Gaube kopieren' }));

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
    fireEvent.click(getByRole('button', { name: 'Form korrigieren' }));
    const ersterGriff = getByRole('button', { name: 'Gaubenpunkt 1' });
    const pointer = (art: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(art, { bubbles: true, clientX, clientY });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      fireEvent(ersterGriff, event);
    };
    pointer('pointerdown', 240, 528);
    pointer('pointermove', 230, 538);
    pointer('pointermove', 225, 543);
    pointer('pointermove', 220, 548);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    pointer('pointerup', 220, 548);
    fireEvent.click(getByRole('button', { name: 'Gaubenkopie anlegen' }));

    expect(onErstellen).toHaveBeenCalledTimes(1);
    expect(onErstellen.mock.calls[0]![0].aussen[0]).toEqual([220, 548]);
    expect(onErstellen.mock.calls[0]![0]).toMatchObject({ breiteM: 2.4, hoeheM: 2.1, messung: { quelle: 'aufmass', qualitaet: 'bestaetigt' } });
    expect(queryByText('Gaubenkopie')).toBeNull();

    fireEvent.click(getByRole('button', { name: 'Module bearbeiten' }));
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
    fireEvent.click(getByRole('button', { name: 'Aus Nachbardach schätzen' }));
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

const aussen: Ecken = [[200, 500], [600, 500], [600, 200], [200, 200]];
function testDach() {
  const eckenPx: Ecken = [[0, 600], [1000, 600], [1000, 0], [0, 0]];
  return { ...neueFlaeche(1, 'A'), breiteM: 10, hoeheM: 6, azimutDeg: 215,
    fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx }],
    foto: { dataUrl: 'data:image/png;base64,AA==', breitePx: 1000, hoehePx: 600, traufePx: null, eckenPx } };
}

function fotoMarkieren(ui: ReturnType<typeof render>, sattel = false) {
  const foto = ui.getByRole('img', { name: 'Gaube im Dachfoto markieren' });
  vi.spyOn(foto, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON: () => ({}) });
  for (const [clientX, clientY] of [...aussen, ...(sattel ? [[400, 180], [400, 520]] : [])]) fireEvent.click(foto, { clientX, clientY });
}

describe('Gaube ohne Materialwissen anlegen', () => {
  function neu() {
    const eltern = testDach(); const erstellen = vi.fn();
    return { erstellen, ...render(<GaubenEditor initialOffen eltern={eltern} gauben={[]} projekt={{ ...neuesProjekt(), flaechen: [eltern] }} onErstellen={erstellen} onLoeschen={vi.fn()} onMasseAendern={vi.fn()} onMarkierungAendern={vi.fn()} />) };
  }
  it.each([['0', 0], ['7,5', 7.5], ['75', 75]])('übernimmt %s Grad direkt beim Anlegen einer einzelnen Dachseite', (eingabe, winkel) => {
    const ui = neu();
    expect(ui.getByRole('button', { name: 'Flach / leicht geneigt' }).getAttribute('aria-pressed')).toBe('true');
    expect(ui.getByRole('button', { name: 'Zwei Dachseiten' })).toBeTruthy();
    expect(ui.queryByText(/Stehfalz/)).toBeNull();
    fireEvent.change(ui.getByLabelText(/^Dachneigung der Gaube/), { target: { value: eingabe } });
    fireEvent.click(ui.getByRole('button', { name: 'Aufmaß vorhanden' }));
    fireEvent.click(ui.getByRole('button', { name: 'Im Foto markieren →' }));
    fotoMarkieren(ui);
    fireEvent.click(ui.getByRole('button', { name: 'Gaube anlegen & fertig' }));
    expect(ui.erstellen).toHaveBeenCalledOnce();
    expect(ui.erstellen.mock.calls[0]![0]).toMatchObject({ typ: 'flachdach', geometrie: { neigungDeg: winkel, azimutDeg: 215, dachform: 'rechteck' } });
    expect(ui.erstellen.mock.calls[0]![0].geometrie).not.toHaveProperty('montage');
  });
  it.each(['', '-1', '76', 'abc'])('lässt eine ungültige Neigung %s nicht mit dem vorherigen Wert weiterlaufen', (eingabe) => {
    const ui = neu(); const feld = ui.getByLabelText(/^Dachneigung der Gaube/);
    fireEvent.click(ui.getByRole('button', { name: 'Aufmaß vorhanden' }));
    fireEvent.change(feld, { target: { value: eingabe } });
    fireEvent.click(ui.getByRole('button', { name: 'Im Foto markieren →' }));
    expect(ui.queryByRole('img', { name: 'Gaube im Dachfoto markieren' })).toBeNull();
    expect(document.activeElement).toBe(feld);
    expect(ui.erstellen).not.toHaveBeenCalled();
  });
  it('verlangt eine bewusste Messquelle und setzt sie für die nächste neue Gaube zurück', () => {
    const ui = neu();
    const weiter = () => ui.getByRole('button', { name: 'Im Foto markieren →' }) as HTMLButtonElement;
    expect(weiter().disabled).toBe(true);
    expect(ui.getByRole('button', { name: 'Aus Nachbardach schätzen' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(weiter());
    expect(ui.queryByRole('img', { name: 'Gaube im Dachfoto markieren' })).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: 'Aus Nachbardach schätzen' }));
    expect(weiter().disabled).toBe(false);
    fireEvent.click(weiter());
    fotoMarkieren(ui);
    fireEvent.click(ui.getByRole('button', { name: 'Gaube anlegen & fertig' }));
    expect(ui.erstellen.mock.calls[0]![0].messung).toMatchObject({ quelle: 'nachbardach', qualitaet: 'geschaetzt' });
    fireEvent.click(ui.getByRole('button', { name: '+ Gaube' }));
    expect(weiter().disabled).toBe(true);
  });
  it('übernimmt eine freie Neigung für beide Sattelseiten und erhält deren verschiedene Richtungen', () => {
    const ui = neu();
    fireEvent.click(ui.getByRole('button', { name: 'Zwei Dachseiten' }));
    fireEvent.change(ui.getByLabelText(/^Dachneigung beider Seiten/), { target: { value: '22,5' } });
    fireEvent.click(ui.getByRole('button', { name: 'Aufmaß vorhanden' }));
    fireEvent.click(ui.getByRole('button', { name: 'Im Foto markieren →' }));
    fotoMarkieren(ui, true);
    fireEvent.click(ui.getByRole('button', { name: 'Gaube anlegen & fertig' }));
    expect(ui.erstellen).toHaveBeenCalledOnce();
    expect(ui.erstellen.mock.calls[0]![0]).toMatchObject({ typ: 'satteldach', seitenGeometrie: { links: { neigungDeg: 22.5, azimutDeg: 125 }, rechts: { neigungDeg: 22.5, azimutDeg: 305 } } });
    expect(ui.erstellen.mock.calls[0]![0]).not.toHaveProperty('geometrie');
  });
  it.each([
    ['Eine stärker geneigte Dachseite', 'schleppdach'],
    ['Dachseite oben schmaler', 'walmdach'],
    ['Dachseite mit Spitze', 'spitzdach'],
  ])('erhält bei der beschreibenden Auswahl %s die gespeicherte Typ-ID', (name, typ) => {
    const ui = neu();
    const weitere = ui.getByText('Weitere Formen').closest('details')!;
    weitere.open = true;
    fireEvent.click(ui.getByRole('button', { name }));
    fireEvent.change(ui.getByLabelText(/^Dachneigung der Gaube/), { target: { value: '12' } });
    fireEvent.click(ui.getByRole('button', { name: 'Aufmaß vorhanden' }));
    fireEvent.click(ui.getByRole('button', { name: 'Im Foto markieren →' }));
    fotoMarkieren(ui);
    fireEvent.click(ui.getByRole('button', { name: 'Gaube anlegen & fertig' }));
    expect(ui.erstellen).toHaveBeenCalledOnce();
    expect(ui.erstellen.mock.calls[0]![0]).toMatchObject({ typ, geometrie: { neigungDeg: 12 } });
  });
});

function bestehendeGaube(sattel = false) {
  const eltern = testDach();
  const seiten = satteldachSeitenEcken(aussen, [[400, 180], [400, 520]], eltern)!;
  const gauben: Flaeche[] = (sattel ? ['links', 'rechts'] as const : [undefined]).map((seite, i) => ({
    ...neueGaubenFlaeche(i + 2, 'B', sattel ? 'satteldach' : 'flachdach', eltern.id, seite, 'g7'),
    name: sattel ? `Kundengaube · ${seite === 'links' ? 'Linke' : 'Rechte'} Dachseite` : 'Gaube 7',
    breiteM: 3, hoeheM: 2.5, gaubenMessung: { quelle: 'aufmass', qualitaet: 'bestaetigt' },
    fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: seite ? seiten[seite] : aussen }],
  }));
  let stand = gauben;
  let setzeGespeichertenStand: (flaechen: Flaeche[]) => void;
  const speichern = vi.fn(); const markieren = vi.fn(); const module = vi.fn();
  function Test() {
    const [flaechen, setFlaechen] = useState(gauben); stand = flaechen;
    setzeGespeichertenStand = setFlaechen;
    return <GaubenEditor eltern={eltern} gauben={flaechen} projekt={{ ...neuesProjekt(), flaechen: [eltern, ...flaechen] }} aktiveFotoId="foto-1"
      bearbeiteGruppenId="g7" bearbeiteFlaecheId={gauben[sattel ? 1 : 0]!.id} bearbeitungsAufgabe="masse"
      onErstellen={vi.fn()} onLoeschen={vi.fn()} onBelegungOeffnen={module}
      onMasseAendern={(gruppe, id, breiteM, hoeheM, gaubenMessung, geometrie) => {
        speichern(gruppe, id, breiteM, hoeheM, gaubenMessung, geometrie);
        setFlaechen(fs => fs.map(f => f.id === id ? { ...f, breiteM, hoeheM, gaubenMessung, ...geometrie } : f));
      }} onMarkierungAendern={(gruppe, markierung) => {
        markieren(gruppe, markierung);
        setFlaechen(fs => fs.map(f => ({ ...f, fotoZuordnungen: [{ fotoId: 'foto-1', traufePx: null, eckenPx: f.gaubenSeite ? markierung.seiten![f.gaubenSeite] : markierung.aussen }] })));
      }} />;
  }
  return { speichern, markieren, module, stand: () => stand,
    externAendern: (flaechen: Flaeche[]) => act(() => setzeGespeichertenStand(flaechen)),
    ...render(<EntwurfNavigationProvider><Test /></EntwurfNavigationProvider>) };
}

describe('Gewählte Gaube ohne Umweg weiterbearbeiten', () => {
  const verschobenerStand = (fs: Flaeche[], dx: number) => fs.map(f => ({ ...f, fotoZuordnungen: f.fotoZuordnungen!.map(z => ({ ...z, eckenPx: z.eckenPx!.map(([x, y]) => [x + dx, y]) as Ecken })) }));
  it('gleicht einen unveränderten offenen Umriss bei Undo/Redo mit den gespeicherten Punkten ab', () => {
    const ui = bestehendeGaube(); const original = structuredClone(ui.stand());
    fireEvent.click(ui.getByRole('button', { name: 'Umriss' }));
    const ersteEcke = () => Number(ui.getByRole('button', { name: 'Gaubenpunkt 1' }).getAttribute('cx'));
    ui.externAendern(verschobenerStand(original, 48));
    expect(ersteEcke()).toBe(248);
    ui.externAendern(original);
    expect(ersteEcke()).toBe(200);
    ui.externAendern(verschobenerStand(original, 48));
    expect(ersteEcke()).toBe(248);
    fireEvent.click(ui.getByRole('button', { name: 'Maße & Neigung' }));
    expect(ui.queryByRole('dialog')).toBeNull();
    expect(ui.markieren).not.toHaveBeenCalled();
  });
  it('schützt einen offenen Punktentwurf und verwirft ihn bei Bedarf zum neuesten gespeicherten Stand', () => {
    const ui = bestehendeGaube(); const original = structuredClone(ui.stand());
    fireEvent.click(ui.getByRole('button', { name: 'Umriss' }));
    fireEvent.keyDown(ui.getByRole('img', { name: 'Gaube im Dachfoto markieren' }), { key: 'ArrowRight' });
    ui.externAendern(verschobenerStand(original, 48));
    expect(Number(ui.getByRole('button', { name: 'Gaubenpunkt 1' }).getAttribute('cx'))).toBe(201);
    fireEvent.click(ui.getByRole('button', { name: 'Maße & Neigung' }));
    expect(ui.getByRole('dialog')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Bleiben' }));
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen verwerfen' }));
    expect(Number(ui.getByRole('button', { name: 'Gaubenpunkt 1' }).getAttribute('cx'))).toBe(248);
    expect(ui.markieren).not.toHaveBeenCalled();
  });
  it('bleibt nach Maße- und Umriss-Speichern offen und wechselt direkt zu Verschieben, Maßen und Modulen', () => {
    const ui = bestehendeGaube();
    expect(ui.getByText('Gaube 7')).toBeTruthy();
    fireEvent.change(ui.getByLabelText(/^Breite/), { target: { value: '4.2' } });
    fireEvent.change(ui.getByLabelText(/^Neigung der Gaubenseite/), { target: { value: '7,5' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.getByRole('button', { name: 'Maße & Neigung' }).getAttribute('aria-pressed')).toBe('true');
    expect((ui.getByLabelText(/^Neigung der Gaubenseite/) as HTMLInputElement).value).toBe('7.5');
    fireEvent.click(ui.getByRole('button', { name: 'Umriss' }));
    fireEvent.keyDown(ui.getByRole('img', { name: 'Gaube im Dachfoto markieren' }), { key: 'ArrowRight' });
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen übernehmen' }));
    expect(ui.markieren).toHaveBeenCalledOnce();
    expect(ui.getByRole('button', { name: 'Umriss' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(ui.getByRole('button', { name: 'Verschieben' }));
    expect(ui.getByRole('button', { name: 'Verschieben' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(ui.getByRole('button', { name: 'Maße & Neigung' }));
    expect(ui.queryByRole('dialog')).toBeNull();
    expect((ui.getByLabelText(/^Breite/) as HTMLInputElement).value).toBe('4.2');
    fireEvent.click(ui.getByRole('button', { name: 'Module' }));
    expect(ui.module).toHaveBeenCalledExactlyOnceWith(ui.stand()[0]!.id);
    expect(ui.stand()[0]!.fotoZuordnungen![0]!.eckenPx![0]).toEqual([201, 500]);
    expect(ui.stand()[0]!.neigungDeg).toBe(7.5);
  });
  it('schützt ungültige Maße beim direkten Aufgabenwechsel und verwirft einen Umrissentwurf ohne die Gaube zu verlassen', () => {
    const ui = bestehendeGaube();
    const breite = ui.getByLabelText(/^Breite/);
    fireEvent.change(breite, { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: 'Umriss' }));
    fireEvent.click(ui.getByRole('button', { name: 'Übernehmen' }));
    expect(ui.speichern).not.toHaveBeenCalled(); expect(document.activeElement).toBe(breite);
    fireEvent.change(breite, { target: { value: '3.8' } });
    fireEvent.click(ui.getByRole('button', { name: 'Umriss' }));
    fireEvent.click(ui.getByRole('button', { name: 'Übernehmen' }));
    expect(ui.speichern).toHaveBeenCalledOnce();
    fireEvent.keyDown(ui.getByRole('img', { name: 'Gaube im Dachfoto markieren' }), { key: 'ArrowRight' });
    fireEvent.click(ui.getByRole('button', { name: 'Maße & Neigung' }));
    expect(ui.getByRole('dialog')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Verwerfen' }));
    expect(ui.markieren).not.toHaveBeenCalled();
    expect((ui.getByLabelText(/^Breite/) as HTMLInputElement).value).toBe('3.8');
    expect(ui.stand()[0]!.fotoZuordnungen![0]!.eckenPx).toEqual(aussen);
  });
  it('behält die gewählte Sattelseite und den Kundennamen durch Speichern und Aufgabenwechsel bei', () => {
    const ui = bestehendeGaube(true);
    expect(ui.getByText('Kundengaube')).toBeTruthy();
    expect(ui.getByRole('button', { name: 'Rechte Dachseite' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(ui.getByLabelText(/^Neigung der Gaubenseite/), { target: { value: '12.5' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    fireEvent.click(ui.getByRole('button', { name: 'Umriss' }));
    fireEvent.click(ui.getByRole('button', { name: 'Maße & Neigung' }));
    expect((ui.getByLabelText(/^Neigung der Gaubenseite/) as HTMLInputElement).value).toBe('12.5');
    expect(ui.stand()[0]!.neigungDeg).toBe(30);
    expect(ui.stand()[1]!.neigungDeg).toBe(12.5);
    fireEvent.click(ui.getByRole('button', { name: 'Module' }));
    expect(ui.module).toHaveBeenCalledExactlyOnceWith(ui.stand()[1]!.id);
  });
});
