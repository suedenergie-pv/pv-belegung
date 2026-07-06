'use client';

import { useEffect, useMemo, useState } from 'react';
import { SchrittBelegung } from '../components/SchrittBelegung';
import { SchrittExport } from '../components/SchrittExport';
import { SchrittFlaechen } from '../components/SchrittFlaechen';
import { SchrittProjekt } from '../components/SchrittProjekt';
import { SchrittStrings } from '../components/SchrittStrings';
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

const SCHRITTE = ['Projekt', 'Dachflächen', 'Belegung', 'Stringcheck', 'Export'] as const;

export default function Home() {
  const [db, setDb] = useState<ProjektDb>({ aktivId: null, projekte: [] });
  // localStorage erst nach dem Mount lesen (SSR-Hydration), danach jede Änderung sichern
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    const geladen = ladeProjekte();
    // Es gibt immer genau ein aktives Projekt — leere Liste bekommt eins
    setDb(
      geladen.projekte.length > 0
        ? geladen
        : (() => {
            const e = neuerEintrag();
            return { aktivId: e.id, projekte: [e] };
          })(),
    );
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (geladen) speichereProjekte(db);
  }, [geladen, db]);

  const aktiv: ProjektEintrag | undefined = useMemo(
    () => db.projekte.find((e) => e.id === db.aktivId),
    [db],
  );
  const projekt = aktiv?.projekt ?? neuesProjekt();
  const schritt = aktiv?.schritt ?? 0;

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
    setDb((d) => ({ aktivId: e.id, projekte: [...d.projekte, e] }));
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
    setDb((d) => ({ aktivId: kopie.id, projekte: [...d.projekte, kopie] }));
  };

  const loescheAktiv = () => {
    if (!aktiv) return;
    if (!window.confirm(`Projekt „${eintragName(aktiv)}" löschen?`)) return;
    setDb((d) => {
      const rest = d.projekte.filter((e) => e.id !== d.aktivId);
      if (rest.length > 0) return { aktivId: rest[0]!.id, projekte: rest };
      const e = neuerEintrag(); // nie ohne aktives Projekt dastehen
      return { aktivId: e.id, projekte: [e] };
    });
  };

  const flaechenOk = projekt.flaechen.every(
    (f) =>
      Number.isFinite(f.breiteM) &&
      f.breiteM > 0 &&
      Number.isFinite(f.hoeheM) &&
      f.hoeheM > 0 &&
      Number.isFinite(f.neigungDeg) &&
      f.neigungDeg >= 0 &&
      f.neigungDeg <= 75,
  );
  const weiterErlaubt = schritt !== 1 || flaechenOk;

  const knopf =
    'h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-40';

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <label className="text-sm font-medium text-slate-500">Projekt</label>
        <select
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
          <button type="button" className={knopf} onClick={neuesAnlegen}>
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

      <nav className="flex flex-wrap items-center gap-2" aria-label="Schritte">
        {SCHRITTE.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => (i < schritt || (i <= schritt + 1 && weiterErlaubt)) && setSchritt(i)}
            className={`h-11 rounded-full px-4 text-sm font-medium transition ${
              i === schritt
                ? 'bg-akzent text-white'
                : i < schritt
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {i + 1}. {name}
          </button>
        ))}
      </nav>

      {schritt === 0 && <SchrittProjekt projekt={projekt} onChange={setProjekt} />}
      {schritt === 1 && <SchrittFlaechen projekt={projekt} onChange={setProjekt} />}
      {schritt === 2 && <SchrittBelegung projekt={projekt} onChange={setProjekt} />}
      {schritt === 3 && <SchrittStrings projekt={projekt} onChange={setProjekt} />}
      {schritt === 4 && <SchrittExport projekt={projekt} />}

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
