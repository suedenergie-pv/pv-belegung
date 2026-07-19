import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bauePayload,
  fertigeFotoFlaechen,
  flaecheM2,
  flachdachOstRichtung,
  flachdachRichtungsLabel,
  neueFlaeche,
  neuesProjekt,
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
});
