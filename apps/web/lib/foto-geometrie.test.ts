import { describe, expect, it } from 'vitest';
import { belegungsCheck, type Ecken } from './foto-geometrie';

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
