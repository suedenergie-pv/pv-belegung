import { describe, expect, it } from 'vitest';
import { bildRahmen, begrenzeAnsicht, transformiereAnsicht } from './editor-ansicht';

describe('Reine Fotoansicht', () => {
  it('passt queres und hohes Foto ohne Verzerrung in den verfügbaren Raum', () => {
    expect(bildRahmen(1000, 600, 2)).toEqual({ breite: 1000, hoehe: 600, bildBreite: 1000, bildHoehe: 500 });
    expect(bildRahmen(1000, 600, .5)).toEqual({ breite: 1000, hoehe: 600, bildBreite: 300, bildHoehe: 600 });
    expect(begrenzeAnsicht({ zoom: Infinity, x: NaN, y: 999 })).toEqual({ zoom: 1, x: 0, y: .45 });
  });
  it('hält denselben Fotopunkt unter dem wandernden Pinchmittelpunkt', () => {
    const r = bildRahmen(1000, 600, 2);
    const alt = { zoom: 1.5, x: .1, y: -.1 };
    const von = { x: 700, y: 200 }; const nach = { x: 680, y: 240 };
    const neu = transformiereAnsicht(alt, r, von, nach, 2.5);
    const fotoAlt = [(von.x - 500 - alt.x * r.bildBreite) / alt.zoom, (von.y - 300 - alt.y * r.bildHoehe) / alt.zoom];
    const fotoNeu = [(nach.x - 500 - neu.x * r.bildBreite) / neu.zoom, (nach.y - 300 - neu.y * r.bildHoehe) / neu.zoom];
    expect(fotoNeu[0]).toBeCloseTo(fotoAlt[0]!); expect(fotoNeu[1]).toBeCloseTo(fotoAlt[1]!);
  });
});
