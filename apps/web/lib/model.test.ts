import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bauePayload,
  belegteFlaechenOhneFoto,
  downloadDateiname,
  eintragListenName,
  fertigeFotoFlaechen,
  fotoZuordnungenVon,
  felderInput,
  flaecheM2,
  flachdachOstRichtung,
  flachdachRichtungsLabel,
  migriereProjekt,
  migriereWorkflowSchritt,
  modulById,
  neueFlaeche,
  neuesProjekt,
  patchFlaechenGeometrie,
  perspektiveQuelle,
  projektFreigabe,
  zonenLabel,
} from './model';

describe('Export-Geometrie und Modulausrichtung', () => {
  it('nummeriert gleichnamige Projekte und zeigt ihre Änderungszeit', () => {
    const projekt = neuesProjekt();
    projekt.kunde = 'Gleicher Kunde';
    const eintraege = [1, 2].map((nr) => ({
      id: `projekt-${nr}`,
      projekt,
      schritt: 0,
      erstelltAm: nr,
      geaendertAm: new Date(2026, 7, 27, 10, nr).getTime(),
    }));
    expect(eintragListenName(eintraege[0]!, eintraege)).toContain('Gleicher Kunde #1');
    expect(eintragListenName(eintraege[1]!, eintraege)).toMatch(/#2 · 27\.08\.26 10:02/);
  });

  it('setzt Zonen nach Z mit AA, AB und AZ fort', () => {
    expect(zonenLabel(25)).toBe('Z');
    expect(zonenLabel(26)).toBe('AA');
    expect(zonenLabel(27)).toBe('AB');
    expect(zonenLabel(51)).toBe('AZ');
  });

  it('sperrt leere Projekte zentral und gibt einen vollständig markierten Entwurf frei', () => {
    const leer = neuesProjekt();
    const gesperrt = projektFreigabe(leer);
    expect(gesperrt.pdf).toBe(false);
    expect(gesperrt.fehler.map((f) => f.id)).toEqual(
      expect.arrayContaining(['kunde', 'adresse', 'erfasser', 'keine-module']),
    );

    const projekt = neuesProjekt();
    projekt.kunde = 'Musterkunde';
    projekt.adresse = 'Musterweg 1';
    projekt.erfasser = 'Genrih';
    projekt.fotos = [{
      id: 'foto-1',
      name: 'Dach',
      dataUrl: 'data:image/jpeg;base64,AA==',
      breitePx: 1000,
      hoehePx: 600,
    }];
    projekt.flaechen[0] = {
      ...projekt.flaechen[0]!,
      felder: [{ xM: 0.05, yM: 0.05, breiteM: 9.9, hoeheM: 5.9, quer: false }],
      fotoZuordnungen: [{
        fotoId: 'foto-1',
        traufePx: null,
        eckenPx: [[0, 600], [1000, 600], [1000, 0], [0, 0]],
        perspektiveBestaetigt: true,
        markierungFertig: true,
      }],
    };
    const frei = projektFreigabe(projekt);
    expect(frei.fehler).toEqual([]);
    expect(frei.pdf).toBe(true);
    expect(frei.flags).toContain('foto_massstab_fehlt');
  });

  it('legt neue Dachflächen standardmäßig mit hochkant stehenden Modulen an', () => {
    expect(neueFlaeche(1, 'A').ausrichtung).toBe('hoch');
  });

  it('berechnet Rechteck, Trapez und manuelles Polygon korrekt', () => {
    const rechteck = neueFlaeche(1, 'A');
    rechteck.breiteM = 10;
    rechteck.hoeheM = 6;
    expect(flaecheM2(rechteck)).toBe(60);

    const trapez = { ...rechteck, dachform: 'trapez' as const, firstBreiteM: 4 };
    expect(flaecheM2(trapez)).toBe(42);

    const polygon = {
      ...rechteck,
      umrissM: [[0, 0], [4, 0], [4, 3], [0, 3]] as [number, number][],
    };
    expect(flaecheM2(polygon)).toBe(12);
  });

  it('übergibt manuelle Hindernisse und gekoppelte Gaubenfüße gemeinsam an die Engine', () => {
    const flaeche = neueFlaeche(1, 'A');
    flaeche.hindernisse = [{ xM: 1, yM: 1, breiteM: 1, hoeheM: 1 }];
    flaeche.gaubenAussparungen = [
      {
        gaubenGruppeId: 'gaube-1',
        rechteck: { xM: 3, yM: 2, breiteM: 2, hoeheM: 1.5 },
      },
    ];
    expect(felderInput(flaeche, modulById('jw-hd96n-r2-460')).hindernisseM).toEqual([
      flaeche.hindernisse[0],
      flaeche.gaubenAussparungen[0]!.rechteck,
    ]);
  });

  it('führt Felder und Foto-Markierungen bei Maßänderungen proportional mit', () => {
    const flaeche = neueFlaeche(1, 'A');
    flaeche.breiteM = 10;
    flaeche.hoeheM = 5;
    flaeche.felder = [
      { xM: 2, yM: 1, breiteM: 4, hoeheM: 2, quer: true, leer: ['alt'] },
    ];
    flaeche.umrissM = [[1, 1], [9, 1], [9, 4], [1, 4]];
    flaeche.hindernisse = [{ xM: 3, yM: 2, breiteM: 1, hoeheM: 1 }];

    const neu = patchFlaechenGeometrie(flaeche, { breiteM: 12, hoeheM: 10 });
    expect(neu.felder).toEqual([
      { xM: 2.4, yM: 2, breiteM: 4.8, hoeheM: 4, quer: true, leer: ['alt'] },
    ]);
    expect(neu.umrissM?.[0]).toEqual([1.2, 2]);
    expect(neu.hindernisse?.[0]?.xM).toBeCloseTo(3.6);
    expect(neu.hindernisse?.[0]).toMatchObject({ yM: 4, breiteM: 1.2, hoeheM: 2 });
  });

  it('klemmt die Firstbreite für Engine und Foto-Perspektive konsistent', () => {
    const flaeche = {
      ...neueFlaeche(1, 'A'),
      dachform: 'trapez' as const,
      breiteM: 10,
      hoeheM: 6,
      firstBreiteM: 14,
    };
    expect(perspektiveQuelle(flaeche)).toEqual([
      [0, 6],
      [10, 6],
      [10, 0],
      [0, 0],
    ]);
  });

  it('exportiert gemischte Felder getrennt und alle Schlüssel in snake_case', () => {
    const projekt = neuesProjekt();
    projekt.flaechen[0] = {
      ...projekt.flaechen[0]!,
      breiteM: 5,
      hoeheM: 3,
      randM: 0,
      felder: [
        { xM: 0, yM: 0, breiteM: 1.134, hoeheM: 1.762, quer: false },
        { xM: 2, yM: 0, breiteM: 1.762, hoeheM: 1.134, quer: true },
      ],
    };

    const payload = bauePayload(projekt, null) as Record<string, unknown>;
    const flaeche = (payload.flaechen as Array<Record<string, unknown>>)[0]!;
    const module = flaeche.module as Record<string, unknown>;

    expect(payload.geometrie_quelle).toBe('manual');
    expect(payload).not.toHaveProperty('geometrieQuelle');
    expect(flaeche).toMatchObject({ neigung_deg: 35, azimut_deg: 180, flaeche_m2: 15 });
    expect(flaeche).not.toHaveProperty('neigungDeg');
    expect(module).toMatchObject({
      anzahl: 2,
      ausrichtung: 'gemischt',
      anzahl_hochkant: 1,
      anzahl_quer: 1,
    });
  });

  it('exportiert beim Flachdach die gewählte Ost-West-Lage und beide Modulseiten', () => {
    const projekt = neuesProjekt();
    projekt.flaechen[0] = {
      ...projekt.flaechen[0]!,
      art: 'flachdach',
      breiteM: 4,
      hoeheM: 4,
      randM: 0,
      neigungDeg: 0,
      flachdach: {
        aufstaenderung: 'ostwest',
        winkelDeg: 10,
        richtungSued: 'rechts',
      },
      felder: [{ xM: 0, yM: 0, breiteM: 4, hoeheM: 4, quer: true }],
    };

    expect(flachdachOstRichtung(projekt.flaechen[0]!)).toBe('oben');
    expect(flachdachRichtungsLabel(projekt.flaechen[0]!)).toBe('Ost oben / West unten');

    const payload = bauePayload(projekt, null) as Record<string, unknown>;
    const flaeche = (payload.flaechen as Array<Record<string, unknown>>)[0]!;
    expect(flaeche.flachdach_montage).toMatchObject({
      sued_richtung_im_plan: 'rechts',
      ost_richtung_im_plan: 'oben',
    });
    expect(flaeche.module).toMatchObject({
      ausrichtung: 'quer',
      anzahl_ost: 2,
      anzahl_west: 2,
    });
  });
});

describe('Mehrfoto-Sicherheit', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('liefert nur vollständig markierte Flächen für den Foto-PDF-Export', () => {
    const projekt = neuesProjekt();
    projekt.fotos = [
      { id: 'foto-1', name: 'Foto 1', dataUrl: 'data:image/jpeg;base64,x', breitePx: 100, hoehePx: 80 },
      { id: 'foto-2', name: 'Foto 2', dataUrl: 'data:image/jpeg;base64,y', breitePx: 120, hoehePx: 90 },
    ];
    projekt.flaechen = [
      {
        ...projekt.flaechen[0]!,
        fotoZuordnungen: [
          {
            fotoId: 'foto-1',
            traufePx: null,
            eckenPx: [[0, 80], [100, 80], [100, 0], [0, 0]],
            markierungFertig: false,
          },
          {
            fotoId: 'foto-2',
            traufePx: null,
            eckenPx: [[0, 90], [120, 90], [120, 0], [0, 0]],
            markierungFertig: true,
          },
        ],
      },
    ];
    expect(fertigeFotoFlaechen(projekt, 'foto-1')).toHaveLength(0);
    expect(fertigeFotoFlaechen(projekt, 'foto-2')).toHaveLength(1);

    projekt.flaechen[0]!.fotoZuordnungen![0]!.markierungFertig = true;
    expect(fertigeFotoFlaechen(projekt, 'foto-1')).toHaveLength(1);
  });

  it('blockiert nur belegte Flächen ohne fertig kalibriertes Foto', () => {
    const projekt = neuesProjekt();
    projekt.flaechen[0]!.felder = [
      { xM: 0, yM: 0, breiteM: 10, hoeheM: 6, quer: false },
    ];
    expect(belegteFlaechenOhneFoto(projekt)).toEqual([projekt.flaechen[0]]);

    projekt.fotos = [
      { id: 'foto-1', name: 'Foto 1', dataUrl: 'data:image/jpeg;base64,x', breitePx: 100, hoehePx: 80 },
    ];
    projekt.flaechen[0]!.fotoZuordnungen = [{
      fotoId: 'foto-1',
      traufePx: null,
      eckenPx: [[0, 80], [100, 80], [100, 0], [0, 0]],
      markierungFertig: true,
    }];
    expect(belegteFlaechenOhneFoto(projekt)).toEqual([]);

    projekt.flaechen.push(neueFlaeche(2, 'B'));
    expect(belegteFlaechenOhneFoto(projekt)).toEqual([]);
  });

  it('migriert die einzelne v2-Fotozuordnung verlustfrei auf Perspektiven', () => {
    const projekt = neuesProjekt();
    projekt.fotoModellVersion = 2;
    projekt.fotos = [
      { id: 'foto-1', name: 'Foto 1', dataUrl: 'data:image/jpeg;base64,x', breitePx: 100, hoehePx: 80 },
    ];
    projekt.flaechen[0] = {
      ...projekt.flaechen[0]!,
      fotoZuordnung: {
        fotoId: 'foto-1',
        traufePx: null,
        eckenPx: [[0, 80], [100, 80], [100, 0], [0, 0]],
      },
      markierungFertig: true,
    };
    const migriert = migriereProjekt(projekt);
    expect(migriert.fotoModellVersion).toBe(3);
    expect(fotoZuordnungenVon(migriert.flaechen[0]!)).toEqual([
      expect.objectContaining({ fotoId: 'foto-1', markierungFertig: true }),
    ]);
    expect(migriert.flaechen[0]!.fotoZuordnung).toBeUndefined();
    expect(migriert.flaechen[0]!.markierungFertig).toBeUndefined();
  });

  it('setzt die Gesamtleistung in sichere PDF- und JSON-Dateinamen', () => {
    const projekt = neuesProjekt();
    projekt.kunde = 'Müller & Söhne';
    projekt.flaechen[0]!.felder = [
      { xM: 0, yM: 0, breiteM: 10, hoeheM: 6, quer: true },
    ];

    expect(downloadDateiname(projekt, 'belegungsplan', 'pdf')).toMatch(
      /^belegungsplan-muller-sohne-\d+,\d{2}-kwp\.pdf$/,
    );
    expect(downloadDateiname(projekt, 'belegung', 'json')).toMatch(
      /^belegung-muller-sohne-\d+,\d{2}-kwp\.json$/,
    );
  });

  it('migriert bestehende Projekte auf den zusammengeführten Drei-Schritt-Ablauf', () => {
    const projekt = neuesProjekt();
    delete projekt.flaechen[0]!.grunddatenFertig;
    expect([0, 1, 2, 3].map(migriereWorkflowSchritt)).toEqual([0, 1, 1, 2]);
    expect(migriereProjekt(projekt).flaechen[0]!.grunddatenFertig).toBe(true);
  });
});
