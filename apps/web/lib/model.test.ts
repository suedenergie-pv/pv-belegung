import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bauePayload,
  fertigeFotoFlaechen,
  felderInput,
  flaecheM2,
  flachdachOstRichtung,
  flachdachRichtungsLabel,
  ladeProjekte,
  modulById,
  neueFlaeche,
  neuesProjekt,
  patchFlaechenGeometrie,
  speichereProjekte,
  type ProjektDb,
} from './model';

describe('Export-Geometrie und Modulausrichtung', () => {
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
      { xM: 2.4, yM: 2, breiteM: 4.8, hoeheM: 4, quer: true },
    ]);
    expect(neu.umrissM?.[0]).toEqual([1.2, 2]);
    expect(neu.hindernisse?.[0]?.xM).toBeCloseTo(3.6);
    expect(neu.hindernisse?.[0]).toMatchObject({ yM: 4, breiteM: 1.2, hoeheM: 2 });
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
    ];
    projekt.flaechen = [
      {
        ...projekt.flaechen[0]!,
        fotoZuordnung: {
          fotoId: 'foto-1',
          traufePx: null,
          eckenPx: [[0, 80], [100, 80], [100, 0], [0, 0]],
        },
        markierungFertig: false,
      },
    ];
    expect(fertigeFotoFlaechen(projekt, 'foto-1')).toHaveLength(0);

    projekt.flaechen[0]!.markierungFertig = true;
    expect(fertigeFotoFlaechen(projekt, 'foto-1')).toHaveLength(1);
  });

  it('überschreibt bei vollem Browser-Speicher keinen zweiten Stand ohne Fotos', () => {
    const projekt = neuesProjekt();
    projekt.fotos = [
      { id: 'foto-1', name: 'Foto 1', dataUrl: 'data:image/jpeg;base64,x', breitePx: 100, hoehePx: 80 },
    ];
    const db: ProjektDb = {
      aktivId: 'projekt-1',
      projekte: [
        { id: 'projekt-1', projekt, schritt: 2, erstelltAm: 1, geaendertAm: 1 },
      ],
    };
    const aufrufe: Array<[string, string]> = [];
    const setItem = vi.fn((key: string, value: string) => {
      aufrufe.push([key, value]);
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    vi.stubGlobal('window', { localStorage: { setItem } });

    expect(speichereProjekte(db)).toBe('speicher_voll');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(aufrufe[0]![1]).toContain('data:image/jpeg;base64,x');
  });

  it('migriert bestehende Projekte auf den zusammengeführten Drei-Schritt-Ablauf', () => {
    const projekt = neuesProjekt();
    delete projekt.flaechen[0]!.grunddatenFertig;
    const alt: ProjektDb = {
      aktivId: 'projekt-2',
      projekte: [0, 1, 2, 3].map((schritt) => ({
        id: `projekt-${schritt}`,
        projekt,
        schritt,
        erstelltAm: 1,
        geaendertAm: 1,
      })),
    };
    vi.stubGlobal('window', {
      localStorage: { getItem: vi.fn(() => JSON.stringify(alt)) },
    });

    const migriert = ladeProjekte();
    expect(migriert.workflowVersion).toBe(2);
    expect(migriert.projekte.map((e) => e.schritt)).toEqual([0, 1, 1, 2]);
    expect(migriert.projekte[0]!.projekt.flaechen[0]!.grunddatenFertig).toBe(true);
  });
});
