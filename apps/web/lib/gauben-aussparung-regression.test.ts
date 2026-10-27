import { describe, expect, it } from 'vitest';
import { feldEcken, polygonUeberlapptHindernis, type BelegungsFeldM } from '@pv-belegung/engine';
import { homographie, projiziere, type Ecken, type Punkt } from './foto-geometrie';
import { gaubenAussparungAusFoto, satteldachSeitenEcken, synchronisiereGaubenKontur } from './gauben-geometrie';
import { gaubenFotoUmriss } from './gauben-umriss';
import { migriereProjekt, modulById, neueGaubenFlaeche, neuesProjekt, rasterFuer, type Flaeche, type GaubenTyp } from './model';

const fotoEcken: Ecken = [[120, 1050], [1400, 900], [1250, 100], [240, 230]];
const modul = modulById(neuesProjekt().modulId);
const einModul = (xM: number, yM: number): BelegungsFeldM => ({ xM, yM, breiteM: modul.lengthMm / 1000, hoeheM: modul.widthMm / 1000, quer: true });
const drehe = ([x, y]: Punkt, winkel: number, mitte: Punkt = [8, 6]): Punkt => {
  const a = winkel * Math.PI / 180, dx = x - mitte[0], dy = y - mitte[1];
  return [mitte[0] + dx * Math.cos(a) - dy * Math.sin(a), mitte[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};

function projektMitGaube(typ: GaubenTyp, kontur: Ecken, fotoDrehung: number) {
  const projekt = neuesProjekt();
  const gedrehteFotoEcken = fotoEcken.map(p => drehe(p, fotoDrehung, [800, 600])) as Ecken;
  const parent: Flaeche = { ...projekt.flaechen[0]!, breiteM: 16, hoeheM: 12, randM: 0, fotoZuordnungen: [
    { fotoId: 'dachfoto', traufePx: null, eckenPx: gedrehteFotoEcken, perspektiveBestaetigt: true, markierungFertig: true },
  ] };
  const foto = { id: 'dachfoto', name: 'Testfoto', dataUrl: 'data:image/png;base64,test', breitePx: 1800, hoehePx: 1600 };
  const h = homographie(16, 12, gedrehteFotoEcken)!;
  const gaubenEcken = kontur.map(p => projiziere(h, p)) as Ecken;
  const kind = { ...neueGaubenFlaeche(2, 'B', typ, parent.id, undefined, 'gaube'),
    fotoZuordnungen: [{ fotoId: foto.id, traufePx: null, eckenPx: gaubenEcken, perspektiveBestaetigt: true, markierungFertig: true }],
  };
  const rechteck = gaubenAussparungAusFoto({ ...parent, foto: { ...foto, ...parent.fotoZuordnungen![0]! } }, gaubenEcken)!;
  parent.gaubenAussparungen = [{ gaubenGruppeId: 'gaube', fotoId: foto.id, fotoEckenPx: gaubenEcken, rechteck }];
  return synchronisiereGaubenKontur({ ...projekt, fotos: [foto], flaechen: [parent, kind], fotoModellVersion: 3 }, 'gaube');
}

describe('Gauben-Aussparung im vollständigen Foto- und Belegungsweg', () => {
  const faelle = (['flachdach', 'schleppdach'] as const).flatMap(typ => [0, 37, 90, 180, 270].map(fotoDrehung => ({ typ, fotoDrehung })));
  it.each(faelle)('$typ im um $fotoDrehung° gedrehten Foto: freies Modul innerhalb des Gaubenrahmens bleibt', ({ typ, fotoDrehung }) => {
    const projekt = projektMitGaube(typ, [[5, 8], [10, 6], [8, 2], [3, 4]], fotoDrehung);
    const parent = projekt.flaechen[0]!;
    const frei = einModul(3, 2), gesperrt = einModul(5, 4);
    // Das erste Modul liegt innerhalb des umschließenden Rechtecks, aber außerhalb der echten Kontur.
    expect(rasterFuer({ ...parent, felder: [frei, gesperrt] }, modul).positionen.map(p => p.feld)).toEqual([0]);
    const geladen = migriereProjekt(JSON.parse(JSON.stringify(projekt)));
    expect(rasterFuer({ ...geladen.flaechen[0]!, felder: [frei, gesperrt] }, modul).positionen.map(p => p.feld)).toEqual([0]);
  });

  it.each([0, 15, 45, 90, 180, 270])('Gaube und Feld um %d° gedreht: hintere Kantenberührung bleibt, 1 mm Überlappung sperrt', winkel => {
    const kontur = ([[5, 8], [10, 8], [10, 4], [5, 4]] as Ecken).map(p => drehe(p, winkel)) as Ecken;
    const projekt = projektMitGaube('schleppdach', kontur, 37);
    const parent = projekt.flaechen[0]!;
    const anHinterkante = einModul(6, 4 - modul.widthMm / 1000);
    const feld = (ueberlappung: number) => {
      const ursprung = drehe([anHinterkante.xM, anHinterkante.yM + ueberlappung], winkel);
      return { ...anHinterkante, xM: ursprung[0], yM: ursprung[1], drehungDeg: winkel };
    };
    const h = parent.gaubenAussparungen![0]!.rechteck;
    expect(polygonUeberlapptHindernis(feldEcken(feld(0)), h)).toBe(false);
    expect(rasterFuer({ ...parent, felder: [feld(0)] }, modul).positionen).toHaveLength(1);
    expect(rasterFuer({ ...parent, felder: [feld(.001)] }, modul).positionen).toHaveLength(0);
  });

  it.each([0, 37, 90, 180, 270])('Sattelgaube im um %d° gedrehten Foto sperrt beide Dachseiten, aber nicht die freie Ecke an der Firstspitze', fotoDrehung => {
    const projekt = projektMitGaube('satteldach', [[4, 8], [12, 8], [12, 4], [4, 4]], fotoDrehung);
    const parent = projekt.flaechen[0]!;
    const foto = { ...projekt.fotos[0]!, ...parent.fotoZuordnungen![0]! };
    const h = homographie(16, 12, foto.eckenPx!)!;
    const aussen = parent.gaubenAussparungen![0]!.fotoEckenPx!;
    const first = ([[8, 2], [8, 7]] as [Punkt, Punkt]).map(p => projiziere(h, p)) as [Punkt, Punkt];
    const seiten = satteldachSeitenEcken(aussen, first, { ...parent, foto })!;
    const kontur = gaubenFotoUmriss(aussen, seiten);
    expect(kontur).toHaveLength(6);
    const rechteck = gaubenAussparungAusFoto({ ...parent, foto }, kontur)!;
    parent.gaubenAussparungen = [{ gaubenGruppeId: 'gaube', fotoId: foto.id, fotoEckenPx: aussen, fotoUmrissPx: kontur, rechteck }];
    const frei = einModul(7, 7.5), links = einModul(5, 5), rechts = einModul(9, 5), hinterFirst = einModul(7, 2.9);
    expect(rasterFuer({ ...parent, felder: [frei, links, rechts, hinterFirst] }, modul).positionen.map(p => p.feld)).toEqual([0]);
  });

  it.each(['flachdach', 'schleppdach', 'walmdach', 'spitzdach'] as const)('%s: alter Rechteckrahmen ohne Eltern-Fotopunkte wird aus der Kindkontur repariert', typ => {
    const projekt = projektMitGaube(typ, [[5, 8], [10, 6], [8, 2], [3, 4]], 37);
    const parent = projekt.flaechen[0]!;
    const a = parent.gaubenAussparungen![0]!;
    // Frühe Projektdateien besitzen nur den Rahmen; die eigene Foto-Zuordnung der Gaube bleibt erhalten.
    const { umrissM: _kontur, ...rechteck } = a.rechteck;
    parent.gaubenAussparungen = [{ gaubenGruppeId: a.gaubenGruppeId, rechteck }];
    const geladen = migriereProjekt(JSON.parse(JSON.stringify(projekt)));
    expect(geladen.flaechen[0]!.gaubenAussparungen![0]!.rechteck.umrissM).toHaveLength(4);
    expect(rasterFuer({ ...geladen.flaechen[0]!, felder: [einModul(3, 2)] }, modul).positionen).toHaveLength(1);
    expect(migriereProjekt(JSON.parse(JSON.stringify(geladen)))).toEqual(geladen);
  });

  it.each(['walmdach', 'spitzdach'] as const)('%s: Migration erhält den tatsächlichen Umriss innerhalb der vier Fotopunkte', typ => {
    let projekt = projektMitGaube(typ, [[5, 8], [10, 6], [8, 2], [3, 4]], 37);
    Object.assign(projekt.flaechen[1]!, { breiteM: 8, hoeheM: 4, dachform: 'trapez', firstBreiteM: typ === 'spitzdach' ? 0 : 3, fotoBezugsrahmen: true });
    projekt = synchronisiereGaubenKontur(projekt, 'gaube');
    const parent = projekt.flaechen[0]!, a = parent.gaubenAussparungen![0]!;
    const erwartet = structuredClone(a.rechteck.umrissM);
    const { umrissM: _kontur, ...rechteck } = a.rechteck;
    parent.gaubenAussparungen = [{ gaubenGruppeId: a.gaubenGruppeId, rechteck }];
    const geladen = migriereProjekt(JSON.parse(JSON.stringify(projekt)));
    expect(geladen.flaechen[0]!.gaubenAussparungen![0]!.rechteck.umrissM).toEqual(erwartet);
    expect(erwartet).toHaveLength(typ === 'spitzdach' ? 3 : 4);
  });

  it.each([false, true])('gelöschte Satteldach-Teilfläche verkleinert die Aussparung nicht auf die übrig gebliebene Seite (gespeicherter Außenrand: %s)', mitAussenrand => {
    const projekt = projektMitGaube('satteldach', [[4, 8], [12, 8], [12, 4], [4, 4]], 37);
    const parent = projekt.flaechen[0]!, a = parent.gaubenAussparungen![0]!;
    // Die rechte Teilfläche wurde gelöscht, die vollständige Kontur ist optional noch gespeichert.
    const foto = { ...projekt.fotos[0]!, ...parent.fotoZuordnungen![0]! };
    const h = homographie(16, 12, foto.eckenPx!)!;
    const links = ([[4, 8], [8, 8], [8, 4], [4, 4]] as Ecken).map(p => projiziere(h, p)) as Ecken;
    Object.assign(projekt.flaechen[1]!, { gaubenSeite: 'links', fotoZuordnungen: [
      { fotoId: foto.id, traufePx: null, eckenPx: links, perspektiveBestaetigt: true, markierungFertig: true },
    ] });
    const { umrissM: _kontur, ...rechteck } = a.rechteck;
    parent.gaubenAussparungen = [{ gaubenGruppeId: a.gaubenGruppeId, rechteck, ...(mitAussenrand ? { fotoEckenPx: a.fotoEckenPx, fotoId: foto.id } : {}) }];
    const geladen = migriereProjekt(JSON.parse(JSON.stringify(projekt)));
    const rechtsGesperrt = einModul(9, 5);
    expect(rasterFuer({ ...geladen.flaechen[0]!, felder: [rechtsGesperrt] }, modul).positionen).toHaveLength(0);
    if (!mitAussenrand) expect(geladen.flaechen[0]!.gaubenAussparungen).toEqual(parent.gaubenAussparungen);
  });
});
