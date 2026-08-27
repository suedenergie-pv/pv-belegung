import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { neuesProjekt, type ProjektDb } from './model';
import {
  SPEICHER_SCHLUESSEL,
  importiereKomplettExport,
  komplettExportJson,
  ladeProjekte,
  speichereProjekte,
} from './speicher';

function dbMitFoto(id = 'projekt-1'): ProjektDb {
  const projekt = neuesProjekt();
  projekt.fotos = [{
    id: 'foto-1',
    name: 'Dachfoto',
    dataUrl: 'data:image/jpeg;base64,eA==',
    breitePx: 100,
    hoehePx: 80,
  }];
  return {
    aktivId: id,
    projekte: [{ id, projekt, schritt: 1, erstelltAm: 1, geaendertAm: 2 }],
    workflowVersion: 2,
  };
}

function browserSpeicher(start: Record<string, string> = {}) {
  const daten = new Map(Object.entries(start));
  const localStorage = {
    getItem: vi.fn((key: string) => daten.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { daten.set(key, value); }),
    removeItem: vi.fn((key: string) => { daten.delete(key); }),
  };
  vi.stubGlobal('window', { indexedDB: new IDBFactory(), localStorage });
  return { daten, localStorage };
}

beforeEach(() => browserSpeicher());
afterEach(() => vi.unstubAllGlobals());

describe('versionierter Projekt- und Fotospeicher', () => {
  it('speichert Foto-Blobs in IndexedDB und nur Metadaten in localStorage', async () => {
    const { daten } = browserSpeicher();
    const db = dbMitFoto();
    const gespeichert = await speichereProjekte(db);
    expect(gespeichert.status).toBe('erfolg');

    const metadaten = daten.get(SPEICHER_SCHLUESSEL.aktuell)!;
    expect(metadaten).not.toContain('data:image/jpeg;base64,eA==');
    expect(metadaten).toContain('"speicherVersion":2');

    const geladen = await ladeProjekte();
    expect(geladen.status).toBe('erfolg');
    if (geladen.status === 'erfolg') {
      expect(geladen.db.projekte[0]!.projekt.fotos[0]!.dataUrl).toBe(
        'data:image/jpeg;base64,eA==',
      );
    }
  });

  it('migriert den alten Komplettstand erst nach Foto-Rückleseprüfung', async () => {
    const alt = JSON.stringify(dbMitFoto());
    const { daten, localStorage } = browserSpeicher({ [SPEICHER_SCHLUESSEL.altProjekte]: alt });

    const geladen = await ladeProjekte();
    expect(geladen).toMatchObject({ status: 'erfolg', migriert: true });
    expect(localStorage.removeItem).toHaveBeenCalledWith(SPEICHER_SCHLUESSEL.altProjekte);
    expect(daten.has(SPEICHER_SCHLUESSEL.altProjekte)).toBe(false);
    expect(daten.has(SPEICHER_SCHLUESSEL.aktuell)).toBe(true);
    expect((await ladeProjekte()).status).toBe('erfolg');
  });

  it('behält den alten Komplettstand, wenn die neue Metadatenspeicherung scheitert', async () => {
    const alt = JSON.stringify(dbMitFoto());
    const { daten, localStorage } = browserSpeicher({ [SPEICHER_SCHLUESSEL.altProjekte]: alt });
    localStorage.setItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const geladen = await ladeProjekte();
    expect(geladen.status).toBe('kapazitaet');
    expect(daten.get(SPEICHER_SCHLUESSEL.altProjekte)).toBe(alt);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('öffnet bei fehlendem IndexedDB-Foto die Reparatur statt eines leeren Projekts', async () => {
    const ersterBrowser = browserSpeicher();
    expect((await speichereProjekte(dbMitFoto())).status).toBe('erfolg');
    const metadaten = ersterBrowser.daten.get(SPEICHER_SCHLUESSEL.aktuell)!;

    // Neuer, leerer IndexedDB-Speicher simuliert verlorene oder beschädigte Foto-Blobs.
    browserSpeicher({ [SPEICHER_SCHLUESSEL.aktuell]: metadaten });
    const geladen = await ladeProjekte();
    expect(geladen.status).toBe('reparatur');
    if (geladen.status === 'reparatur') expect(geladen.grund).toContain('fehlt oder ist beschädigt');
  });

  it('ersetzt beschädigte Speicherung niemals still durch einen leeren Stand', async () => {
    const kaputt = '{"speicherVersion":2,"projekte":';
    const { localStorage } = browserSpeicher({ [SPEICHER_SCHLUESSEL.aktuell]: kaputt });
    const geladen = await ladeProjekte();
    expect(geladen).toMatchObject({ status: 'reparatur', rohdaten: kaputt });
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('meldet Kapazitätsfehler typisiert und schreibt keinen Foto-Fallback in localStorage', async () => {
    const { localStorage } = browserSpeicher();
    localStorage.setItem.mockImplementation((key: string, value: string) => {
      expect(key).toBe(SPEICHER_SCHLUESSEL.aktuell);
      expect(value).not.toContain('data:image/jpeg;base64,eA==');
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const gespeichert = await speichereProjekte(dbMitFoto());
    expect(gespeichert.status).toBe('kapazitaet');
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});

describe('Komplettexport und Import', () => {
  it('exportiert versioniert und vergibt kollidierende Projekt-IDs neu', async () => {
    const bestehend = dbMitFoto('gleich');
    const importDb = dbMitFoto('gleich');
    const datei = komplettExportJson(importDb);
    expect(JSON.parse(datei)).toMatchObject({ format: 'pvbelegung', version: 1 });

    const ergebnis = await importiereKomplettExport(datei, bestehend);
    expect(ergebnis.status).toBe('erfolg');
    if (ergebnis.status === 'erfolg') {
      expect(ergebnis.importiert).toBe(1);
      expect(new Set(ergebnis.db.projekte.map((eintrag) => eintrag.id)).size).toBe(2);
      expect(ergebnis.db.projekte).toHaveLength(2);
    }
  });

  it('weist beschädigte oder fremde Importdateien als Reparaturfall zurück', async () => {
    const ergebnis = await importiereKomplettExport('{"format":"fremd"}', dbMitFoto());
    expect(ergebnis.status).toBe('reparatur');
  });
});
