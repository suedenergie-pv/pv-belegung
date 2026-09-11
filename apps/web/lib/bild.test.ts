// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOTO_SCHRITT_TIMEOUT_MS, MAX_FOTO_BYTES, dateiZuBild } from './bild';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Foto-Upload-Prüfung', () => {
  it('weist nicht unterstützte Dateitypen verständlich zurück', async () => {
    const datei = new File(['kein bild'], 'dach.pdf', { type: 'application/pdf' });
    await expect(dateiZuBild(datei)).rejects.toThrow('JPG, PNG oder WebP');
  });

  it('weist leere und zu große Bilddateien vor der Verarbeitung zurück', async () => {
    const leer = new File([], 'leer.jpg', { type: 'image/jpeg' });
    await expect(dateiZuBild(leer)).rejects.toThrow('Bilddatei ist leer');

    const gross = new File([new Uint8Array(MAX_FOTO_BYTES + 1)], 'gross.jpg', {
      type: 'image/jpeg',
    });
    await expect(dateiZuBild(gross)).rejects.toThrow('größer als 20 MB');
  });

  it('beendet einen festhängenden Dateiimport mit einer verständlichen Meldung', async () => {
    vi.useFakeTimers();
    class HaengenderReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      readAsDataURL() {}
      abort() {}
    }
    vi.stubGlobal('FileReader', HaengenderReader);
    const laden = dateiZuBild(new File(['bild'], 'dach.jpg', { type: 'image/jpeg' }));
    const abweisung = expect(laden).rejects.toThrow('Einlesen des Fotos dauert zu lange');

    await vi.advanceTimersByTimeAsync(FOTO_SCHRITT_TIMEOUT_MS);

    await abweisung;
  });
});

