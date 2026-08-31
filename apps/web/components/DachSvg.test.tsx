import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { homographie, projiziere } from '../lib/foto-geometrie';
import {
  modulById,
  neueFlaeche,
  perspektiveQuelle,
  rahmenBreiteVon,
  rasterFuer,
  vollFeldFuer,
  type Flaeche,
} from '../lib/model';
import { DachSvg, moduleAufHomographie } from './DachSvg';

describe('DachSvg', () => {
  it('vergibt bei zwei Ansichten derselben Foto-Fläche eindeutige Clip-IDs', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis: Flaeche = {
      ...neueFlaeche(1, 'A'),
      breiteM: 13,
      hoeheM: 5.5,
      dachform: 'trapez',
      firstBreiteM: 4.6,
      ausrichtung: 'quer',
      foto: {
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 1200,
        hoehePx: 800,
        traufePx: null,
        eckenPx: [[150, 700], [1050, 680], [760, 180], [440, 190]],
      },
    };
    const feld = vollFeldFuer(basis, modul);
    const flaeche = { ...basis, felder: [feld] };
    const raster = rasterFuer(flaeche, modul);

    const html = renderToStaticMarkup(
      <>
        <DachSvg flaeche={flaeche} raster={raster} modul={modul} />
        <DachSvg flaeche={flaeche} raster={raster} modul={modul} />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]!);

    expect(ids).toHaveLength(raster.positionen.length * 2 * 2);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(html).toContain(`clip-path="url(#${id})"`);
  });

  it('verwendet bei starker Perspektive exakt die projizierten Modul-Fußabdrücke', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis: Flaeche = {
      ...neueFlaeche(1, 'A'),
      breiteM: 7,
      hoeheM: 9,
      ausrichtung: 'hoch',
      foto: {
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 320,
        hoehePx: 520,
        traufePx: null,
        // Entspricht dem gemeldeten stark konvergierenden Dachfoto.
        eckenPx: [[82, 480], [260, 480], [300, 38], [40, 36]],
      },
    };
    const flaeche = { ...basis, felder: [vollFeldFuer(basis, modul)] };
    const raster = rasterFuer(flaeche, modul);
    const html = renderToStaticMarkup(
      <DachSvg flaeche={flaeche} raster={raster} modul={modul} />,
    );
    const clips = [...html.matchAll(/<clipPath[^>]*><polygon points="([^"]+)"/g)].map((m) =>
      m[1]!.split(' ').map((paar) => paar.split(',').map(Number) as [number, number]),
    );
    const h = homographie(
      rahmenBreiteVon(flaeche),
      flaeche.hoeheM,
      flaeche.foto!.eckenPx!,
      perspektiveQuelle(flaeche),
    )!;

    expect(clips).toHaveLength(raster.positionen.length * 2);
    raster.positionen.forEach((p, i) => {
      const sichtbar = [...clips[i * 2]!, ...clips[i * 2 + 1]!];
      const ecken = [
        projiziere(h, [p.xM, p.yM]),
        projiziere(h, [p.xM + p.wM, p.yM]),
        projiziere(h, [p.xM + p.wM, p.yM + p.hM]),
        projiziere(h, [p.xM, p.yM + p.hM]),
      ];
      for (const [x, y] of ecken) {
        expect(
          sichtbar.some(([sx, sy]) => Math.abs(sx - x) < 1e-8 && Math.abs(sy - y) < 1e-8),
        ).toBe(true);
      }
    });
  });

  it('behält bei Gauben die eigene Vierpunkt-Perspektive exakt bei', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis: Flaeche = {
      ...neueFlaeche(1, 'A'),
      gaubenTyp: 'flachdach',
      breiteM: 3,
      hoeheM: 2.5,
      ausrichtung: 'hoch',
      foto: {
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 400,
        hoehePx: 400,
        traufePx: null,
        eckenPx: [[125, 260], [330, 260], [308, 60], [138, 60]],
      },
    };
    const flaeche = { ...basis, felder: [vollFeldFuer(basis, modul)] };
    const raster = rasterFuer(flaeche, modul);
    const html = renderToStaticMarkup(
      <DachSvg flaeche={flaeche} raster={raster} modul={modul} />,
    );

    // Gauben verwenden ein feines 6×10-Netz statt der zwei großen Dreiecke,
    // die in starker Perspektive einen sichtbaren Knick erzeugen.
    const clips = [...html.matchAll(/<clipPath[^>]*><polygon points="([^"]+)"/g)].map((m) =>
      m[1]!.split(' ').map((paar) => paar.split(',').map(Number)),
    );
    expect(clips).toHaveLength(raster.positionen.length * 6 * 10 * 2);
    expect(clips.every((punkte) => punkte.length === 3)).toBe(true);
  });

  it('reduziert die Gaubenmodule in der Bearbeitungsvorschau drastisch', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis: Flaeche = {
      ...neueFlaeche(1, 'A'),
      gaubenTyp: 'flachdach',
      breiteM: 3,
      hoeheM: 2.5,
      ausrichtung: 'hoch',
      foto: {
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 400,
        hoehePx: 400,
        traufePx: null,
        eckenPx: [[125, 260], [330, 260], [308, 60], [138, 60]],
      },
    };
    const flaeche = { ...basis, felder: [vollFeldFuer(basis, modul)] };
    const raster = rasterFuer(flaeche, modul);
    const h = homographie(
      rahmenBreiteVon(flaeche),
      flaeche.hoeheM,
      flaeche.foto!.eckenPx!,
      perspektiveQuelle(flaeche),
    )!;
    const render = (darstellung: 'vorschau' | 'kontur') => renderToStaticMarkup(
      <svg>
        {moduleAufHomographie({
          h,
          raster,
          flaeche,
          assetId: 'test-modul',
          fotoBreitePx: 400,
          clipIdPrefix: `test-${darstellung}`,
          darstellung,
        })}
      </svg>,
    );

    const vorschau = render('vorschau');
    const kontur = render('kontur');
    expect(vorschau.match(/<clipPath/g)).toHaveLength(raster.positionen.length * 2 * 3 * 2);
    expect(kontur).not.toContain('<clipPath');
    expect(kontur.match(/data-modul-darstellung="kontur"/g)).toHaveLength(raster.positionen.length);
  });

  it('legt Feldrahmen und Griffe über Hindernisse und gibt den Hindernissen keine Zeiger-Treffer', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis: Flaeche = {
      ...neueFlaeche(1, 'A'),
      breiteM: 10,
      hoeheM: 6,
      foto: {
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 1000,
        hoehePx: 600,
        traufePx: null,
        eckenPx: [[100, 550], [900, 550], [850, 50], [150, 50]],
      },
    };
    const feld = { xM: 2, yM: 1, breiteM: 5, hoeheM: 4, quer: false };
    const flaeche = {
      ...basis,
      felder: [feld],
      // Liegt auf der linken oberen Feldecke und damit direkt auf einem Griff.
      hindernisse: [{ xM: 1.5, yM: 0.5, breiteM: 1, hoeheM: 1 }],
    };
    const html = renderToStaticMarkup(
      <DachSvg
        flaeche={flaeche}
        raster={rasterFuer(flaeche, modul)}
        modul={modul}
        felderAnzeige={[{ rect: feld, ausgewaehlt: true }]}
        pointer={{ onDownM: () => undefined, onMoveM: () => undefined, onUpM: () => undefined }}
      />,
    );

    const hindernis = html.indexOf('fill="rgba(239,68,68,0.35)"');
    const feldOverlay = html.indexOf('data-testid="belegungsfeld-overlays"');
    expect(hindernis).toBeGreaterThan(-1);
    expect(feldOverlay).toBeGreaterThan(hindernis);
    expect(html.slice(hindernis, hindernis + 220)).toContain('pointer-events:none');
    expect(html.match(/data-feld-griff=/g)).toHaveLength(8);
  });

  it('bietet für die Zeichenfläche eine beschriftete Tastaturbedienung an', () => {
    const flaeche = neueFlaeche(1, 'A');
    const modul = modulById('jw-hd96n-r2-460');
    const html = renderToStaticMarkup(
      <DachSvg
        flaeche={flaeche}
        raster={rasterFuer(flaeche, modul)}
        modul={modul}
        tastatur={{ onPfeil: () => undefined, onEscape: () => undefined }}
      />,
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Belegungsfläche Dachfläche 1');
    expect(html).toContain('aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight');
  });
});
