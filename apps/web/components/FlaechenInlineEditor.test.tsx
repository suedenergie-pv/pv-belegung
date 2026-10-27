// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuesProjekt, vollFeldFuer, modulById, umrissVon, type Flaeche } from '../lib/model';
import { FlaechenInlineEditor } from './FlaechenInlineEditor';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function editor(bestand = false, vorgaben: Partial<Flaeche> = {}) {
  const projekt = neuesProjekt();
  const f = Object.assign(projekt.flaechen[0]!, vorgaben);
  if (bestand) {
    f.massStatus = 'bestand'; f.grunddatenFertig = true;
    f.felder = [{ ...vollFeldFuer(f, modulById(projekt.modulId)), leer: ['0-0'] }];
    f.fotoZuordnungen = [{ fotoId: 'bild', traufePx: null, perspektiveBestaetigt: true, markierungFertig: true, eckenPx: [[0,600],[1000,600],[1000,0],[0,0]] }];
  }
  const patch = vi.fn<(f: Partial<Flaeche>) => void>();
  const result = render(<FlaechenInlineEditor projekt={projekt} flaeche={f} index={0} onPatch={patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} />);
  if (bestand) fireEvent.click(result.getByRole('button', { name: 'Maße & Dachform' }));
  return { ...result, patch, f, projekt };
}
describe('Sichere Maßentwürfe', () => {
  it('überschreibt beim Übernehmen keine inzwischen geänderten Fotozuordnungen und Felder', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText(/^Breite unten/), { target: { value: '12' } });
    const frisch = { ...ui.f, fotoZuordnungen: [{ fotoId: 'ersatz', traufePx: null, perspektiveBestaetigt: false }], felder: [{ ...ui.f.felder![0]!, xM: 2 }] };
    ui.rerender(<FlaechenInlineEditor projekt={{ ...ui.projekt, flaechen: [frisch] }} flaeche={frisch} index={0} onPatch={ui.patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} />);
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    const neu = ui.patch.mock.calls[0]![0];
    expect(neu.fotoZuordnungen).toBe(frisch.fotoZuordnungen);
    expect(neu.felder![0]!.xM).toBeCloseTo(2.4);
  });

  it('öffnet Foto-Maßvorschläge ausschließlich als prüfbaren Entwurf', () => {
    const ui = editor(true);
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    ui.rerender(<FlaechenInlineEditor projekt={ui.projekt} flaeche={ui.f} index={0} onPatch={ui.patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} massVorschlag={{ breiteM: 9, hoeheM: 5 }} />);
    expect((ui.getByLabelText(/^Breite unten/) as HTMLInputElement).value).toBe('9');
    expect(ui.patch).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledWith(expect.objectContaining({ breiteM: 9, hoeheM: 5, massStatus: 'bestaetigt' }));
  });
  it('verlangt beide Maße ausdrücklich und bestätigt erst nach Übernehmen', () => {
    const ui = editor();
    expect((ui.getByLabelText(/^Breite unten/) as HTMLInputElement).value).toBe('');
    expect((ui.getByLabelText(/^Länge auf dem Dach/) as HTMLInputElement).value).toBe('');
    expect(ui.queryByText('Breite unten (Traufe) ist erforderlich.')).toBeNull();
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    const traufe = ui.getByLabelText(/^Breite unten/);
    expect(document.activeElement).toBe(traufe);
    expect(document.getElementById(traufe.getAttribute('aria-describedby')!)?.textContent).toBe('Breite unten (Traufe) ist erforderlich.');
    expect(ui.getByText('Länge auf dem Dach (Sparren) ist erforderlich.')).toBeTruthy();
    fireEvent.change(traufe, { target: { value: '10' } });
    expect(ui.queryByText('Breite unten (Traufe) ist erforderlich.')).toBeNull();
    expect(ui.getByText('Länge auf dem Dach (Sparren) ist erforderlich.')).toBeTruthy();
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    fireEvent.change(ui.getByLabelText(/^Länge auf dem Dach/), { target: { value: '6' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledWith(expect.objectContaining({ massStatus: 'bestaetigt', massEingabeOffen: false, breiteM: 10, hoeheM: 6 }));
  });
  it('hält den bestehenden Plan bei Änderung und Abbrechen vollständig unverändert', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText(/^Breite unten/), { target: { value: '12' } });
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.getByText(/Vorschau:/).textContent).toMatch(/Module/);
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.f.breiteM).toBe(10);
    expect(ui.f.felder![0]!.leer).toEqual(['0-0']);
  });
  it('übernimmt skalierte Geometrie und Bestätigung in genau einer Änderung', () => {
    const ui = editor(true);
    const breite = ui.f.felder![0]!.breiteM;
    fireEvent.change(ui.getByLabelText(/^Breite unten/), { target: { value: '12' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledTimes(1);
    const neu = ui.patch.mock.calls[0]![0];
    expect(neu.massStatus).toBe('bestaetigt');
    expect(neu.felder![0]!.breiteM).toBeCloseTo(breite * 1.2);
    expect(neu.felder![0]!.leer).toEqual(['0-0']);
  });
  it('verhindert Übernahme leerer Eingaben statt alte Zahlen unbemerkt zu bestätigen', () => {
    const ui = editor();
    fireEvent.change(ui.getByLabelText(/^Breite unten/), { target: { value: '' } });
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.getByRole('alert').textContent).toMatch(/korrigieren/);
  });
  it('zeigt Formwechsel samt Neukalibrierung als Vorschau und verwirft ihn sicher', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText(/^Breite oben/), { target: { value: '6' } });
    expect(ui.getByText(/Dachecken neu bestätigt/)).toBeTruthy();
    expect(ui.getByText(/Vorschau:/).textContent).toMatch(/→ 0 Module/);
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.f.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
  });
  it('meldet dem gemeinsamen Fotoeditor die reale Vorschau und räumt sie beim Abbrechen auf', () => {
    const projekt = neuesProjekt();
    const f = { ...projekt.flaechen[0]!, massStatus: 'bestaetigt' as const, grunddatenFertig: true };
    const onVorschau = vi.fn();
    const onSchliessen = vi.fn();
    const onPatch = vi.fn();
    const ui = render(<FlaechenInlineEditor projekt={projekt} flaeche={f} index={0} onPatch={onPatch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} kompakt initialOffen onVorschau={onVorschau} onSchliessen={onSchliessen} />);
    fireEvent.change(ui.getByLabelText(/^Breite unten/), { target: { value: '12' } });
    expect(onVorschau).toHaveBeenLastCalledWith(expect.objectContaining({ breiteM: 12 }));
    expect(onPatch).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }));
    expect(onVorschau).toHaveBeenLastCalledWith(null);
    expect(onSchliessen).toHaveBeenCalledOnce();
    expect(onPatch).not.toHaveBeenCalled();
  });
  it('zeigt übernommene Foto-Maßvorschläge auch dann, wenn sie den internen Startmaßen entsprechen', () => {
    const ui = editor();
    ui.rerender(<FlaechenInlineEditor projekt={ui.projekt} flaeche={ui.f} index={0} onPatch={ui.patch} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} massVorschlag={{ breiteM: 10, hoeheM: 6 }} />);
    expect((ui.getByLabelText(/^Breite unten/) as HTMLInputElement).value).toBe('10');
    expect((ui.getByLabelText(/^Länge auf dem Dach/) as HTMLInputElement).value).toBe('6');
    expect(ui.patch).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole('button', { name: 'Maße übernehmen' }));
    expect(ui.patch).toHaveBeenCalledOnce();
  });
  it('erhält Maße eines alten noch unbestätigten Projekts ohne neues Eingabekennzeichen', () => {
    const projekt = neuesProjekt();
    const flaeche = { ...projekt.flaechen[0]!, breiteM: 13, hoeheM: 7 };
    delete flaeche.massEingabeOffen;
    const ui = render(<FlaechenInlineEditor projekt={projekt} flaeche={flaeche} index={0} onPatch={vi.fn()} onProjektChange={vi.fn()} flaecheKwp={0} gesamtKwp={0} />);
    expect((ui.getByLabelText(/^Breite unten/) as HTMLInputElement).value).toBe('13');
    expect((ui.getByLabelText(/^Länge auf dem Dach/) as HTMLInputElement).value).toBe('7');
  });

});


describe('Große Trapezdächer beim Kundentermin', () => {
  for (const [traufe,first] of [[20,15.51],[28,20.5],[60,45]]) {
    for (const zuerst of ['first','traufe']) it(`${traufe} m Traufe, ${first} m First – zuerst ${zuerst}`, () => {
      const ui=editor(true);
      const firstFeld=ui.getByLabelText(/^Breite oben/) as HTMLInputElement;
      const traufFeld=ui.getByLabelText(/^Breite unten/);
      const firstEingeben=()=>fireEvent.change(firstFeld,{target:{value:String(first).replace('.',',')}});
      const traufeEingeben=()=>fireEvent.change(traufFeld,{target:{value:String(traufe)}});
      if(zuerst==='first'){firstEingeben(); traufeEingeben();}else{traufeEingeben();firstEingeben();}
      expect(firstFeld.getAttribute('aria-invalid')).toBe('false');
      fireEvent.click(ui.getByRole('button',{name:'Maße übernehmen'}));
      expect(ui.patch).toHaveBeenCalledOnce();
      expect(ui.patch.mock.calls[0]![0]).toMatchObject({breiteM:traufe, firstBreiteM:first, dachform:'trapez'});
    });
  }
});


it('benennt die Traufenlänge als Bezugsmaß und speichert keinen unpassenden First', () => {
  const ui=editor(true);
  fireEvent.change(ui.getByLabelText(/^Breite oben/),{target:{value:'15,51'}});
  expect(ui.getByText(/eingetragene Breite unten \(10 m\)/)).toBeTruthy();
  fireEvent.click(ui.getByRole('button',{name:'Maße übernehmen'}));
  expect(ui.patch).not.toHaveBeenCalled();
  expect((ui.getByLabelText(/^Breite oben/) as HTMLInputElement).value).toBe('15,51');
  fireEvent.change(ui.getByLabelText(/^Breite unten/),{target:{value:'20'}});
  fireEvent.click(ui.getByRole('button',{name:'Maße übernehmen'}));
  expect(ui.patch.mock.calls[0]![0]).toMatchObject({breiteM:20,firstBreiteM:15.51});
});


it('verwirft ein ungültiges oberes Maß mit „Oben genauso breit“, ohne die bestehende Belegung zurückzusetzen', () => {
  const ui = editor(true);
  fireEvent.change(ui.getByLabelText(/^Breite oben/), {target:{value:'25'}});
  fireEvent.click(ui.getByRole('button',{name:'Oben genauso breit'}));
  expect((ui.getByLabelText(/^Breite oben/) as HTMLInputElement).value).toBe('10');
  fireEvent.click(ui.getByRole('button',{name:'Maße übernehmen'}));
  const neu=ui.patch.mock.calls[0]![0];
  expect(neu.felder).toEqual(ui.f.felder);
  expect(neu.fotoZuordnungen).toEqual(ui.f.fotoZuordnungen);
});

it('benennt eine Fläche um, ohne Maßstab, Aussparungen oder Belegung zu verändern', () => {
  const ui=editor(true);
  fireEvent.change(ui.getByLabelText(/^Name der Fläche/), {target:{value:'Garage'}});
  fireEvent.click(ui.getByRole('button',{name:'Maße übernehmen'}));
  const neu=ui.patch.mock.calls[0]![0];
  expect(neu.name).toBe('Garage');
  expect(neu.felder).toEqual(ui.f.felder);
  expect(neu.fotoZuordnungen).toEqual(ui.f.fotoZuordnungen);
  expect(neu.breiteM).toBe(ui.f.breiteM);
});


describe('Asymmetrische Dächer ohne Formbegriffe', () => {
  for (const [seite, vorzeichen] of [['Links gerade', -1], ['Rechts gerade', 1]] as const) {
    it(`richtet ein 20-m-Dach mit 15,51-m-Oberkante über „${seite}“ tatsächlich bündig aus`, () => {
      const ui = editor(true);
      fireEvent.change(ui.getByLabelText(/^Breite unten/), {target:{value:'20'}});
      fireEvent.change(ui.getByLabelText(/^Breite oben/), {target:{value:'15,51'}});
      fireEvent.click(ui.getByRole('button', {name:seite}));
      expect(ui.getByRole('button', {name:seite}).getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(ui.getByRole('button', {name:'Maße übernehmen'}));
      const f = {...ui.f, ...ui.patch.mock.calls[0]![0]};
      expect(f.firstVersatzM).toBeCloseTo(vorzeichen * 2.245);
      const ring = umrissVon(f)!;
      if (vorzeichen < 0) expect(ring[0]![0]).toBeCloseTo(ring[3]![0]);
      else expect(ring[1]![0]).toBeCloseTo(ring[2]![0]);
      expect(f.firstBreiteM).toBe(15.51);
    });
  }

  for (const [seite, versatz] of [['Spitze links', -10], ['Mittig', 0], ['Spitze rechts', 10]] as const) {
    it(`richtet eine echte Dreiecksfläche mit „${seite}“ ein`, () => {
      const ui = editor(true);
      fireEvent.change(ui.getByLabelText(/^Breite unten/), {target:{value:'20'}});
      fireEvent.click(ui.getByRole('button', {name:'Oben läuft das Dach spitz zu'}));
      expect((ui.getByLabelText(/^Breite oben/) as HTMLInputElement).value).toBe('0');
      expect(ui.getByText('Bei einer Dachspitze ist die Breite oben 0 m.')).toBeTruthy();
      fireEvent.click(ui.getByRole('button', {name:seite}));
      fireEvent.click(ui.getByRole('button', {name:'Maße übernehmen'}));
      const f = {...ui.f, ...ui.patch.mock.calls[0]![0]};
      const ring = umrissVon(f)!;
      expect(ring).toHaveLength(3);
      expect(f.firstBreiteM).toBe(0);
      expect(f.firstVersatzM ?? 0).toBe(versatz);
      expect(ring[0]).toEqual([10 + versatz, 0]);
      expect(ring[1]).toEqual([20, 6]);
      expect(ring[2]).toEqual([0, 6]);
    });
  }

  it('hält die gewählte gerade Seite bei späteren Änderungen beider Breiten gerade', () => {
    const ui = editor(true);
    fireEvent.change(ui.getByLabelText(/^Breite unten/), {target:{value:'20'}});
    fireEvent.change(ui.getByLabelText(/^Breite oben/), {target:{value:'12'}});
    fireEvent.click(ui.getByRole('button', {name:'Links gerade'}));
    fireEvent.change(ui.getByLabelText(/^Breite unten/), {target:{value:'30'}});
    expect((ui.getByLabelText(/^Obere Mitte verschieben/) as HTMLInputElement).value).toBe('-9');
    fireEvent.change(ui.getByLabelText(/^Breite oben/), {target:{value:'20'}});
    expect(ui.getByRole('button', {name:'Links gerade'}).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(ui.getByRole('button', {name:'Maße übernehmen'}));
    expect(ui.patch.mock.calls[0]![0]).toMatchObject({breiteM:30,firstBreiteM:20,firstVersatzM:-5,dachform:'schief'});
  });

  it('zeigt vorhandene freie Verschiebung unverändert und verwirft einen Formversuch vollständig', () => {
    const ui = editor(true, {dachform:'schief',firstBreiteM:6,firstVersatzM:1.3});
    expect((ui.getByLabelText(/^Obere Mitte verschieben/) as HTMLInputElement).value).toBe('1.3');
    expect(ui.getByText(/Eigene seitliche Lage/)).toBeTruthy();
    fireEvent.click(ui.getByRole('button', {name:'Links gerade'}));
    fireEvent.click(ui.getByRole('button', {name:'Oben läuft das Dach spitz zu'}));
    fireEvent.click(ui.getByRole('button', {name:'Abbrechen'}));
    expect(ui.patch).not.toHaveBeenCalled();
    expect(ui.f.firstBreiteM).toBe(6);
    expect(ui.f.firstVersatzM).toBe(1.3);
    expect(ui.f.fotoZuordnungen![0]!.perspektiveBestaetigt).toBe(true);
  });

  it('erhält einen freien fünfteiligen Dachrand beim bloßen Bestätigen der Maße', () => {
    const umrissM: [number,number][] = [[0,6],[10,6],[10,2],[6,0],[0,3]];
    const ui = editor(true, {fotoBezugsrahmen:true,umrissM});
    expect((ui.getByLabelText(/^Gesamtbreite/) as HTMLInputElement).value).toBe('10');
    expect((ui.getByLabelText(/^Tiefe auf dem Dach/) as HTMLInputElement).value).toBe('6');
    expect(ui.queryByLabelText(/^Breite oben/)).toBeNull();
    expect(ui.queryByRole('button', {name:'Links gerade'})).toBeNull();
    expect(ui.queryByRole('button', {name:'Oben läuft das Dach spitz zu'})).toBeNull();
    fireEvent.click(ui.getByRole('button', {name:'Maße übernehmen'}));
    expect(ui.patch.mock.calls[0]![0].umrissM).toEqual(umrissM);
    expect(ui.patch.mock.calls[0]![0].fotoZuordnungen).toEqual(ui.f.fotoZuordnungen);
    expect(ui.patch.mock.calls[0]![0].felder).toEqual(ui.f.felder);
  });
});
