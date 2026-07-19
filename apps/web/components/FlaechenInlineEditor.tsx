'use client';

import { useState } from 'react';
import {
  artVon,
  type Dachform,
  type Flaeche,
  type Projekt,
  zonenVon,
} from '../lib/model';
import { SchrittFlaechen } from './SchrittFlaechen';
import { ZonenBadge } from './ui';

const inputKlasse =
  'h-11 w-24 rounded-lg border border-slate-300 bg-white px-2 text-base tabular-nums text-slate-800 focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30';

function KompaktZahl({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (wert: number) => void;
  min?: number;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={0.1}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const wert = Number.parseFloat(e.target.value);
            if (Number.isFinite(wert) && (min === undefined || wert >= min)) onChange(wert);
          }}
          className={inputKlasse}
        />
        <span className="text-sm text-slate-500">m</span>
      </span>
    </label>
  );
}

export function FlaechenInlineEditor({
  projekt,
  flaeche,
  index,
  onProjektChange,
  onPatch,
  onLoeschen,
}: {
  projekt: Projekt;
  flaeche: Flaeche;
  index: number;
  onProjektChange: (projekt: Projekt) => void;
  onPatch: (patch: Partial<Flaeche>) => void;
  onLoeschen?: () => void;
}) {
  const [offen, setOffen] = useState(!flaeche.grunddatenFertig);
  const art = artVon(flaeche);
  const form = flaeche.dachform ?? 'rechteck';

  const setForm = (dachform: Dachform) => {
    if (dachform === 'rechteck') {
      onPatch({
        dachform,
        firstBreiteM: undefined,
        firstVersatzM: undefined,
        umrissM: undefined,
      });
    } else if (dachform === 'trapez') {
      onPatch({
        dachform,
        firstBreiteM:
          flaeche.firstBreiteM ?? Math.round(flaeche.breiteM * 0.6 * 10) / 10,
        firstVersatzM: undefined,
        umrissM: undefined,
      });
    } else {
      onPatch({
        dachform,
        firstBreiteM: flaeche.firstBreiteM ?? flaeche.breiteM,
        firstVersatzM: flaeche.firstVersatzM ?? 1,
        umrissM: undefined,
      });
    }
  };

  const breiteLabel = art === 'dach' ? 'Traufe' : 'Breite';
  const hoeheLabel = art === 'dach' ? 'Sparren' : art === 'fassade' ? 'Höhe' : 'Tiefe';

  return (
    <div className="mb-4">
      <div className="sticky top-2 z-20 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-1 flex min-w-40 items-center gap-2 self-center">
            <ZonenBadge label={zonenVon(flaeche, index)} />
            <div>
              <strong className="block text-sm text-slate-800">{flaeche.name}</strong>
              <span className="text-xs text-slate-500">
                {art === 'dach' ? 'Schrägdach' : art === 'flachdach' ? 'Flachdach' : 'Fassade'}
              </span>
            </div>
          </div>

          {art !== 'flachdach' && (
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Form</span>
              <select
                aria-label={`Form von ${flaeche.name}`}
                value={form}
                onChange={(e) => setForm(e.target.value as Dachform)}
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
              >
                <option value="rechteck">Rechteck</option>
                <option value="trapez">Trapez / Walm</option>
                <option value="schief">Schief</option>
              </select>
            </label>
          )}

          <KompaktZahl
            label={breiteLabel}
            value={flaeche.breiteM}
            min={1}
            onChange={(breiteM) => onPatch({ breiteM })}
          />
          <KompaktZahl
            label={hoeheLabel}
            value={flaeche.hoeheM}
            min={1}
            onChange={(hoeheM) => onPatch({ hoeheM })}
          />
          {(form === 'trapez' || form === 'schief') && art !== 'flachdach' && (
            <KompaktZahl
              label="First"
              value={flaeche.firstBreiteM ?? flaeche.breiteM}
              min={0}
              onChange={(firstBreiteM) => onPatch({ firstBreiteM })}
            />
          )}
          {form === 'schief' && art !== 'flachdach' && (
            <KompaktZahl
              label="Versatz"
              value={flaeche.firstVersatzM ?? 0}
              onChange={(firstVersatzM) => onPatch({ firstVersatzM })}
            />
          )}

          <div className="ml-auto flex gap-2 self-end">
            <button
              type="button"
              aria-expanded={offen}
              className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-400"
              onClick={() => setOffen((wert) => !wert)}
            >
              {offen ? 'Details schließen' : 'Details'}
            </button>
            {onLoeschen && (
              <button
                type="button"
                className="h-11 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={onLoeschen}
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Maße ändern die sichtbare Modulgröße sofort; die gesetzten Fotoecken bleiben stehen.
        </p>
      </div>

      {offen && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <SchrittFlaechen
            projekt={projekt}
            onChange={onProjektChange}
            nurFlaecheId={flaeche.id}
            eingebettet
            onFertig={() => {
              onPatch({ grunddatenFertig: true });
              setOffen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
