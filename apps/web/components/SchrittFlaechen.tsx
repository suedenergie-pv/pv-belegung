'use client';

import {
  AZIMUT_PRESETS,
  DACHFARBEN,
  neueFlaeche,
  type Flaeche,
  type Projekt,
} from '../lib/model';
import { Feld, inputKlasse, Karte, KartenTitel, ToggleButton } from './ui';

function ZahlenFeld({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  einheit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  einheit?: string;
}) {
  return (
    <Feld label={einheit ? `${label} (${einheit})` : label}>
      <input
        type="number"
        inputMode="decimal"
        className={inputKlasse}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
    </Feld>
  );
}

export function SchrittFlaechen({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  const setFlaeche = (id: string, patch: Partial<Flaeche>) =>
    onChange({
      ...projekt,
      flaechen: projekt.flaechen.map((f) => (f.id === id ? { ...f, ...patch, inaktiv: [] } : f)),
    });

  return (
    <div className="space-y-4">
      {projekt.flaechen.map((f) => (
        <Karte key={f.id}>
          <div className="mb-4 flex items-center justify-between">
            <KartenTitel>{f.name}</KartenTitel>
            {projekt.flaechen.length > 1 && (
              <button
                type="button"
                className="text-sm font-medium text-red-500 hover:text-red-600"
                onClick={() =>
                  onChange({
                    ...projekt,
                    flaechen: projekt.flaechen.filter((x) => x.id !== f.id),
                    mppts: projekt.mppts.map((strings) =>
                      strings.filter((s) => s.flaecheId !== f.id),
                    ),
                  })
                }
              >
                Entfernen
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ZahlenFeld
              label="Breite Traufe"
              einheit="m"
              value={f.breiteM}
              min={1}
              onChange={(v) => setFlaeche(f.id, { breiteM: v })}
            />
            <ZahlenFeld
              label="Sparrenlänge, wahres Maß"
              einheit="m"
              value={f.hoeheM}
              min={1}
              onChange={(v) => setFlaeche(f.id, { hoeheM: v })}
            />
            <ZahlenFeld
              label="Dachneigung"
              einheit="°"
              value={f.neigungDeg}
              min={0}
              max={75}
              step={1}
              onChange={(v) => setFlaeche(f.id, { neigungDeg: v })}
            />
          </div>

          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-600">Ausrichtung (Azimut)</span>
            <div className="flex flex-wrap gap-2">
              {AZIMUT_PRESETS.map((a) => (
                <ToggleButton
                  key={a.deg}
                  aktiv={f.azimutDeg === a.deg}
                  onClick={() => setFlaeche(f.id, { azimutDeg: a.deg })}
                >
                  {a.label}
                </ToggleButton>
              ))}
              <input
                type="number"
                inputMode="numeric"
                className="h-12 w-24 rounded-xl border border-slate-300 px-3 text-base"
                value={f.azimutDeg}
                min={0}
                max={359}
                onChange={(e) => setFlaeche(f.id, { azimutDeg: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-600">Dachfarbe</span>
            <div className="flex gap-2">
              {DACHFARBEN.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  title={d.name}
                  onClick={() => setFlaeche(f.id, { dachfarbe: d.id })}
                  className={`h-12 w-12 rounded-xl border-2 transition ${
                    f.dachfarbe === d.id ? 'border-akzent ring-2 ring-akzent/40' : 'border-white shadow'
                  }`}
                  style={{ backgroundColor: d.fill }}
                />
              ))}
            </div>
          </div>

          {(f.neigungDeg < 0 || f.neigungDeg > 75 || !Number.isFinite(f.neigungDeg)) && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              Neigung muss zwischen 0° und 75° liegen (Pflichtfeld — sonst ist die Belegung gesperrt).
            </p>
          )}
        </Karte>
      ))}

      <button
        type="button"
        className="h-12 w-full rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-akzent hover:text-akzent"
        onClick={() => {
          const nr =
            Math.max(0, ...projekt.flaechen.map((f) => Number.parseInt(f.id.slice(1), 10) || 0)) + 1;
          onChange({ ...projekt, flaechen: [...projekt.flaechen, neueFlaeche(nr)] });
        }}
      >
        + Weitere Dachfläche
      </button>

      <p className="text-xs text-slate-400">
        Maße bitte als Aufmaß-Werte (wahre Maße) eingeben — die Sparrenlänge NICHT aus der
        Draufsicht/Luftbild ablesen (Verkürzung!).
      </p>
    </div>
  );
}
