// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FotoDachrandEditor } from './FotoDachrandEditor';
import type { FotoArbeitsbereich } from './FotoHintergrund';
import { neueFlaeche, type DachFoto, type Flaeche } from '../lib/model';
import { EntwurfNavigationProvider, useEntwurfNavigation } from '../lib/entwurf-navigation';

const foto: DachFoto = { dataUrl: 'data:image/png;base64,eA==', breitePx: 1000, hoehePx: 600, traufePx: null };
const refPunkte: [number, number][] = [[300, 450], [700, 450], [700, 300], [300, 300]];
const dachPunkte: [number, number][] = [[100, 500], [900, 500], [500, 100]];
const matrix = { a: 1, b: 0, inverse: () => matrix };
const screenCTM = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getScreenCTM');
const pointerCapture = Object.getOwnPropertyDescriptor(Element.prototype, 'setPointerCapture');
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return { x: this.x, y: this.y }; } });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => matrix });
  Object.defineProperty(Element.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if (screenCTM) Object.defineProperty(SVGElement.prototype, 'getScreenCTM', screenCTM); else delete (SVGElement.prototype as unknown as { getScreenCTM?: unknown }).getScreenCTM;
  if (pointerCapture) Object.defineProperty(Element.prototype, 'setPointerCapture', pointerCapture); else delete (Element.prototype as unknown as { setPointerCapture?: unknown }).setPointerCapture;
});
function editor(projektFoto: DachFoto = foto, flaeche: Flaeche = neueFlaeche(1, 'A')) {
  let bereich: FotoArbeitsbereich;
  const speichern = vi.fn(), abbrechen = vi.fn(), navigationAktion = vi.fn();
  function Weiter() { const nav = useEntwurfNavigation(); return <button onClick={() => nav.weiter(navigationAktion)}>Andere Aktion</button>; }
  const ui = render(<EntwurfNavigationProvider><Weiter /><FotoDachrandEditor foto={projektFoto} flaeche={flaeche} ansichtZoom={1} onUebernehmen={speichern} onAbbrechen={abbrechen} renderArbeitsbereich={b => { bereich = b; return <>{b.bild}<h2>{b.aufgabe?.titel}</h2>{b.steuerung}<p>{b.hinweis}</p></>; }} /></EntwurfNavigationProvider>);
  const bild = ui.getByRole('img', { name: 'Dachrand und Ziegel im Foto markieren' });
  const klick = (p: readonly [number, number]) => fireEvent.click(bild, { clientX: p[0], clientY: p[1] });
  const eingabe = (label: string, value: string) => fireEvent.change(ui.getByLabelText(label), { target: { value } });
  const dachrand = () => { dachPunkte.forEach(klick); fireEvent.click(ui.getByRole('button', { name: 'Dachrand fertig – weiter' })); };
  const ziegel = () => {
    eingabe('Abstände quer', '10'); eingabe('Reihen nach oben', '5'); eingabe('Deckbreite (cm)', '40'); eingabe('Decklänge (cm)', '30');
    refPunkte.forEach(klick); fireEvent.click(ui.getByRole('button', { name: 'Dachmaße prüfen' }));
  };
  const touchPunkt = (p: readonly [number, number]) => { act(() => bereich.punktSteuerung!.onBewegen([p[0], p[1]])); act(() => bereich.punktSteuerung!.onBestaetigen()); };
  return { ...ui, bild, klick, eingabe, dachrand, ziegel, touchPunkt, speichern, abbrechen, navigationAktion, get bereich() { return bereich!; } };
}
function pointer(ziel: Element, art: string, x: number, y: number, button = 0) {
  const event = new MouseEvent(art, { bubbles: true, clientX: x, clientY: y, button });
  Object.defineProperties(event, { pointerType: { value: 'mouse' }, pointerId: { value: 1 } }); fireEvent(ziel, event);
}

describe('Dachrand zuerst und Ziegelmaßstab', () => {
  it('beginnt ohne Formauswahl und ohne vorgetäuschte Ziegelmaße mit drei echten Dreiecksecken', () => {
    const ui = editor(); expect(ui.getByRole('heading', { name: 'Dachrand nachzeichnen' })).toBeTruthy();
    expect(ui.queryByLabelText('Deckbreite (cm)')).toBeNull(); ui.dachrand();
    expect(ui.getByRole('heading', { name: 'Ziegel als Maßstab' })).toBeTruthy();
    for (const label of ['Abstände quer', 'Reihen nach oben', 'Deckbreite (cm)', 'Decklänge (cm)']) expect((ui.getByLabelText(label) as HTMLInputElement).value).toBe('');
    expect(ui.speichern).not.toHaveBeenCalled();
  });
  it('speichert drei echte Ecken mit gezählter Messherkunft und bekannten Deckmaßen', () => {
    const ui = editor(); ui.dachrand(); ui.ziegel();
    const button = ui.getByRole('button', { name: 'Dachfläche übernehmen' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(button);
    expect(ui.speichern).toHaveBeenCalledOnce(); const dach = ui.speichern.mock.calls[0]![0];
    expect(dach.ergebnis.breiteM).toBeCloseTo(8); expect(dach.ergebnis.hoeheM).toBeCloseTo(4); expect(dach.ergebnis.umrissM).toHaveLength(3);
    expect(dach.messung).toMatchObject({ breiteM: 4, hoeheM: 1.5, eckenPx: refPunkte, umrissPx: dachPunkte, ziegel: { spalten: 10, reihen: 5, deckbreiteCm: 40, decklaengeCm: 30 } });
  });
  it('weist einen sich kreuzenden Umriss bereits vor dem Maßstab zurück', () => {
    const ui = editor(); [[100, 500], [900, 100], [100, 100], [900, 500]].forEach(p => ui.klick(p as [number, number]));
    fireEvent.click(ui.getByRole('button', { name: 'Dachrand fertig – weiter' }));
    expect(ui.getByRole('alert').textContent).toMatch(/kreuzt|berührt/); expect(ui.getByRole('heading', { name: 'Dachrand nachzeichnen' })).toBeTruthy();
  });
  it.each([['Abstände quer', '2,5'], ['Reihen nach oben', '0'], ['Deckbreite (cm)', ''], ['Decklänge (cm)', '-1']])('weist ungültige Eingabe %s=%s mit Korrekturtext zurück', (label, wert) => {
    const ui = editor(); ui.dachrand(); ui.eingabe('Abstände quer', '10'); ui.eingabe('Reihen nach oben', '5'); ui.eingabe('Deckbreite (cm)', '40'); ui.eingabe('Decklänge (cm)', '30'); refPunkte.forEach(ui.klick);
    ui.eingabe(label!, wert!); fireEvent.click(ui.getByRole('button', { name: 'Dachmaße prüfen' }));
    expect(ui.getByRole('alert').textContent).toMatch(/Abstände|Deckbreite|Decklänge/); expect(ui.speichern).not.toHaveBeenCalled();
  });
  it('übernimmt Dezimalkomma ohne gerundeten Maßstab', () => {
    const ui = editor(); ui.dachrand(); ui.eingabe('Abstände quer', '10'); ui.eingabe('Reihen nach oben', '5'); ui.eingabe('Deckbreite (cm)', '39,75'); ui.eingabe('Decklänge (cm)', '30,25'); refPunkte.forEach(ui.klick);
    fireEvent.click(ui.getByRole('button', { name: 'Dachmaße prüfen' })); fireEvent.click(ui.getByRole('checkbox')); fireEvent.click(ui.getByRole('button', { name: 'Dachfläche übernehmen' }));
    expect(ui.speichern.mock.calls[0]![0].messung).toMatchObject({ breiteM: 3.975, hoeheM: 1.5125 });
  });
  it('verhindert einen Maßstab außerhalb der gewählten Dachseite', () => {
    const ui = editor(); ui.dachrand(); ui.eingabe('Abstände quer', '10'); ui.eingabe('Reihen nach oben', '5'); ui.eingabe('Deckbreite (cm)', '40'); ui.eingabe('Decklänge (cm)', '30');
    [[50, 400], [250, 400], [250, 250], [50, 250]].forEach(p => ui.klick(p as [number, number])); fireEvent.click(ui.getByRole('button', { name: 'Dachmaße prüfen' }));
    expect(ui.getByRole('alert').textContent).toContain('innerhalb des gezeichneten Dachrands'); expect(ui.speichern).not.toHaveBeenCalled();
  });
  it('erhält die Punkte beim Zurückgehen und verlangt nach Korrekturen eine neue Messbestätigung', () => {
    const ui = editor(); ui.dachrand(); ui.ziegel(); fireEvent.click(ui.getByRole('checkbox'));
    fireEvent.click(ui.getByRole('button', { name: 'Ziegelmaßstab korrigieren' }));
    expect(ui.getAllByRole('button', { name: /Ziegelpunkt \d verschieben/ })).toHaveLength(4);
    ui.eingabe('Deckbreite (cm)', '41'); fireEvent.click(ui.getByRole('button', { name: 'Dachmaße prüfen' }));
    expect((ui.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect((ui.getByRole('button', { name: 'Dachfläche übernehmen' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(ui.getByRole('button', { name: 'Dachrand korrigieren' })); expect(ui.getAllByRole('button', { name: /Dachrand Ecke/ })).toHaveLength(3);
  });
  it('zeigt die echte perspektivische Unterteilung statt linearer Bildschirmabstände', () => {
    const ui = editor(); [[0, 590], [999, 590], [999, 0], [0, 0]].forEach(p => ui.klick(p as [number, number])); fireEvent.click(ui.getByRole('button', { name: 'Dachrand fertig – weiter' }));
    ui.eingabe('Abstände quer', '4'); ui.eingabe('Reihen nach oben', '4');
    [[200, 500], [800, 500], [650, 100], [350, 100]].forEach(p => ui.klick(p as [number, number]));
    const lines = ui.getAllByTestId('ziegel-hilfslinie'); expect(lines).toHaveLength(6);
    const middleRow = lines[4]!; // y=2 of 4 lies at 233.3 px under this projective transform, not 300.
    expect(Number(middleRow.getAttribute('y1'))).toBeCloseTo(233.333333, 3);
    expect(Number(middleRow.getAttribute('y2'))).toBeCloseTo(233.333333, 3);
    ui.eingabe('Abstände quer', '2000'); ui.eingabe('Reihen nach oben', '2000'); expect(ui.getAllByTestId('ziegel-hilfslinie').length).toBeLessThanOrEqual(48);
  });
});

describe('Korrektur und Schutz vorhandener Daten', () => {
  it.each(['felder', 'hindernisse', 'beide'] as const)('verlangt bei %s eine getrennte Bestätigung zum Neuaufmaß', art => {
    const f: Flaeche = { ...neueFlaeche(1, 'A'), felder: art === 'hindernisse' ? [] : [{ xM: 1, yM: 1, breiteM: 3, hoeheM: 2, quer: false, leer: [] }], hindernisse: art === 'felder' ? [] : [{ xM: 2, yM: 2, breiteM: .6, hoeheM: .7 }] };
    const vorher = JSON.stringify(f); const ui = editor(foto, f); ui.dachrand(); ui.ziegel();
    const save = ui.getByRole('button', { name: 'Dachfläche übernehmen' }) as HTMLButtonElement;
    fireEvent.click(ui.getByRole('checkbox', { name: /Deckmaße geprüft/ })); expect(save.disabled).toBe(true);
    fireEvent.click(ui.getByRole('checkbox', { name: 'Belegung und Aussparungen dieser Dachfläche neu anlegen' })); expect(save.disabled).toBe(false);
    fireEvent.click(save); expect(ui.speichern).toHaveBeenCalledOnce(); expect(JSON.stringify(f)).toBe(vorher);
  });
  it('lädt gezählte Herkunft in einen eigenen Entwurf ohne die gespeicherten Punkte zu verändern', () => {
    const gespeichert: DachFoto = { ...foto, referenzMessung: { breiteM: 4, hoeheM: 1.5, eckenPx: refPunkte as [[number, number], [number, number], [number, number], [number, number]], umrissPx: dachPunkte, rahmenBreiteM: 8, rahmenHoeheM: 4, rahmenEckenPx: [[100, 500], [900, 500], [900, 100], [100, 100]], ziegel: { spalten: 10, reihen: 5, deckbreiteCm: 40, decklaengeCm: 30 } } };
    const vorher = JSON.stringify(gespeichert); const ui = editor(gespeichert);
    fireEvent.click(ui.getByRole('button', { name: 'Dachrand fertig – weiter' })); expect((ui.getByLabelText('Deckbreite (cm)') as HTMLInputElement).value).toBe('40');
    fireEvent.keyDown(ui.getByRole('button', { name: 'Ziegelpunkt 1 verschieben' }), { key: 'ArrowRight', shiftKey: true });
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' })); fireEvent.click(ui.getByRole('button', { name: 'Verwerfen', hidden: true }));
    expect(ui.abbrechen).toHaveBeenCalled(); expect(JSON.stringify(gespeichert)).toBe(vorher); expect(ui.speichern).not.toHaveBeenCalled();
  });
  it('übernimmt keine erfundenen Ziegelzahlen aus einer alten Rechteckreferenz', () => {
    const gespeichert: DachFoto = { ...foto, referenzMessung: { breiteM: 4, hoeheM: 1.5, eckenPx: refPunkte as [[number, number], [number, number], [number, number], [number, number]], umrissPx: dachPunkte, rahmenBreiteM: 8, rahmenHoeheM: 4, rahmenEckenPx: [[100, 500], [900, 500], [900, 100], [100, 100]] } };
    const ui = editor(gespeichert); fireEvent.click(ui.getByRole('button', { name: 'Dachrand fertig – weiter' }));
    expect((ui.getByLabelText('Deckbreite (cm)') as HTMLInputElement).value).toBe(''); expect(ui.queryAllByRole('button', { name: /Ziegelpunkt \d verschieben/ })).toHaveLength(0);
  });
  it('warnt vor dem Verwerfen eines begonnenen Umrisses und bricht einen leeren Editor direkt ab', () => {
    const ui = editor(); fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' })); expect(ui.abbrechen).toHaveBeenCalledOnce();
    ui.klick([100, 500]); fireEvent.click(ui.getByRole('button', { name: 'Andere Aktion' }));
    expect(ui.getByRole('heading', { name: 'Maßentwurf noch offen', hidden: true })).toBeTruthy(); fireEvent.click(ui.getByRole('button', { name: 'Verwerfen', hidden: true }));
    expect(ui.navigationAktion).toHaveBeenCalledOnce(); expect(ui.speichern).not.toHaveBeenCalled();
  });
});

describe('Präzise Maus-, Tastatur- und Touchbedienung', () => {
  it('verliert keine nahen Ecken beim Erstzeichnen und trennt Zeichnen vom Verschieben', () => {
    const ui = editor(); const nahe: [number, number][] = [[200, 200], [204, 200], [204, 198], [202, 198], [202, 199], [200, 199]];
    nahe.forEach(ui.klick); expect(ui.getAllByRole('button', { name: /Dachrand Ecke/ })).toHaveLength(6);
    for (const griff of ui.getAllByRole('button', { name: /Dachrand Ecke/ })) expect(griff.style.pointerEvents).toBe('none');
    fireEvent.click(ui.getByRole('button', { name: 'Gesetzte Ecken verschieben' })); ui.klick([500, 200]); expect(ui.getAllByRole('button', { name: /Dachrand Ecke/ })).toHaveLength(6);
    const griff = ui.getByRole('button', { name: 'Dachrand Ecke 6 verschieben' }); fireEvent.keyDown(griff, { key: 'ArrowRight' }); expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('201');
  });
  it('erhält Nachkommastellen beim Pointerup und ignoriert einen gerundeten Folgeclick', () => {
    const ui = editor(); pointer(ui.bild, 'pointerup', 300.375, 450.625); fireEvent.click(ui.bild, { clientX: 300, clientY: 451 });
    const griffe = ui.getAllByRole('button', { name: /Dachrand Ecke/ }); expect(griffe).toHaveLength(1); expect(griffe[0]!.querySelector('circle')!.getAttribute('cx')).toBe('300.375');
  });
  it('setzt Touchpunkte über Fadenkreuz und wählt bei nahe liegenden Punkten die nächste Ecke', () => {
    const ui = editor(); act(() => ui.bereich.punktSteuerung!.aktivieren()); ui.klick([100, 500]); expect(ui.queryAllByRole('button', { name: /Dachrand Ecke/ })).toHaveLength(0);
    [[200, 200], [204, 200], [204, 198], [200, 198]].forEach(p => ui.touchPunkt(p as [number, number]));
    fireEvent.click(ui.getByRole('button', { name: 'Gesetzte Ecken verschieben' })); act(() => ui.bereich.punktSteuerung!.onBewegen([200, 198])); expect(ui.bereich.punktSteuerung!.aktion).toBe('Punkt greifen');
    act(() => ui.bereich.punktSteuerung!.onBestaetigen()); act(() => ui.bereich.punktSteuerung!.onBewegen([199, 197])); act(() => ui.bereich.punktSteuerung!.onBestaetigen());
    expect(ui.getByRole('button', { name: 'Dachrand Ecke 1 verschieben' }).querySelector('circle')!.getAttribute('cy')).toBe('200');
    expect(ui.getByRole('button', { name: 'Dachrand Ecke 4 verschieben' }).querySelector('circle')!.getAttribute('cx')).toBe('199');
  });
  it('verwirft nur die laufende Ziehgeste und lässt Mittelklick unverändert', () => {
    const ui = editor(); dachPunkte.forEach(ui.klick); fireEvent.click(ui.getByRole('button', { name: 'Gesetzte Ecken verschieben' }));
    const griff = ui.getByRole('button', { name: 'Dachrand Ecke 1 verschieben' }); pointer(griff, 'pointerdown', 100, 500); pointer(ui.bild, 'pointermove', 150, 450); act(() => ui.bereich.abbrechen!());
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('100'); pointer(griff, 'pointerdown', 100, 500, 1); pointer(ui.bild, 'pointermove', 300, 300, 1); pointer(ui.bild, 'pointerup', 300, 300, 1);
    expect(griff.querySelector('circle')!.getAttribute('cx')).toBe('100');
  });
});
