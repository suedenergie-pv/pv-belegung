// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_FOTO_BYTES, dateiZuBild } from './bild';

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
});

