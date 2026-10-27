import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dreheFeld, modulEcken } from '@pv-belegung/engine';
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
  it('projiziert gedrehte Flachdachmodule in Editor und PDF auf dieselben Engine-Ecken', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const basis: Flaeche = { ...neueFlaeche(1, 'A'), art: 'flachdach', breiteM: 14, hoeheM: 12, neigungDeg: 0,
      flachdach: { aufstaenderung: 'ostwest', winkelDeg: 10 },
      foto: { dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', breitePx: 1200, hoehePx: 800, traufePx: null,
        eckenPx: [[100, 700], [1100, 650], [950, 100], [200, 120]] },
      felder: [dreheFeld({ xM: 3, yM: 3, breiteM: 6, hoeheM: 4, quer: true }, 15)],
    };
    const raster = rasterFuer(basis, modul);
    expect(raster.positionen.length).toBeGreaterThan(0);
    const h = homographie(14, 12, basis.foto!.eckenPx!, perspektiveQuelle(basis))!;
    const clipsVon = (druck: boolean) => {
      const html = renderToStaticMarkup(<DachSvg flaeche={basis} raster={raster} modul={modul} druck={druck} />);
      return [...html.matchAll(/<clipPath[^>]*><polygon points="([^"]+)"/g)].map(m => m[1]!.split(' ').map(paar => paar.split(',').map(Number)));
    };
    const editor = clipsVon(false), pdf = clipsVon(true);
    expect(pdf).toEqual(editor);
    raster.positionen.forEach((pos, i) => {
      for (const ecke of modulEcken(pos)) {
        const [x, y] = projiziere(h, ecke);
        expect([...editor[i * 2]!, ...editor[i * 2 + 1]!].some(p => Math.abs(p[0]! - x) < 1e-8 && Math.abs(p[1]! - y) < 1e-8)).toBe(true);
      }
    });
  });
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

  it('zeigt den orangefarbenen Vier-Ecken-Rahmen in der großen Fotoansicht, aber nicht im PDF', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const flaeche: Flaeche = {
      ...neueFlaeche(1, 'A'),
      breiteM: 13.6,
      hoeheM: 7,
      foto: {
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        breitePx: 1600,
        hoehePx: 900,
        traufePx: null,
        eckenPx: [[100, 800], [1500, 800], [1450, 100], [150, 100]],
      },
    };
    const raster = rasterFuer(flaeche, modul);

    const vorschau = renderToStaticMarkup(
      <DachSvg flaeche={flaeche} raster={raster} modul={modul} />,
    );
    const pdf = renderToStaticMarkup(
      <DachSvg flaeche={flaeche} raster={raster} modul={modul} druck />,
    );

    expect(vorschau).toContain('data-testid="dachflaechen-umriss"');
    expect(vorschau).toContain('stroke="#f97316"');
    expect(vorschau.match(/data-dach-ecke=/g)).toHaveLength(4);
    expect(pdf).not.toContain('data-testid="dachflaechen-umriss"');
    expect(pdf).not.toContain('data-dach-ecke=');
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


describe('Aktive Dachkontur aus gemessener Foto-Referenz', () => {
  it.each<{ name: string; umriss: [number, number][]; erwartetePunkte: [number, number][] }>([
    { name: 'Dreieck', umriss: [[0, 0], [10, 0], [0, 8]], erwartetePunkte: [[500, 100], [700, 300], [340, 260]] },
    { name: 'L-Dach', umriss: [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [0, 8]], erwartetePunkte: [[500, 100], [700, 300], [660, 340], [500, 180], [380, 300], [340, 260]] },
  ])('$name zeigt nur seine tatsächlichen Punkte und lässt den PDF-Druck unverändert', ({ umriss, erwartetePunkte }) => {
    const modul = modulById('jw-hd96n-r2-460');
    const flaeche: Flaeche = {
      ...neueFlaeche(1), breiteM: 10, hoeheM: 8, fotoBezugsrahmen: true, umrissM: umriss, felder: [],
      // x'=500+20(x-y), y'=100+20(x+y); der vierte Rahmenbereich liegt außerhalb des Fotos.
      foto: { dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', breitePx: 1000, hoehePx: 350, traufePx: null,
        eckenPx: [[340, 260], [540, 460], [700, 300], [500, 100]], perspektiveBestaetigt: true },
    };
    const raster = rasterFuer(flaeche, modul);
    const html = renderToStaticMarkup(<DachSvg flaeche={flaeche} raster={raster} modul={modul} />);
    const wert = html.match(/data-testid="dachflaechen-umriss"[^>]*points="([^"]+)"/)![1]!;
    const punkte = wert.split(' ').map(p => p.split(',').map(Number));
    expect(punkte).toHaveLength(erwartetePunkte.length);
    punkte.forEach((p, i) => { expect(p[0]).toBeCloseTo(erwartetePunkte[i]![0], 8); expect(p[1]).toBeCloseTo(erwartetePunkte[i]![1], 8); });
    expect(html.match(/data-dach-ecke=/g)).toHaveLength(erwartetePunkte.length);
    expect(html).not.toContain('data-testid="perspektiv-griffe"');
    const pdf = renderToStaticMarkup(<DachSvg flaeche={flaeche} raster={raster} modul={modul} druck />);
    expect(pdf).not.toContain('data-testid="dachflaechen-umriss"');
    expect(pdf).not.toContain('data-dach-ecke=');
  });
});

describe('Belegungsrahmen auf Dachkonturen', () => {
  it('begrenzt ungewählte Rahmen auf den echten Dachrand, erhält ausgewählte Griffe und verändert den Druck nicht', () => {
    const modul = modulById('jw-hd96n-r2-460');
    const f: Flaeche = { ...neueFlaeche(1), breiteM: 10, hoeheM: 8, fotoBezugsrahmen: true,
      umrissM: [[0, 8], [10, 8], [5, 0]],
      foto: { dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', breitePx: 1000, hoehePx: 900, traufePx: null, eckenPx: [[0, 800], [1000, 800], [1000, 0], [0, 0]] } };
    const rect = { xM: 0, yM: 0, breiteM: 10, hoeheM: 8, quer: false };
    const render = (ausgewaehlt: boolean, druck = false, flaeche = f) => renderToStaticMarkup(<DachSvg flaeche={flaeche} raster={rasterFuer(flaeche, modul)} modul={modul} felderAnzeige={[{ rect, ausgewaehlt }]} druck={druck} />);
    const ungewählt = render(false), gewählt = render(true);
    expect(ungewählt).toContain('data-feld-dachclip="true"');
    expect(ungewählt).toMatch(/clipPathUnits="userSpaceOnUse"/);
    expect(gewählt).not.toContain('data-feld-dachclip="true"');
    expect(gewählt.match(/data-feld-griff=/g)).toHaveLength(8);
    expect(render(false, false, { ...f, fotoBezugsrahmen: undefined })).not.toContain('data-feld-dachclip="true"');
    expect(render(false, true)).not.toContain('feld-dachkontur');
    expect(render(false, true)).toBe(render(true, true));
  });
});
