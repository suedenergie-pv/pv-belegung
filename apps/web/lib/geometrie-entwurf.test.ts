import { neueFlaeche } from './model';
import { describe, expect, it } from 'vitest';
import { dreheFeld, feldPunkt } from '@pv-belegung/engine';
import { geometrieEntwurfAufStand } from './geometrie-entwurf';
import { neuesProjekt, modulById, vollFeldFuer, type Flaeche } from './model';

describe('Geometrieentwurf auf aktuellem Stand', () => {
  it('hält bei ungleichmäßiger Maßkorrektur die sichtbare Mitte gedrehter Felder und ihren Winkel', () => {
    const basis: Flaeche = { ...neuesProjekt().flaechen[0]!, breiteM: 10, hoeheM: 6,
      felder: [dreheFeld({ xM: 1, yM: 1, breiteM: 5, hoeheM: 3, quer: true, leer: ['0-0'] }, 35)],
    };
    const alt = basis.felder![0]!, mitte = feldPunkt(alt, [alt.breiteM / 2, alt.hoeheM / 2]);
    const neu = geometrieEntwurfAufStand(basis, { ...basis, breiteM: 20, hoeheM: 9 }, basis).felder![0]!;
    const ziel = feldPunkt(neu, [neu.breiteM / 2, neu.hoeheM / 2]);
    expect(ziel[0] / 20).toBeCloseTo(mitte[0] / 10, 10);
    expect(ziel[1] / 9).toBeCloseTo(mitte[1] / 6, 10);
    expect(neu.drehungDeg).toBe(35); expect(neu.leer).toEqual(['0-0']);
  });
  it('erhält entfernte Zellen und Feldwinkel beim Wechsel der Dachrichtung', () => {
    const basis: Flaeche = { ...neuesProjekt().flaechen[0]!, art: 'flachdach',
      flachdach: { aufstaenderung: 'ostwest', winkelDeg: 10, richtungSued: 'unten' },
      felder: [{ xM: 1, yM: 1, breiteM: 5, hoeheM: 4, quer: true, drehungDeg: 15, leer: ['0-0'] }],
    };
    for (const richtungSued of ['oben', 'rechts', 'links'] as const) {
      const neu = geometrieEntwurfAufStand(basis, { ...basis, flachdach: { ...basis.flachdach!, richtungSued } }, basis);
      expect(neu.felder).toEqual(basis.felder);
    }
  });
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

it('übernimmt Einsatzort und automatisch passenden Namen zusammen mit der Montage', () => {
  const basis = neueFlaeche(1, 'A');
  const entwurf = { ...basis, art: 'flachdach' as const, einsatzort: 'freiflaeche' as const, name: 'Freifläche 1', flachdach: { aufstaenderung: 'sued' as const, winkelDeg: 25, moduleInNeigung: 2, modulAusrichtung: 'hoch' as const } };
  const neu = geometrieEntwurfAufStand(basis, entwurf, basis);
  expect(neu.einsatzort).toBe('freiflaeche');expect(neu.name).toBe('Freifläche 1');
  expect(neu.flachdach).toEqual(entwurf.flachdach);
});
