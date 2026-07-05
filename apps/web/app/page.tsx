'use client';

import { useEffect, useState } from 'react';
import { SchrittBelegung } from '../components/SchrittBelegung';
import { SchrittExport } from '../components/SchrittExport';
import { SchrittFlaechen } from '../components/SchrittFlaechen';
import { SchrittProjekt } from '../components/SchrittProjekt';
import { SchrittStrings } from '../components/SchrittStrings';
import { ladeStand, loescheStand, neuesProjekt, speichereStand, type Projekt } from '../lib/model';

const SCHRITTE = ['Projekt', 'Dachflächen', 'Belegung', 'Stringplan', 'Export'] as const;

export default function Home() {
  const [projekt, setProjekt] = useState<Projekt>(neuesProjekt);
  const [schritt, setSchritt] = useState(0);
  // localStorage erst nach dem Mount lesen (SSR-Hydration), danach jede Änderung sichern
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    const stand = ladeStand();
    if (stand) {
      setProjekt(stand.projekt);
      setSchritt(stand.schritt);
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (geladen) speichereStand(projekt, schritt);
  }, [geladen, projekt, schritt]);

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

  return (
    <div className="space-y-5 pb-10">
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
        <button
          type="button"
          className="ml-auto h-11 rounded-full px-4 text-sm font-medium text-slate-400 hover:text-red-500"
          onClick={() => {
            if (!window.confirm('Projekt verwerfen und neu beginnen?')) return;
            loescheStand();
            setProjekt(neuesProjekt());
            setSchritt(0);
          }}
        >
          Neu beginnen
        </button>
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
