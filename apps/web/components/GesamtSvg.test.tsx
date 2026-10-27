import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer } from '../lib/model';
import { fotoFlaechenInhalt, ProjektFotoSvg } from './GesamtSvg';

describe('ProjektFotoSvg', () => {
  it('zeigt den Dachflächenrahmen nur in der Vorschau und nicht im PDF', () => {
    const projekt = neuesProjekt();
    const foto = {
      id: 'foto-1',
      name: 'Dachfoto',
      dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      breitePx: 1000,
      hoehePx: 600,
    };
    projekt.fotos = [foto];
    const flaeche = projekt.flaechen[0]!;
    flaeche.felder = [vollFeldFuer(flaeche, modulById(projekt.modulId))];
    flaeche.fotoZuordnungen = [{
      fotoId: foto.id,
      traufePx: null,
      eckenPx: [[100, 550], [900, 550], [850, 50], [150, 50]],
      perspektiveBestaetigt: true,
      markierungFertig: true,
    }];

    const vorschau = renderToStaticMarkup(
      <ProjektFotoSvg projekt={projekt} foto={foto} beschriftung />,
    );
    const pdf = renderToStaticMarkup(
      <ProjektFotoSvg projekt={projekt} foto={foto} nurFertige />,
    );

    expect(vorschau).toContain('data-testid="dachflaechen-rahmen"');
    expect(vorschau).toContain('data-dachflaeche="p1"');
    expect(vorschau).toContain('stroke="#fb923c"');
    expect(pdf).not.toContain('data-testid="dachflaechen-rahmen"');
    expect(pdf).not.toContain('data-testid="belegungsfeld-overlays"');
  });
});


describe('Echte Dachkonturen anderer Flächen auf dem Foto', () => {
  it.each<{ name: string; umriss: [number, number][]; erwartetePunkte: [number, number][] }>([
    { name: 'Dreieck', umriss: [[0, 0], [10, 0], [0, 8]], erwartetePunkte: [[500, 100], [700, 300], [340, 260]] },
    { name: 'L-Dach', umriss: [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [0, 8]], erwartetePunkte: [[500, 100], [700, 300], [660, 340], [500, 180], [380, 300], [340, 260]] },
  ])('$name verwendet den Dachrand statt des virtuellen Rechtecks', ({ umriss, erwartetePunkte }) => {
    const projekt = neuesProjekt();
    const foto = { id: 'kontur-foto', name: 'Prüffoto', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', breitePx: 1000, hoehePx: 350 };
    projekt.fotos = [foto];
    projekt.flaechen[0] = {
      ...projekt.flaechen[0]!, breiteM: 10, hoeheM: 8, fotoBezugsrahmen: true, umrissM: umriss, felder: [],
      // Unabhängig vorgegeben: x'=500+20(x-y), y'=100+20(x+y).
      // Der virtuelle Punkt (540,460) liegt außerhalb des Fotos und gehört nicht zum Dachrand.
      fotoZuordnungen: [{ fotoId: foto.id, traufePx: null, eckenPx: [[340, 260], [540, 460], [700, 300], [500, 100]], markierungFertig: true, perspektiveBestaetigt: true }],
    };
    const vorschau = renderToStaticMarkup(<ProjektFotoSvg projekt={projekt} foto={foto} beschriftung />);
    const wert = vorschau.match(/data-testid="dachflaechen-rahmen"[^>]*points="([^"]+)"/)![1]!;
    const punkte = wert.split(' ').map(p => p.split(',').map(Number));
    expect(punkte).toHaveLength(erwartetePunkte.length);
    punkte.forEach((p, i) => { expect(p[0]).toBeCloseTo(erwartetePunkte[i]![0], 8); expect(p[1]).toBeCloseTo(erwartetePunkte[i]![1], 8); });
    expect(vorschau).toContain('data-dachflaeche="p1"');
    const pdf = renderToStaticMarkup(<ProjektFotoSvg projekt={projekt} foto={foto} beschriftung={false} nurFertige />);
    expect(pdf).not.toContain('data-testid="dachflaechen-rahmen"');
    expect(pdf).not.toContain('stroke="#fb923c"');
  });
});


describe('Keine doppelten Flächenmarken im Editor', () => {
  it('behält inaktive Dachkonturen, zeigt die großen SVG-Badges aber nur in der reinen Übersicht', () => {
    const projekt = neuesProjekt();
    const foto = { id: 'gemeinsam', name: 'Gemeinsames Foto', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', breitePx: 1000, hoehePx: 600 };
    projekt.fotos = [foto];
    const basis = {
      ...projekt.flaechen[0]!, felder: [],
      fotoZuordnungen: [{ fotoId: foto.id, traufePx: null, eckenPx: [[100, 550], [900, 550], [900, 50], [100, 50]] as [[number, number], [number, number], [number, number], [number, number]], markierungFertig: true }],
    };
    projekt.flaechen = [{ ...basis, id: 'p1', zone: 'A' }, { ...basis, id: 'p2', zone: 'B' }];
    const editor = renderToStaticMarkup(<svg>{fotoFlaechenInhalt({ projekt, foto, ausblendenId: 'p2', beschriftung: true, clipIdPrefix: 'editor-test' })}</svg>);
    expect(editor).toContain('data-testid="dachflaechen-rahmen"');
    expect(editor).toContain('data-dachflaeche="p1"');
    expect(editor).not.toContain('data-dachflaeche="p2"');
    expect(editor).not.toContain('<circle');
    expect(editor).not.toContain('<text');
    const uebersicht = renderToStaticMarkup(<ProjektFotoSvg projekt={projekt} foto={foto} beschriftung />);
    expect(uebersicht.match(/<circle/g)).toHaveLength(2);
    expect(uebersicht).toContain('>A</text>');
    expect(uebersicht).toContain('>B</text>');
    const pdf = renderToStaticMarkup(<ProjektFotoSvg projekt={projekt} foto={foto} beschriftung={false} nurFertige />);
    expect(pdf).not.toContain('data-testid="dachflaechen-rahmen"');
    expect(pdf).not.toContain('<circle');
  });
});
