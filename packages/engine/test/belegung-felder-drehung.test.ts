import { describe, expect, it } from 'vitest';
import {
  berechneFelderRaster, dreheFeld, feldDrehwinkel, feldEcken, feldPunkt,
  feldPunktLokal, flachdachMindestPitch, leerePositionen, modulEcken, normalisiereFeldDrehung,
  type BelegungsFeldM, type FelderInput,
} from '../src/belegung';
import { JOLYWOOD_JW_HD96N_R2_460 as modul } from '../src/catalog/modules';
import {
  konvexePolygoneUeberlappen, polygonImUmriss, polygonRahmen, polygonUeberlapptHindernis,
  punktInPolygon, rechteckeUeberlappen, type PunktM,
} from '../src/geometrie';

const dach: FelderInput = { breiteM: 30, hoeheM: 30, module: modul };
const feld: BelegungsFeldM = { xM: 5, yM: 5, breiteM: 4, hoeheM: 4, quer: false };
const abstand = (a: PunktM, b: PunktM) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('Feldrotation ohne Änderung der lokalen Zellidentität', () => {
  it('0°, 360° und fehlender Winkel erzeugen exakt die bisherigen Positionsobjekte', () => {
    const basis = berechneFelderRaster(dach, [feld]);
    expect(berechneFelderRaster(dach, [{ ...feld, drehungDeg: 0 }])).toEqual(basis);
    expect(berechneFelderRaster(dach, [{ ...feld, drehungDeg: 360 }])).toEqual(basis);
    expect(basis.positionen.every((p) => !('eckenM' in p))).toBe(true);
  });

  it.each([15, 90, 180, 270])('%d° erhält Mitte, Modulanzahl, Katalogmaße und Zellnummern', (winkel) => {
    const basis = berechneFelderRaster(dach, [feld]);
    const gedreht = dreheFeld(feld, winkel);
    const r = berechneFelderRaster(dach, [gedreht]);
    expect(feldPunkt(gedreht, [2, 2])).toEqual(feldPunkt(feld, [2, 2]));
    expect(r.positionen).toHaveLength(basis.positionen.length);
    r.positionen.forEach((p, i) => {
      const e = modulEcken(p);
      expect([p.row, p.col, p.feld]).toEqual([basis.positionen[i]!.row, basis.positionen[i]!.col, 0]);
      expect(p.xM).toBe(e[0][0]);
      expect(p.yM).toBe(e[0][1]);
      expect(p.wM).toBe(modul.widthMm / 1000);
      expect(p.hM).toBe(modul.lengthMm / 1000);
      expect(abstand(e[0], e[1])).toBeCloseTo(modul.widthMm / 1000, 12);
      expect(abstand(e[1], e[2])).toBeCloseTo(modul.lengthMm / 1000, 12);
    });
  });

  it('Vorwärts-/Rücktransformation und Drehgeste benutzen denselben Feldursprung', () => {
    const gedreht = dreheFeld(feld, 15);
    const p = feldPunktLokal(gedreht, feldPunkt(gedreht, [0.7, 3.1]));
    expect(p[0]).toBeCloseTo(0.7, 12);
    expect(p[1]).toBeCloseTo(3.1, 12);
    const mitte = feldPunkt(gedreht, [2, 2]);
    expect(feldDrehwinkel(gedreht, [mitte[0], mitte[1] - 2], [mitte[0] + 2, mitte[1]])).toBeCloseTo(105, 12);
    expect(feldEcken(gedreht)[2]).toEqual(feldPunkt(gedreht, [4, 4]));
  });

  it('Lücken bleiben beim Drehen, Verschieben und Zurückdrehen dieselben Zellen', () => {
    const mitLoch = { ...feld, leer: ['0-0', '1-2'] };
    const g = dreheFeld(mitLoch, 15);
    const verschoben = { ...g, xM: g.xM + 1, yM: g.yM + 2 };
    expect(verschoben.leer).toBe(mitLoch.leer);
    for (const f of [mitLoch, g, verschoben, dreheFeld(verschoben, 0)]) {
      const r = berechneFelderRaster(dach, [f]);
      expect(r.positionen.some((p) => p.row === 0 && p.col === 0)).toBe(false);
      expect(r.positionen.some((p) => p.row === 1 && p.col === 2)).toBe(false);
      const geister = leerePositionen(dach, [f]);
      expect(geister.map((p) => `${p.row}-${p.col}`)).toEqual(['0-0', '1-2']);
      if (f.drehungDeg) expect(geister.every((p) => p.eckenM)).toBe(true);
    }
  });

  it('Felder haben unabhängige Winkel; die zweite Gruppe bleibt unverändert', () => {
    const zwei = { ...feld, xM: 15, drehungDeg: 90 };
    const vorher = berechneFelderRaster(dach, [feld, zwei]);
    const nachher = berechneFelderRaster(dach, [dreheFeld(feld, 15), zwei]);
    expect(nachher.positionen.filter((p) => p.feld === 1)).toEqual(vorher.positionen.filter((p) => p.feld === 1));
  });

  it.each([NaN, Infinity, -Infinity])('ungültiger Winkel %s fällt deterministisch auf den Altstand zurück', (wert) => {
    expect(normalisiereFeldDrehung(wert)).toBe(0);
    expect(berechneFelderRaster(dach, [{ ...feld, drehungDeg: wert }])).toEqual(berechneFelderRaster(dach, [feld]));
  });

  it('negative Winkel werden normalisiert, ohne einen NaN-Punkt zu erzeugen', () => {
    expect(normalisiereFeldDrehung(-15)).toBe(345);
    expect(normalisiereFeldDrehung(725)).toBe(5);
    expect(dreheFeld(feld, -15).drehungDeg).toBe(345);
  });
});

describe('Gedrehte Modulpolygone statt achsparalleler Näherung', () => {
  const einModul: BelegungsFeldM = {
    xM: 4, yM: 4, breiteM: modul.widthMm / 1000,
    hoeheM: modul.lengthMm / 1000, quer: false, drehungDeg: 45,
  };

  it('überlappende Rahmen dürfen zwei tatsächlich getrennte Module nicht entfernen', () => {
    const zwei = { ...einModul, xM: 4.9, yM: 4.9 };
    const e1 = feldEcken(einModul), e2 = feldEcken(zwei);
    expect(rechteckeUeberlappen(polygonRahmen(e1), polygonRahmen(e2))).toBe(true);
    expect(konvexePolygoneUeberlappen(e1, e2)).toBe(false);
    expect(berechneFelderRaster(dach, [einModul, zwei]).positionen).toHaveLength(2);
  });

  it('echte Überlappung entfernt nur das spätere Feld, auch gemischt mit 0°', () => {
    const zwei = { ...einModul, xM: 4.1, yM: 4.1 };
    expect(berechneFelderRaster(dach, [einModul, zwei]).positionen.map((p) => p.feld)).toEqual([0]);
    const gerade = { ...einModul, xM: 3.6, yM: 4.1, drehungDeg: 0 };
    expect(berechneFelderRaster(dach, [gerade, einModul]).positionen.map((p) => p.feld)).toEqual([0]);
    expect(berechneFelderRaster(dach, [einModul, gerade]).positionen.map((p) => p.feld)).toEqual([0]);
  });

  it('Kantenberührung bleibt erlaubt, echte Schnittfläche wird gesperrt', () => {
    const e = feldEcken(einModul);
    const verschiebung = feldPunkt(einModul, [einModul.breiteM, 0]);
    const nachbar = { ...einModul, xM: verschiebung[0], yM: verschiebung[1] };
    expect(konvexePolygoneUeberlappen(e, feldEcken(nachbar))).toBe(false);
    expect(berechneFelderRaster(dach, [einModul, nachbar]).positionen).toHaveLength(2);
  });

  it('Lückengeister erscheinen nicht über einem tatsächlich überlappenden Modul', () => {
    const leer = { ...einModul, leer: ['0-0'] };
    expect(leerePositionen(dach, [leer, { ...einModul, xM: 4.1 }])).toHaveLength(0);
    expect(leerePositionen(dach, [leer, { ...einModul, xM: 4.9, yM: 4.9 }])).toHaveLength(1);
  });

  it('Dachrahmen und Randabstand prüfen alle gedrehten Ecken', () => {
    const raus = { ...einModul, xM: 0.5 };
    expect(berechneFelderRaster(dach, [raus]).positionen).toHaveLength(0);
    expect(berechneFelderRaster({ ...dach, randM: 3 }, [einModul]).positionen).toHaveLength(0);
    const drin = { ...einModul, xM: 5 };
    expect(berechneFelderRaster({ ...dach, randM: 3 }, [drin]).positionen).toHaveLength(1);
  });

  it('konkave Einbuchtung sperrt ein Modul trotz vier innen liegender Ecken und 0 m Rand', () => {
    const umriss: PunktM[] = [[0, 0], [3, 0], [3, 2.5], [3.2, 2.5], [3.2, 0], [10, 0], [10, 10], [0, 10]];
    const bruecke = { ...einModul, xM: 4, yM: 2, drehungDeg: 90 };
    const ecken = feldEcken(bruecke);
    expect(ecken.every((p) => punktInPolygon(p, umriss))).toBe(true);
    expect(polygonImUmriss(ecken, umriss, 0)).toBe(false);
    expect(berechneFelderRaster({ ...dach, umrissM: umriss }, [bruecke]).positionen).toHaveLength(0);
  });

  it.each([undefined, 0, 360])('auch Alt-/0°-/360°-Felder dürfen dieselbe konkave Einbuchtung nicht überbrücken (%s)', (drehungDeg) => {
    const umriss: PunktM[] = [[0, 0], [3, 0], [3, 2.5], [3.2, 2.5], [3.2, 0], [10, 0], [10, 10], [0, 10]];
    const bruecke: BelegungsFeldM = { xM: 2.5, yM: 2, breiteM: einModul.breiteM, hoeheM: einModul.hoeheM, quer: false,
      ...(drehungDeg === undefined ? {} : { drehungDeg }) };
    expect(feldEcken(bruecke).every((p) => punktInPolygon(p, umriss))).toBe(true);
    expect(berechneFelderRaster({ ...dach, umrissM: umriss }, [bruecke]).positionen).toHaveLength(0);
  });

  it('Abstand zur schrägen Dachkante wird als tatsächlicher Segmentabstand geprüft', () => {
    const umriss: PunktM[] = [[0, 0], [15, 0], [0, 15]];
    const nah = { ...einModul, xM: 7, yM: 6 };
    expect(polygonImUmriss(feldEcken(nah), umriss, 0)).toBe(true);
    expect(polygonImUmriss(feldEcken(nah), umriss, 0.5)).toBe(false);
    expect(berechneFelderRaster({ ...dach, umrissM: umriss, randM: 0.5 }, [nah]).positionen).toHaveLength(0);
  });

  it('Hindernis im Rahmen außerhalb des Moduls lässt es bestehen; echter Schnitt entfernt es', () => {
    const aussen = { xM: 2.8, yM: 4.05, breiteM: 0.1, hoeheM: 0.1 };
    const innen = { xM: 3.8, yM: 4.9, breiteM: 0.2, hoeheM: 0.2 };
    expect(polygonUeberlapptHindernis(feldEcken(einModul), aussen)).toBe(false);
    expect(polygonUeberlapptHindernis(feldEcken(einModul), innen)).toBe(true);
    expect(berechneFelderRaster({ ...dach, hindernisseM: [aussen] }, [einModul]).positionen).toHaveLength(1);
    expect(berechneFelderRaster({ ...dach, hindernisseM: [innen] }, [einModul]).positionen).toHaveLength(0);
  });

  it('freie Hinderniskontur, einschließlich konkavem U, zählt statt ihres Rahmens', () => {
    const modulE = [[2, 2], [3, 2], [3, 3], [2, 3]] as const;
    const umriss: PunktM[] = [[1, 1], [4, 1], [4, 4], [3.5, 4], [3.5, 1.5], [1.5, 1.5], [1.5, 4], [1, 4]];
    const h = { xM: 1, yM: 1, breiteM: 3, hoeheM: 3, umrissM: umriss };
    expect(polygonUeberlapptHindernis(modulE, h)).toBe(false);
    expect(polygonUeberlapptHindernis([[1.1, 2], [2, 2], [2, 3], [1.1, 3]], h)).toBe(true);
    expect(polygonUeberlapptHindernis(modulE, { ...h, umrissM: [...umriss].reverse() })).toBe(false);
  });
});

describe('Flachdachrotation erhält Aufständerung und Einzelkorrekturen', () => {
  it('Mindestabstand entspricht demselben realen Fußabdruck für Reihen und Paare', () => {
    const tiefe = modul.widthMm / 1000 * Math.cos(10 * Math.PI / 180);
    expect(flachdachMindestPitch(modul, { aufstaenderung: 'sued', winkelDeg: 10 })).toBeCloseTo(tiefe + 0.01, 12);
    expect(flachdachMindestPitch(modul, { aufstaenderung: 'ostwest', winkelDeg: 10 })).toBeCloseTo(2 * tiefe + 0.05, 12);
    expect(flachdachMindestPitch(modul, { aufstaenderung: 'ostwest', winkelDeg: 10, firstspaltM: 0.1 })).toBeCloseTo(2 * tiefe + 0.1, 12);
  });
  it.each(['ostwest', 'sued'] as const)('%s: 15° dreht nur den Fußabdruck, nicht Neigung, Pitch oder Zellidentität', (aufstaenderung) => {
    const input: FelderInput = { ...dach, montage: { aufstaenderung, winkelDeg: 10, pitchM: aufstaenderung === 'ostwest' ? 2.48 : 1.8 } };
    const f = { ...feld, breiteM: 5, hoeheM: 5, quer: true, leer: ['0-0'] };
    const vorher = berechneFelderRaster(input, [f]);
    const nachher = berechneFelderRaster(input, [dreheFeld(f, 15)]);
    expect(nachher.positionen).toHaveLength(vorher.positionen.length);
    nachher.positionen.forEach((p, i) => {
      const q = vorher.positionen[i]!;
      expect([p.row, p.col, p.seite, p.wM, p.hM]).toEqual([q.row, q.col, q.seite, q.wM, q.hM]);
      const e = modulEcken(p);
      expect(abstand(e[0], e[1])).toBeCloseTo(q.wM, 12);
      expect(abstand(e[1], e[2])).toBeCloseTo(q.hM, 12);
    });
    expect(leerePositionen(input, [dreheFeld(f, 15)])).toHaveLength(1);
  });
});
