'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SchrittBelegung } from '../components/SchrittBelegung';
import { SchrittExport } from '../components/SchrittExport';
import { SchrittProjekt } from '../components/SchrittProjekt';
import {
  eintragDatum,
  eintragName,
  ladeProjekte,
  neuerEintrag,
  neuesProjekt,
  speichereProjekte,
  type ProjektDb,
  type ProjektEintrag,
  type Projekt,
} from '../lib/model';

// „Stringcheck" ist seit 13.07.2026 ausgeblendet (Genrih: kein Main-Feature, soll
// im finalen Programm nicht zu sehen sein). Die Rechenlogik (Engine R1–R12,
// SchrittStrings, pruefeStringplan) bleibt vollständig im Projekt.
const SCHRITTE = ['Projekt', 'Dach & Belegung', 'Export'] as const;

export default function Home() {
  const [db, setDb] = useState<ProjektDb>({
    aktivId: null,
    projekte: [],
    workflowVersion: 2,
  });
  // localStorage erst nach dem Mount lesen (SSR-Hydration), danach jede Änderung sichern
  const [geladen, setGeladen] = useState(false);
  const [speicherWarnung, setSpeicherWarnung] = useState(false);

  useEffect(() => {
    const geladen = ladeProjekte();
    // Es gibt immer genau ein aktives Projekt — leere Liste bekommt eins
    setDb(
      geladen.projekte.length > 0
        ? geladen
        : (() => {
            const e = neuerEintrag();
            return { aktivId: e.id, projekte: [e], workflowVersion: 2 };
          })(),
    );
    setGeladen(true);
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
  useEffect(() => {
    if (!geladen) return;
    const t = setTimeout(() => {
      setSpeicherWarnung(speichereProjekte(dbRef.current) !== 'gespeichert');
    }, 400);
    return () => clearTimeout(t);
  }, [geladen, db]);

  useEffect(() => {
    if (!geladen) return;
    const sichern = () => speichereProjekte(dbRef.current);
    // pagehide deckt auch iOS-Safari ab, wo beforeunload nicht zuverlässig feuert
    window.addEventListener('pagehide', sichern);
    document.addEventListener('visibilitychange', sichern);
    return () => {
      window.removeEventListener('pagehide', sichern);
      document.removeEventListener('visibilitychange', sichern);
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
    setDb((d) => ({
      ...d,
      projekte: d.projekte.map((e) =>
        e.id === d.aktivId ? { ...e, ...patch, geaendertAm: Date.now() } : e,
      ),
    }));

  const setProjekt = (p: Projekt) => patchAktiv({ projekt: p });
  const setSchritt = (s: number | ((prev: number) => number)) =>
    patchAktiv({ schritt: typeof s === 'function' ? s(schritt) : s });

  const neuesAnlegen = () => {
    const e = neuerEintrag();
    setDb((d) => ({ ...d, aktivId: e.id, projekte: [...d.projekte, e] }));
  };

  const dupliziereAktiv = () => {
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
    setDb((d) => ({ ...d, aktivId: kopie.id, projekte: [...d.projekte, kopie] }));
  };

  const loescheAktiv = () => {
    if (!aktiv) return;
    if (!window.confirm(`Projekt „${eintragName(aktiv)}" löschen?`)) return;
    setDb((d) => {
      const rest = d.projekte.filter((e) => e.id !== d.aktivId);
      if (rest.length > 0) return { ...d, aktivId: rest[0]!.id, projekte: rest };
      const e = neuerEintrag(); // nie ohne aktives Projekt dastehen
      return { ...d, aktivId: e.id, projekte: [e] };
    });
  };

  const flaechenOk = projekt.flaechen.every((f) => {
    const firstBreite =
      f.firstBreiteM ??
      (f.dachform === 'trapez' ? f.breiteM * 0.6 : f.breiteM);
    return (
      Number.isFinite(f.breiteM) &&
      f.breiteM > 0 &&
      Number.isFinite(f.hoeheM) &&
      f.hoeheM > 0 &&
      Number.isFinite(f.neigungDeg) &&
      f.neigungDeg >= 0 &&
      ((f.dachform !== 'trapez' && f.dachform !== 'schief') ||
        (Number.isFinite(firstBreite) && firstBreite >= 0 && firstBreite <= f.breiteM)) &&
      // 90° = Fassade (16.07.2026); Schrägdächer bleiben praktisch bei ≤ 75°
      f.neigungDeg <= 90
    );
  });
  const weiterErlaubt = schritt !== 1 || flaechenOk;

  const knopf =
    'h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-40';

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <label htmlFor="projekt-auswahl" className="text-sm font-medium text-slate-500">
          Projekt
        </label>
        <select
          id="projekt-auswahl"
          value={db.aktivId ?? ''}
          onChange={(e) => setDb((d) => ({ ...d, aktivId: e.target.value }))}
          className="h-11 max-w-[22rem] flex-1 rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
        >
          {db.projekte.map((e) => (
            <option key={e.id} value={e.id}>
              {eintragName(e)} · {eintragDatum(e)}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          {db.projekte.length} {db.projekte.length === 1 ? 'Projekt' : 'Projekte'}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={knopf} onClick={neuesAnlegen} disabled={!geladen}>
            + Neu
          </button>
          <button type="button" className={knopf} onClick={dupliziereAktiv} disabled={!aktiv}>
            Duplizieren
          </button>
          <button
            type="button"
            className={`${knopf} text-red-500 hover:border-red-300`}
            onClick={loescheAktiv}
            disabled={!aktiv}
          >
            Löschen
          </button>
        </div>
      </div>

      {speicherWarnung && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <strong>Projekt noch nicht gespeichert:</strong> Der Browser-Speicher ist voll. Der
          letzte vollständig gespeicherte Stand bleibt erhalten. Bitte ein nicht benötigtes Foto
          entfernen und danach eine kleine Änderung vornehmen, damit erneut gespeichert wird.
        </div>
      )}

      <nav className="flex flex-wrap items-center gap-2" aria-label="Schritte">
        {SCHRITTE.map((name, i) => {
          const erreichbar =
            i === schritt || i < schritt || (i === schritt + 1 && weiterErlaubt);
          return (
            <button
              key={name}
              type="button"
              disabled={!erreichbar}
              aria-current={i === schritt ? 'step' : undefined}
              onClick={() => erreichbar && setSchritt(i)}
              className={`h-11 rounded-full px-4 text-sm font-medium transition ${
                i === schritt
                  ? 'bg-akzent text-white'
                  : erreichbar
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}. {name}
            </button>
          );
        })}
      </nav>

      {schritt === 0 && <SchrittProjekt key={aktiv?.id} projekt={projekt} onChange={setProjekt} />}
      {schritt === 1 && <SchrittBelegung key={aktiv?.id} projekt={projekt} onChange={setProjekt} />}
      {schritt === 2 && <SchrittExport key={aktiv?.id} projekt={projekt} onChange={setProjekt} />}

      <div className="flex justify-between">
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
            disabled={!weiterErlaubt}
            onClick={() => setSchritt((s) => Math.min(SCHRITTE.length - 1, s + 1))}
            className="h-12 rounded-xl bg-akzent px-8 text-sm font-semibold text-white transition enabled:hover:bg-akzent/90 disabled:opacity-40"
          >
            Weiter →
          </button>
        )}
      </div>
    </div>
  );
}
