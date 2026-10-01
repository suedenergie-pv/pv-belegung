import { describe, expect, it } from 'vitest';
import { geometrieEntwurfAufStand } from './geometrie-entwurf';
import { neuesProjekt, modulById, vollFeldFuer, type Flaeche } from './model';

describe('Geometrieentwurf auf aktuellem Stand', () => {
  it('erhält nach Beginn ersetzte Fotos, verschobene Felder, Zelllöcher und neue Hindernisse', () => {
    const p = neuesProjekt();
    const basis = p.flaechen[0]!;
    const feld = vollFeldFuer(basis, modulById(p.modulId));
    const aktuell: Flaeche = { ...basis,
      fotoZuordnungen: [{ fotoId: 'ersatz', traufePx: null, perspektiveBestaetigt: false }],
      felder: [{ ...feld, xM: 2, leer: ['0-0'] }],
      hindernisse: [{ xM: 1, yM: 1, breiteM: 1, hoeheM: 1 }],
    };
    const neu = geometrieEntwurfAufStand(basis, { ...basis, breiteM: 12 }, aktuell);
    expect(neu.fotoZuordnungen).toBe(aktuell.fotoZuordnungen);
    expect(neu.felder![0]!.xM).toBeCloseTo(2.4);
    expect(neu.felder![0]!.leer).toEqual(['0-0']);
    expect(neu.hindernisse![0]!.breiteM).toBeCloseTo(1.2);
  });
  it('kehrt beim Zurücksetzen des Entwurfs zum aktuellen Plan statt einer alten Feldkopie zurück', () => {
    const basis = neuesProjekt().flaechen[0]!;
    const aktuell = { ...basis, felder: [{ xM: 2, yM: 1, breiteM: 4, hoeheM: 3, quer: false }] };
    expect(geometrieEntwurfAufStand(basis, basis, aktuell).felder).toBe(aktuell.felder);
  });
  it('fordert bei Formwechsel Neukalibrierung der aktuellen Fotos ohne gelöschte Fotos zurückzuholen', () => {
    const basis = neuesProjekt().flaechen[0]!;
    const aktuell: Flaeche = { ...basis, fotoZuordnungen: [{ fotoId: 'neues-bild', traufePx: null, perspektiveBestaetigt: true }] };
    const neu = geometrieEntwurfAufStand(basis, { ...basis, dachform: 'trapez', firstBreiteM: 6 }, aktuell);
    expect(neu.fotoZuordnungen).toEqual([{ fotoId: 'neues-bild', traufePx: null, perspektiveBestaetigt: false, markierungFertig: false }]);
  });
});
