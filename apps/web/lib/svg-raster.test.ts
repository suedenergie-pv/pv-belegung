// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ladeBildMitTimeout, svgMarkupAlsDataUrl } from './svg-raster';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SVG-Raster-Helfer', () => {
  it('kodiert auch Umlaute ohne Blob-URL als SVG-Data-URL', () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><text>Süd</text></svg>';
    const url = svgMarkupAlsDataUrl(markup);
    const dekodiert = new TextDecoder().decode(
      Uint8Array.from(atob(url.split(',')[1]!), (zeichen) => zeichen.charCodeAt(0)),
    );
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(dekodiert).toBe(markup);
  });

  it('beendet eine ausbleibende Bilddekodierung mit einem sichtbaren Fehler', async () => {
    vi.useFakeTimers();
    class HaengendesBild {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
    }
    vi.stubGlobal('Image', HaengendesBild);

    const laden = ladeBildMitTimeout('data:image/svg+xml;base64,PHN2Zy8+', 'Testfehler', 50);
    const abweisung = expect(laden).rejects.toThrow('Testfehler (Zeitüberschreitung)');
    await vi.advanceTimersByTimeAsync(50);

    await abweisung;
  });
});
