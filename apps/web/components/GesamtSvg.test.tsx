import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { modulById, neuesProjekt, vollFeldFuer } from '../lib/model';
import { ProjektFotoSvg } from './GesamtSvg';

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
