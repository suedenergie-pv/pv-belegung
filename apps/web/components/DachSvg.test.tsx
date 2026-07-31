import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { modulById, neueFlaeche, rasterFuer, vollFeldFuer, type Flaeche } from '../lib/model';
import { DachSvg } from './DachSvg';

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

    // Bei einer echten Vierpunkt-Projektion ist mindestens ein Modul-Clip kein
    // Parallelogramm. Würde die Hauptdach-Glättung hier wieder greifen, wären
    // die Diagonalmittelpunkte identisch.
    const clips = [...html.matchAll(/<polygon points="([^"]+)"/g)].map((m) =>
      m[1]!.split(' ').map((paar) => paar.split(',').map(Number)),
    );
    expect(clips.length).toBeGreaterThanOrEqual(2);
    const [tl, tr, br] = clips[0]!;
    const bl = clips[1]![2]!;
    const diagonalenFehler = Math.hypot(
      tl![0]! + br![0]! - tr![0]! - bl[0]!,
      tl![1]! + br![1]! - tr![1]! - bl[1]!,
    );
    expect(diagonalenFehler).toBeGreaterThan(0.01);
  });
});
