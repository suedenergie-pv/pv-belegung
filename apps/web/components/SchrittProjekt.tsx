'use client';

import React from 'react';
import { MODULES } from '@pv-belegung/engine';
import { fmtDe, type Projekt } from '../lib/model';
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
              <button
                key={m.id}
                type="button"
                aria-pressed={aktiv}
                onClick={() => onChange({ ...projekt, modulId: m.id })}
                className={`rounded-xl border p-4 text-left transition ${
                  aktiv
                    ? 'border-akzent bg-akzent/5 ring-2 ring-akzent/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-sm font-semibold text-slate-800">{m.name}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {m.pmaxW} <span className="text-sm font-medium text-slate-500">Wp</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {m.lengthMm} × {m.widthMm} mm · {fmtDe(m.weightKg, 1)} kg · {m.cells} Zellen
                </div>
                <div className="text-xs text-slate-500">
                  Voc {fmtDe(m.vocV)} V · Isc {fmtDe(m.iscA)} A
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Ein Modultyp pro Projekt (R10). Werte aus Hersteller-Datenblättern.
        </p>
      </Karte>
    </div>
  );
}
