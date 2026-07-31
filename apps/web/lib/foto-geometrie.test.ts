import { describe, expect, it } from 'vitest';
import { belegungsCheck, verschiebeFotoPunkt, type Ecken } from './foto-geometrie';

const quadrat: Ecken = [
  [0, 100],
  [100, 100],
  [100, 0],
  [0, 0],
];

describe('Belegungs-Check für unterschiedliche Flächenarten', () => {
  it('misst eine frontal fotografierte Fassade ohne cos(90°)-Explosion', () => {
    const check = belegungsCheck(quadrat, 10, 10, 90, 10, 1, 'fassade');
    expect(check.vorschlag).toEqual({ breiteM: 10, hoeheM: 10 });
    expect(check.status).toBe('ok');
    expect(check.meldungen.join(' ')).not.toContain('Sparrenlänge');
  });

  it('verwendet beim Flachdach neutrale Maßbegriffe', () => {
    const check = belegungsCheck(quadrat, 8, 8, 0, 10, 1, 'flachdach');
    expect(check.status).toBe('warnung');
    expect(check.meldungen.join(' ')).toContain('Breite im Foto');
    expect(check.meldungen.join(' ')).toContain('Tiefe laut Foto');
    expect(check.meldungen.join(' ')).not.toContain('Traufe');
  });
});

describe('Tablet-Fadenkreuz', () => {
  it('bewegt relativ und klemmt sicher an allen Fotorändern', () => {
    expect(verschiebeFotoPunkt([50, 40], 15, -10, 100, 80)).toEqual([65, 30]);
    expect(verschiebeFotoPunkt([5, 75], -20, 30, 100, 80)).toEqual([0, 80]);
  });
});
