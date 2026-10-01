'use client';

import React from 'react';
import { MODULES } from '@pv-belegung/engine';
import { fmtDe, type Projekt } from '../lib/model';
import { modulAssetInner } from '../lib/modul-assets';
import { Feld, inputKlasse, Karte, KartenTitel } from './ui';

export function SchrittProjekt({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  return (
    <div className="space-y-4">
      <Karte>
        <KartenTitel>Projekt</KartenTitel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feld label="Kunde">
            <input
              id="projekt-kunde"
              className={inputKlasse}
              value={projekt.kunde}
              onChange={(e) => onChange({ ...projekt, kunde: e.target.value })}
              placeholder="z. B. Familie Muster"
            />
          </Feld>
          <Feld label="Adresse">
            <input
              id="projekt-adresse"
              className={inputKlasse}
              value={projekt.adresse}
              onChange={(e) => onChange({ ...projekt, adresse: e.target.value })}
              placeholder="Straße, PLZ Ort"
            />
          </Feld>
          <Feld label="Erfasser (Vertrieb)">
            <input
              id="projekt-erfasser"
              className={inputKlasse}
              value={projekt.erfasser ?? ''}
              onChange={(e) => onChange({ ...projekt, erfasser: e.target.value })}
              placeholder="Dein Name — erscheint im PDF"
            />
          </Feld>
        </div>
      </Karte>

      <Karte>
        <KartenTitel>Modul wählen</KartenTitel>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODULES.map((m) => {
            const aktiv = projekt.modulId === m.id;
            return (
              <div
                key={m.id}
                className={`rounded-xl border ${aktiv ? 'border-akzent bg-akzent/5 ring-2 ring-akzent/40' : 'border-slate-200 bg-white'}`}
              >
              <button
                type="button"
                aria-pressed={aktiv}
                onClick={() => onChange({ ...projekt, modulId: m.id })}
                className="flex w-full gap-4 rounded-xl p-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-akzent"
              >
                <svg aria-hidden="true" viewBox="0 0 260 404" className="h-24 w-16 shrink-0" dangerouslySetInnerHTML={{ __html: modulAssetInner(m.renderSymbol) }} />
                <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">{m.name}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {m.pmaxW} <span className="text-sm font-medium text-slate-600">Wp</span>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {m.lengthMm} × {m.widthMm} mm
                </div>
                </div>
              </button>
              <details className="border-t border-slate-200 px-4 pb-2 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium">Technische Daten</summary>
                <p>{fmtDe(m.weightKg, 1)} kg · {m.cells} Zellen</p>
                <p>Voc {fmtDe(m.vocV)} V · Isc {fmtDe(m.iscA)} A</p>
              </details>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Ein Modultyp pro Projekt (R10). Werte aus Hersteller-Datenblättern.
        </p>
      </Karte>
    </div>
  );
}
