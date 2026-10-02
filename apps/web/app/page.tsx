'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SchrittBelegung } from '../components/SchrittBelegung';
import { SchrittExport } from '../components/SchrittExport';
import { SchrittProjekt } from '../components/SchrittProjekt';
import { HistorienEingaben, ProjektHistorieContext, useHistorienVerwaltung } from '../lib/projekt-historie-context';
import { EntwurfNavigationProvider, useEntwurfNavigation } from '../lib/entwurf-navigation';
import { EditorSitzungProvider } from '../lib/editor-sitzung';
import {
  eintragListenName,
  eintragName,
  neuerEintrag,
  neuesProjekt,
  type ProjektDb,
  type ProjektEintrag,
  type Projekt,
} from '../lib/model';
import {
  importiereKomplettExport,
  komplettExportDateiname,
  komplettExportJson,
  ladeProjekte,
  loescheProjektFotos,
  speichereProjekte,
  type SpeicherErgebnis,
} from '../lib/speicher';

interface GeloeschtesProjekt {
  eintrag: ProjektEintrag;
  index: number;
  ersatzId?: string;
}

// Der Stringcheck bleibt bis zur PV*SOL-Gegenrechnung aus der Oberfläche entfernt.
// Gespeicherte Stringdaten und die Engine R1–R12 bleiben für Migration und Export erhalten.
const SCHRITTE = ['Projekt', 'Dach & Belegung', 'Export'] as const;

export default function Home() {
  return <EntwurfNavigationProvider><ProjektApp /></EntwurfNavigationProvider>;
}

function ProjektApp() {
  const navigation = useEntwurfNavigation();
  const [db, setDb] = useState<ProjektDb>({
    aktivId: null,
    projekte: [],
    workflowVersion: 2,
  });
  // localStorage erst nach dem Mount lesen (SSR-Hydration), danach jede Änderung sichern
  const [geladen, setGeladen] = useState(false);
  const [speicherStatus, setSpeicherStatus] = useState<
    'gespeichert' | 'speichert' | 'kapazitaet' | 'reparatur'
  >('gespeichert');
  const [ladeProblem, setLadeProblem] = useState<Exclude<SpeicherErgebnis, { status: 'erfolg' }> | null>(null);
  const [dateiStatus, setDateiStatus] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const speicherGeneration = useRef(0);
  const speicherKette = useRef<Promise<void>>(Promise.resolve());
  const [geloeschteProjekte, setGeloeschteProjekte] = useState<GeloeschtesProjekt[]>([]);
  const loeschTimer = useRef(new Map<string, number>());

  useEffect(() => () => {
    loeschTimer.current.forEach((timer) => clearTimeout(timer));
    loeschTimer.current.clear();
  }, []);

  const ladeNeu = async () => {
    setGeladen(false);
    setLadeProblem(null);
    const ergebnis = await ladeProjekte();
    if (ergebnis.status !== 'erfolg') {
      setLadeProblem(ergebnis);
      return;
    }
    // Nur ein tatsächlich leerer, unbeschädigter Speicher bekommt einen Erststand.
    schreibeDb(
      ergebnis.db.projekte.length > 0
        ? ergebnis.db
        : (() => {
            const e = neuerEintrag();
            return { aktivId: e.id, projekte: [e], workflowVersion: 2 };
          })(),
    );
    setGeladen(true);
  };

  useEffect(() => {
    void ladeNeu();
  }, []);

  /**
   * Speichern ENTKOPPELT (16.07.2026): `speichereProjekte` serialisiert das ganze
   * Projekt inkl. Foto-DataURLs (mehrere MB) — bei jedem Tastendruck synchron
   * ausgeführt blockiert das den Main-Thread, und gehaltene Pfeiltasten/Knöpfe
   * schieben sichtbar stockend statt flüssig (gemessen: 3 statt 8 Schritten/s).
   * Der State ist sofort aktuell, nur die Platte hinkt ~400 ms hinterher; beim
   * Verlassen der Seite wird sofort geschrieben, damit nichts verloren geht.
   */
  const dbRef = useRef(db);
  dbRef.current = db;
  const schreibeDb = (wert: ProjektDb | ((vorher: ProjektDb) => ProjektDb)) => {
    const neu = typeof wert === 'function' ? wert(dbRef.current) : wert;
    dbRef.current = neu;
    setDb(neu);
    setSpeicherStatus('speichert');
  };
  useEffect(() => {
    if (!geladen) return;
    setSpeicherStatus('speichert');
    const generation = ++speicherGeneration.current;
    const t = setTimeout(() => {
      const snapshot = dbRef.current;
      speicherKette.current = speicherKette.current.then(async () => {
        const ergebnis = await speichereProjekte(snapshot);
        if (generation !== speicherGeneration.current) return;
        setSpeicherStatus(
          ergebnis.status === 'erfolg' ? 'gespeichert' : ergebnis.status,
        );
      });
    }, 400);
    return () => clearTimeout(t);
  }, [geladen, db]);

  useEffect(() => {
    if (!geladen) return;
    const sichern = () => void speichereProjekte(dbRef.current);
    // pagehide deckt auch iOS-Safari ab, wo beforeunload nicht zuverlässig feuert
    window.addEventListener('pagehide', sichern);
    const beiSichtbarkeit = () => {
      if (document.visibilityState === 'hidden') sichern();
    };
    document.addEventListener('visibilitychange', beiSichtbarkeit);
    return () => {
      window.removeEventListener('pagehide', sichern);
      document.removeEventListener('visibilitychange', beiSichtbarkeit);
      sichern(); // Unmount: letzten Stand festschreiben
    };
  }, [geladen]);

  const aktiv: ProjektEintrag | undefined = useMemo(
    () => db.projekte.find((e) => e.id === db.aktivId),
    [db],
  );
  const projekt = aktiv?.projekt ?? neuesProjekt();
  // Klemmen: gespeicherte Stände konnten noch auf dem entfallenen Stringcheck-Tab
  // stehen (alter Index 4/5) — die landen jetzt auf dem Export.
  const schritt = Math.min(aktiv?.schritt ?? 0, SCHRITTE.length - 1);

  /** Patch am aktiven Eintrag (Projekt und/oder Schritt), Zeitstempel aktualisieren. */
  const patchAktiv = (patch: Partial<Pick<ProjektEintrag, 'projekt' | 'schritt'>>) =>
    schreibeDb((d) => ({
      ...d,
      projekte: d.projekte.map((e) =>
        e.id === d.aktivId ? { ...e, ...patch, geaendertAm: Date.now() } : e,
      ),
    }));

  const { historie, record, forget } = useHistorienVerwaltung(
    aktiv?.id ?? 'laden', projekt, (stand) => patchAktiv({ projekt: stand }),
  );
  const setProjekt = (p: Projekt) => {
    const vorher = dbRef.current.projekte.find((eintrag) => eintrag.id === dbRef.current.aktivId)?.projekt;
    if (vorher) record(vorher, p);
    patchAktiv({ projekt: p });
  };
  const setSchritt = (s: number | ((prev: number) => number)) => navigation.weiter(() => {
    historie.end();
    patchAktiv({ schritt: typeof s === 'function' ? s(schritt) : s });
  });
  const geschuetzteHistorie = {
    ...historie,
    undo: () => navigation.weiter(historie.undo),
    redo: () => navigation.weiter(historie.redo),
  };

  const neuesAnlegen = () => {
    historie.end();
    const e = neuerEintrag();
    schreibeDb((d) => ({ ...d, aktivId: e.id, projekte: [...d.projekte, e] }));
  };

  const dupliziereAktiv = () => {
    historie.end();
    const aktiv = dbRef.current.projekte.find((eintrag) => eintrag.id === dbRef.current.aktivId);
    if (!aktiv) return;
    const jetzt = Date.now();
    const kopie: ProjektEintrag = {
      ...aktiv,
      id: neuerEintrag().id,
      projekt: {
        ...aktiv.projekt,
        kunde: aktiv.projekt.kunde ? `${aktiv.projekt.kunde} (Kopie)` : aktiv.projekt.kunde,
      },
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    };
    schreibeDb((d) => ({ ...d, aktivId: kopie.id, projekte: [...d.projekte, kopie] }));
  };

  const loescheAktiv = () => {
    historie.end();
    const db = dbRef.current;
    const aktiv = db.projekte.find((eintrag) => eintrag.id === db.aktivId);
    if (!aktiv) return;
    const index = db.projekte.findIndex((eintrag) => eintrag.id === aktiv.id);
    const rest = db.projekte.filter((eintrag) => eintrag.id !== aktiv.id);
    const ersatz = rest.length === 0 ? neuerEintrag() : null;
    schreibeDb({
      ...db,
      aktivId: rest[0]?.id ?? ersatz!.id,
      projekte: rest.length > 0 ? rest : [ersatz!],
    });
    setGeloeschteProjekte((alt) => [
      ...alt,
      { eintrag: aktiv, index, ...(ersatz ? { ersatzId: ersatz.id } : {}) },
    ]);
    const timer = window.setTimeout(() => {
      setGeloeschteProjekte((alt) => alt.filter((wert) => wert.eintrag.id !== aktiv.id));
      loeschTimer.current.delete(aktiv.id);
      forget(aktiv.id);
      void loescheProjektFotos(aktiv.id).catch(() => {
        setDateiStatus('Projekt gelöscht; verwaiste Fotodaten konnten noch nicht bereinigt werden.');
      });
    }, 12_000);
    loeschTimer.current.set(aktiv.id, timer);
  };

  const loeschungRueckgaengig = (geloescht: GeloeschtesProjekt) => {
    historie.end();
    const timer = loeschTimer.current.get(geloescht.eintrag.id);
    if (timer) clearTimeout(timer);
    loeschTimer.current.delete(geloescht.eintrag.id);
    schreibeDb((aktuell) => {
      let liste = aktuell.projekte;
      if (
        geloescht.ersatzId &&
        liste.length === 1 &&
        liste[0]?.id === geloescht.ersatzId &&
        !liste[0].projekt.kunde &&
        !liste[0].projekt.adresse
      ) {
        liste = [];
      }
      const neu = [...liste];
      neu.splice(Math.min(geloescht.index, neu.length), 0, geloescht.eintrag);
      return { ...aktuell, aktivId: geloescht.eintrag.id, projekte: neu };
    });
    setGeloeschteProjekte((alt) => alt.filter((wert) => wert.eintrag.id !== geloescht.eintrag.id));
  };

  const loeschungEndgueltig = (geloescht: GeloeschtesProjekt) => {
    forget(geloescht.eintrag.id);
    const timer = loeschTimer.current.get(geloescht.eintrag.id);
    if (timer) clearTimeout(timer);
    loeschTimer.current.delete(geloescht.eintrag.id);
    setGeloeschteProjekte((alt) => alt.filter((wert) => wert.eintrag.id !== geloescht.eintrag.id));
    void loescheProjektFotos(geloescht.eintrag.id).catch(() => {
      setDateiStatus('Projekt gelöscht; verwaiste Fotodaten konnten noch nicht bereinigt werden.');
    });
  };

  const textHerunterladen = (text: string, dateiname: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = dateiname;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const exportiereKomplett = () => {
    textHerunterladen(komplettExportJson(dbRef.current), komplettExportDateiname());
    setDateiStatus('Komplettexport wurde erstellt.');
  };

  const importiereKomplett = async (datei: File | undefined) => {
    if (!datei) return;
    setDateiStatus('Komplettexport wird geprüft …');
    try {
      const ergebnis = await importiereKomplettExport(await datei.text(), dbRef.current);
      if (ergebnis.status !== 'erfolg') {
        setDateiStatus(`Import fehlgeschlagen: ${ergebnis.grund}`);
        return;
      }
      historie.end();
      schreibeDb(ergebnis.db);
      setDateiStatus(`${ergebnis.importiert} Projekt${ergebnis.importiert === 1 ? '' : 'e'} importiert.`);
    } catch (fehler) {
      setDateiStatus(fehler instanceof Error ? fehler.message : 'Import fehlgeschlagen.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const leerenStandBewusstAnlegen = async () => {
    const eintrag = neuerEintrag();
    const leer: ProjektDb = { aktivId: eintrag.id, projekte: [eintrag], workflowVersion: 2 };
    const ergebnis = await speichereProjekte(leer);
    if (ergebnis.status !== 'erfolg') {
      setLadeProblem(ergebnis);
      return;
    }
    schreibeDb(ergebnis.db);
    setLadeProblem(null);
    setGeladen(true);
  };

  const knopf =
    'h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-40';

  if (!geladen) {
    if (!ladeProblem) {
      return <div className="rounded-2xl bg-white p-6 text-sm text-slate-600">Projekte werden geladen …</div>;
    }
    return (
      <section className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-red-300 bg-white p-6 shadow-sm" aria-labelledby="reparatur-titel">
        <h2 id="reparatur-titel" className="text-xl font-semibold text-slate-900">Gespeicherter Stand muss repariert werden</h2>
        <p className="text-sm text-red-800">{ladeProblem.grund}</p>
        <p className="text-sm text-slate-600">
          Es wurde absichtlich kein leeres Projekt darübergelegt. Sichere zuerst die vorhandenen Rohdaten oder versuche das Laden erneut.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={knopf} onClick={() => textHerunterladen(ladeProblem.rohdaten, 'pv-belegung-reparatur-rohdaten.json')}>
            Rohdaten sichern
          </button>
          <button type="button" className={knopf} onClick={() => void ladeNeu()}>
            Erneut versuchen
          </button>
          <button type="button" className="h-11 rounded-full border border-red-300 px-4 text-sm font-semibold text-red-700" onClick={() => void leerenStandBewusstAnlegen()}>
            Bewusst leeren Stand anlegen
          </button>
        </div>
      </section>
    );
  }

  return (
    <ProjektHistorieContext.Provider value={geschuetzteHistorie}>
    <EditorSitzungProvider projektId={aktiv?.id ?? 'leer'}>
    <div className={schritt === 1 ? 'editor-seite' : 'space-y-5 pb-10 mx-auto max-w-5xl'}>
      <header className={schritt === 1 ? 'workbench-kopf' : 'contents'}>
      <div className="projekt-leiste flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        {schritt === 1 && <span className="workbench-marke" title="SüdEnergie · Belegungsplaner"><span aria-hidden="true" />SüdEnergie</span>}
        <label htmlFor="projekt-auswahl" className="sr-only">
          Aktuelles Projekt
        </label>
        <select
          id="projekt-auswahl"
          aria-label="Aktuelles Projekt"
          value={db.aktivId ?? ''}
          onChange={(e) => { const id = e.target.value; navigation.weiter(() => { historie.end(); schreibeDb((d) => ({ ...d, aktivId: id })); }); }}
          className="h-11 min-w-0 max-w-[22rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
        >
          {db.projekte.map((e) => (
            <option key={e.id} value={e.id}>
              {eintragListenName(e, db.projekte)}
            </option>
          ))}
        </select>
        <span role="status" className="speicher-status order-last w-full text-xs text-slate-600 sm:order-none sm:w-auto">
          {speicherStatus === 'speichert'
              ? 'Speichert …'
              : speicherStatus === 'gespeichert'
                ? 'In diesem Browser gespeichert'
                : speicherStatus === 'kapazitaet'
                  ? 'Speicher voll'
                  : 'Speicher prüfen'}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={knopf} onClick={() => navigation.weiter(neuesAnlegen)} disabled={!geladen}>
            + Neu
          </button>
          <details className="group relative">
            <summary className={`${knopf} flex cursor-pointer list-none items-center`}>
              Projektaktionen ···
            </summary>
            <div className="absolute right-0 z-30 mt-2 grid min-w-48 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <button
                type="button"
                className="h-10 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => navigation.weiter(dupliziereAktiv)}
                disabled={!aktiv}
              >
                Projekt duplizieren
              </button>
              <button
                type="button"
                className="h-10 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => navigation.weiter(exportiereKomplett)}
              >
                Alle Projekte sichern
              </button>
              <button
                type="button"
                className="h-10 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => navigation.weiter(() => importRef.current?.click())}
              >
                Komplettexport importieren
              </button>
              <input
                ref={importRef}
                type="file"
                className="sr-only"
                accept=".json,.pvbelegung.json,application/json"
                aria-label="Komplettexport-Datei auswählen"
                onChange={(event) => void importiereKomplett(event.target.files?.[0])}
              />
              <button
                type="button"
                className="h-10 rounded-lg px-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={() => navigation.weiter(loescheAktiv)}
                disabled={!aktiv}
              >
                Projekt löschen
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">{dateiStatus}</div>

      {speicherStatus !== 'gespeichert' && speicherStatus !== 'speichert' && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <strong>Projekt noch nicht gespeichert:</strong>{' '}
          {speicherStatus === 'kapazitaet'
            ? 'Der Browser-Fotospeicher ist voll. Der letzte vollständige Stand bleibt erhalten.'
            : 'Die Speicherung ist beschädigt oder nicht verfügbar. Bitte einen Komplettexport sichern und die Seite neu laden.'}
        </div>
      )}

      {geloeschteProjekte.map((geloescht) => (
        <div
          key={geloescht.eintrag.id}
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <span className="mr-auto">
            Projekt „{eintragName(geloescht.eintrag)}“ wurde aus der Liste entfernt. Die Fotos bleiben noch 12 Sekunden erhalten.
          </span>
          <button type="button" className="h-11 rounded-lg bg-slate-900 px-4 font-semibold text-white" onClick={() => navigation.weiter(() => loeschungRueckgaengig(geloescht))}>
            Rückgängig
          </button>
          <button type="button" className="h-11 rounded-lg border border-red-300 px-3 font-medium text-red-700" onClick={() => loeschungEndgueltig(geloescht)}>
            Endgültig löschen
          </button>
        </div>
      ))}

      <div className="ablauf-leiste">
      <nav className="schritt-leiste flex flex-wrap items-center gap-2" aria-label="Schritte">
        {SCHRITTE.map((name, i) => {
          return (
            <button
              key={name}
              type="button"
              aria-label={`${i + 1}. ${name}`}
              aria-current={i === schritt ? 'step' : undefined}
              onClick={() => setSchritt(i)}
              className={`h-11 rounded-full px-4 text-sm font-medium transition ${schritt === 1 && i === 2 ? 'export-weiter' : ''} ${
                i === schritt
                  ? 'bg-akzent text-white'
                  : 'bg-white text-slate-700 shadow-sm'
              }`}
            >
              {schritt === 1 && i === 2 ? <><span className="export-lang">Weiter zum Export</span><span className="export-kurz">Export</span><span aria-hidden="true"> →</span></> : <>{i + 1}. {name}</>}
            </button>
          );
        })}
      </nav>

      <div className="historien-leiste flex flex-wrap gap-2" aria-label="Änderungshistorie">
        <button type="button" className={knopf} disabled={!historie.canUndo} onClick={geschuetzteHistorie.undo}>
          ↶ Rückgängig{historie.undoCount > 0 ? ` (${historie.undoCount})` : ''}
        </button>
        <button type="button" className={knopf} disabled={!historie.canRedo} onClick={geschuetzteHistorie.redo}>
          ↷ Wiederherstellen
        </button>
      </div>
      </div>
      </header>

      <HistorienEingaben>
      {schritt === 0 && <SchrittProjekt key={aktiv?.id} projekt={projekt} onChange={setProjekt} />}
      {schritt === 1 && <SchrittBelegung key={aktiv?.id} projekt={projekt} onChange={setProjekt} />}
      {schritt === 2 && (
        <SchrittExport
          key={aktiv?.id}
          projekt={projekt}
          onChange={setProjekt}
          onSpringeZu={(zielSchritt, sprungziel) => {
            setSchritt(zielSchritt);
            window.setTimeout(() => {
              const ziel = document.getElementById(sprungziel);
              ziel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              if (ziel instanceof HTMLElement) ziel.focus({ preventScroll: true });
            }, 0);
          }}
        />
      )}

      </HistorienEingaben>

      {schritt !== 1 && <div className="flex justify-between">
        <button
          type="button"
          disabled={schritt === 0}
          onClick={() => setSchritt((s) => Math.max(0, s - 1))}
          className="h-12 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 disabled:opacity-30"
        >
          ← Zurück
        </button>
        {schritt < SCHRITTE.length - 1 && (
          <button
            type="button"
            onClick={() => setSchritt((s) => Math.min(SCHRITTE.length - 1, s + 1))}
            className="h-12 rounded-xl bg-akzent px-8 text-sm font-semibold text-white transition enabled:hover:bg-akzent/90 disabled:opacity-40"
          >
            Weiter →
          </button>
        )}
      </div>}
    </div>
    </EditorSitzungProvider>
    </ProjektHistorieContext.Provider>
  );
}
