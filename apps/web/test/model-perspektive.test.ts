import { describe, expect, it } from 'vitest';
import { neueFlaeche, perspektiveQuelle, type Flaeche } from '../lib/model';

describe('Foto-Perspektive bleibt beim Zeichnen des Umrisses stabil', () => {
  const mitUmriss = (flaeche: Flaeche): Flaeche => ({
    ...flaeche,
    umrissM: [[0.4, 5.8], [9.6, 5.8], [7.1, 0.3], [2.9, 0.3]],
  });

  it('behält bei einem Trapez dieselben Homographie-Quellpunkte', () => {
    const flaeche: Flaeche = {
      ...neueFlaeche(1),
      dachform: 'trapez',
      breiteM: 10,
      hoeheM: 6,
      firstBreiteM: 4,
    };

    expect(perspektiveQuelle(mitUmriss(flaeche))).toEqual(perspektiveQuelle(flaeche));
  });

  it('behält bei einer schiefen Fläche dieselben Homographie-Quellpunkte', () => {
    const flaeche: Flaeche = {
      ...neueFlaeche(1),
      dachform: 'schief',
      breiteM: 8,
      hoeheM: 6,
      firstBreiteM: 8,
      firstVersatzM: 2,
    };

    expect(perspektiveQuelle(mitUmriss(flaeche))).toEqual(perspektiveQuelle(flaeche));
  });
});
