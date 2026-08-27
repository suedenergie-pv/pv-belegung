'use client';

import { useEffect, useId, useState } from 'react';
import {
  artVon,
  fmtDe,
  fotoZuordnungenVon,
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
  max,
}: {
  label: string;
  value: number;
  onChange: (wert: number) => void;
  min?: number;
  max?: number;
}) {
  const [eingabe, setEingabe] = useState(String(value));
  const fehlerId = useId();
  useEffect(() => setEingabe(Number.isFinite(value) ? String(value) : ''), [value]);
  const pruefe = (roh: string): { wert?: number; fehler?: string } => {
    if (roh.trim() === '') return { fehler: `${label} ist erforderlich.` };
    const wert = Number(roh);
    if (!Number.isFinite(wert)) return { fehler: `${label} muss eine Zahl sein.` };
    if (min !== undefined && wert < min) return { fehler: `${label} muss mindestens ${min} sein.` };
    if (max !== undefined && wert > max) return { fehler: `${label} darf höchstens ${max} sein.` };
    return { wert };
  };
  const ergebnis = pruefe(eingabe);
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={0.1}
          value={eingabe}
          aria-invalid={!!ergebnis.fehler}
          aria-describedby={ergebnis.fehler ? fehlerId : undefined}
          onChange={(e) => {
            const roh = e.target.value;
            setEingabe(roh);
            const neu = pruefe(roh);
            if (neu.wert !== undefined) onChange(neu.wert);
          }}
          className={`${inputKlasse} ${ergebnis.fehler ? 'border-red-400' : ''}`}
        />
        <span className="text-sm text-slate-500">m</span>
      </span>
      {ergebnis.fehler && <span id={fehlerId} className="mt-1 block max-w-36 text-xs text-red-600">{ergebnis.fehler}</span>}
    </label>
  );
}

export function FlaechenInlineEditor({
  projekt,
  flaeche,
  index,
  onProjektChange,
  onPatch,
  onFotoPruefen,
  fotoFokusAktiv = false,
  onLoeschen,
  flaecheKwp,
  gesamtKwp,
}: {
  projekt: Projekt;
  flaeche: Flaeche;
  index: number;
  onProjektChange: (projekt: Projekt) => void;
  onPatch: (patch: Partial<Flaeche>) => void;
  onFotoPruefen?: () => void;
  fotoFokusAktiv?: boolean;
  onLoeschen?: () => void;
  flaecheKwp: number;
  gesamtKwp: number;
}) {
  const [offen, setOffen] = useState(!flaeche.grunddatenFertig);
  const art = artVon(flaeche);
  const form = flaeche.dachform ?? 'rechteck';

  const setForm = (dachform: Dachform) => {
    if (dachform === form) return;
    const felder = flaeche.felder?.length ?? 0;
    const inaktive = flaeche.felder?.reduce((summe, feld) => summe + (feld.leer?.length ?? 0), 0) ?? 0;
    const perspektiven = fotoZuordnungenVon(flaeche).length;
    const folgen = [
      felder > 0 ? `${felder} Belegungsbereich${felder === 1 ? '' : 'e'} wird zurückgesetzt` : '',
      inaktive > 0 ? `${inaktive} einzeln abgeschaltete Module werden zurückgesetzt` : '',
      flaeche.umrissM ? 'der manuelle Umriss wird entfernt' : '',
      perspektiven > 0 ? `die ${perspektiven === 1 ? 'Fotoperspektive bleibt zugeordnet, muss' : 'Fotoperspektiven bleiben zugeordnet, müssen'} neu bestätigt werden` : '',
    ].filter(Boolean);
    if (folgen.length > 0 && !window.confirm(`Dachform ändern? ${folgen.join('; ')}.`)) return;
    const wechselReset: Partial<Flaeche> = {
      felder: [],
      inaktiv: [],
      fotoZuordnungen: fotoZuordnungenVon(flaeche).map((zuordnung) => ({
        ...zuordnung,
        perspektiveBestaetigt: false,
        markierungFertig: false,
      })),
    };
    if (dachform === 'rechteck') {
      onPatch({
        ...wechselReset,
        dachform,
        firstBreiteM: undefined,
        firstVersatzM: undefined,
        umrissM: undefined,
      });
    } else if (dachform === 'trapez') {
      onPatch({
        ...wechselReset,
        dachform,
        firstBreiteM:
          flaeche.firstBreiteM ?? Math.round(flaeche.breiteM * 0.6 * 10) / 10,
        firstVersatzM: undefined,
        umrissM: undefined,
      });
    } else {
      onPatch({
        ...wechselReset,
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
    <>
      <div
        id={`flaechen-masse-${flaeche.id}`}
        className="relative z-20 mb-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:sticky lg:top-16"
      >
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

          {offen ? (
            <span className="self-center text-sm text-slate-500">
              {form === 'rechteck' ? 'Rechteck' : form === 'trapez' ? 'Trapez / Walm' : 'Schief'} ·{' '}
              {flaeche.breiteM} × {flaeche.hoeheM} m
            </span>
          ) : art !== 'flachdach' && (
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

          {!offen && (
            <>
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
                  max={flaeche.breiteM}
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
            </>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2 self-end">
            <span
              aria-label={`Leistung ${flaeche.name}: ${fmtDe(flaecheKwp, 2)} kWp`}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-akzent/10 px-3 text-sm text-akzent"
            >
              <span className="text-xs font-semibold uppercase tracking-wide">Fläche</span>
              <strong className="text-base tabular-nums">{fmtDe(flaecheKwp, 2)} kWp</strong>
            </span>
            <span
              aria-label={`Gesamtleistung: ${fmtDe(gesamtKwp, 2)} kWp`}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm text-white"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Gesamt
              </span>
              <strong className="text-base tabular-nums">{fmtDe(gesamtKwp, 2)} kWp</strong>
            </span>
            {onFotoPruefen && (
              <button
                type="button"
                aria-pressed={fotoFokusAktiv}
                className={`h-11 rounded-lg border px-4 text-sm font-semibold transition ${
                  fotoFokusAktiv
                    ? 'border-akzent bg-akzent text-white'
                    : 'border-akzent/40 bg-akzent/5 text-akzent hover:bg-akzent/10'
                }`}
                onClick={onFotoPruefen}
              >
                {fotoFokusAktiv ? 'Foto im Blick' : 'Am Foto anpassen'}
              </button>
            )}
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
      </div>

      {offen && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
    </>
  );
}
