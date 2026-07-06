'use client';

import { useState } from 'react';
import {
  aktiveModule,
  fmtDe,
  modulById,
  randVon,
  rasterFuer,
  umrissVon,
  type Flaeche,
  type Projekt,
  type PunktM,
} from '../lib/model';
import { DACHFARBEN } from '../lib/model';
import { DachSvg } from './DachSvg';
import { FotoHintergrund } from './FotoHintergrund';
import { Karte, KartenTitel, ToggleButton } from './ui';

/** Laufende Zeichnung (Umriss oder Hindernis) — immer nur eine Fläche gleichzeitig */
interface Zeichnung {
  flaecheId: string;
  art: 'umriss' | 'hindernis';
  punkte: PunktM[];
}

export function SchrittBelegung({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  const modul = modulById(projekt.modulId);
  const [zeichnung, setZeichnung] = useState<Zeichnung | null>(null);
  const gesamt = projekt.flaechen.reduce(
    (sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)),
    0,
  );
  const kwp = (gesamt * modul.pmaxW) / 1000;

  const patchFlaeche = (id: string, patch: Partial<Flaeche>) =>
    onChange({
      ...projekt,
      flaechen: projekt.flaechen.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });

  const klickM = (f: Flaeche, p: PunktM) => {
    if (!zeichnung || zeichnung.flaecheId !== f.id) return;
    if (zeichnung.art === 'umriss') {
      // Klick nahe am ersten Punkt schließt das Polygon (ab 3 Ecken)
      const schwelle = Math.max(0.25, 0.02 * Math.max(f.breiteM, f.hoeheM));
      const erster = zeichnung.punkte[0];
      if (
        zeichnung.punkte.length >= 3 &&
        erster &&
        Math.hypot(p[0] - erster[0], p[1] - erster[1]) <= schwelle
      ) {
        patchFlaeche(f.id, { umrissM: zeichnung.punkte });
        setZeichnung(null);
        return;
      }
      setZeichnung({ ...zeichnung, punkte: [...zeichnung.punkte, p] });
      return;
    }
    // Hindernis: 2 Klicks = gegenüberliegende Ecken; Modus bleibt aktiv für weitere
    if (zeichnung.punkte.length === 0) {
      setZeichnung({ ...zeichnung, punkte: [p] });
      return;
    }
    const [a] = zeichnung.punkte as [PunktM];
    const rect = {
      xM: Math.min(a[0], p[0]),
      yM: Math.min(a[1], p[1]),
      breiteM: Math.abs(p[0] - a[0]),
      hoeheM: Math.abs(p[1] - a[1]),
    };
    if (rect.breiteM > 0.02 && rect.hoeheM > 0.02) {
      patchFlaeche(f.id, { hindernisse: [...(f.hindernisse ?? []), rect] });
    }
    setZeichnung({ ...zeichnung, punkte: [] });
  };

  return (
    <div className="space-y-4">
      <Karte className="border-akzent/30 bg-gradient-to-r from-white to-akzent/5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <span className="text-4xl font-bold text-slate-900">{fmtDe(kwp, 2)}</span>
            <span className="ml-1 text-lg font-semibold text-slate-500">kWp</span>
          </div>
          <div className="text-sm text-slate-500">
            {gesamt} Module · {modul.name}
          </div>
        </div>
      </Karte>

      {projekt.flaechen.map((f) => {
        const raster = rasterFuer(f, modul);
        const aktiv = aktiveModule(f, raster);
        const zeichneHier = zeichnung?.flaecheId === f.id ? zeichnung : null;
        // Zeichnen braucht eine klickbare Ansicht: Draufsicht oder 4-Ecken-Foto
        // (die Alt-Ansicht „nur Traufkante" hat keine Rückrechnung)
        const zeichenbar = !f.foto || !!f.foto.eckenPx;
        return (
          <Karte key={f.id}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <KartenTitel>{f.name}</KartenTitel>
              <span className="ml-auto text-sm text-slate-500">
                {aktiv} / {raster.positionen.length} Module ·{' '}
                {fmtDe((aktiv * modul.pmaxW) / 1000, 2)} kWp
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ToggleButton
                aktiv={f.ausrichtung === 'quer'}
                onClick={() =>
                  onChange({
                    ...projekt,
                    flaechen: projekt.flaechen.map((x) =>
                      x.id === f.id ? { ...x, ausrichtung: 'quer', inaktiv: [] } : x,
                    ),
                  })
                }
              >
                ▭ Quer
              </ToggleButton>
              <ToggleButton
                aktiv={f.ausrichtung === 'hoch'}
                onClick={() =>
                  onChange({
                    ...projekt,
                    flaechen: projekt.flaechen.map((x) =>
                      x.id === f.id ? { ...x, ausrichtung: 'hoch', inaktiv: [] } : x,
                    ),
                  })
                }
              >
                ▯ Hochkant
              </ToggleButton>

              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                Rand
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(randVon(f) * 100)}
                  onChange={(e) => {
                    const cm = Number.parseInt(e.target.value, 10);
                    if (!Number.isFinite(cm) || cm < 0) return;
                    onChange({
                      ...projekt,
                      flaechen: projekt.flaechen.map((x) =>
                        x.id === f.id ? { ...x, randM: cm / 100, inaktiv: [] } : x,
                      ),
                    });
                  }}
                  className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
                />
                cm
              </label>

              <div className="ml-auto flex gap-1.5">
                {DACHFARBEN.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    title={d.name}
                    onClick={() =>
                      onChange({
                        ...projekt,
                        flaechen: projekt.flaechen.map((x) =>
                          x.id === f.id ? { ...x, dachfarbe: d.id } : x,
                        ),
                      })
                    }
                    className={`h-9 w-9 rounded-lg border-2 ${
                      f.dachfarbe === d.id ? 'border-akzent' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: d.fill }}
                  />
                ))}
              </div>
            </div>

            <FotoHintergrund
              flaeche={f}
              onPatch={(patch) =>
                onChange({
                  ...projekt,
                  flaechen: projekt.flaechen.map((x) => (x.id === f.id ? { ...x, ...patch } : x)),
                })
              }
            />

            {zeichenbar && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {!zeichneHier && (
                  <>
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
                      onClick={() => setZeichnung({ flaecheId: f.id, art: 'umriss', punkte: [] })}
                    >
                      ⬠ Umriss zeichnen{f.umrissM ? ' (neu)' : ''}
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
                      onClick={() =>
                        setZeichnung({ flaecheId: f.id, art: 'hindernis', punkte: [] })
                      }
                    >
                      ▭ Hindernis markieren
                    </button>
                    {f.umrissM && (
                      <button
                        type="button"
                        className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
                        onClick={() => patchFlaeche(f.id, { umrissM: undefined })}
                      >
                        Umriss entfernen ({f.umrissM.length} Ecken)
                      </button>
                    )}
                  </>
                )}
                {zeichneHier?.art === 'umriss' && (
                  <>
                    <button
                      type="button"
                      disabled={zeichneHier.punkte.length < 3}
                      className="h-9 rounded-lg bg-akzent px-3 text-sm font-semibold text-white disabled:opacity-40"
                      onClick={() => {
                        patchFlaeche(f.id, { umrissM: zeichneHier.punkte });
                        setZeichnung(null);
                      }}
                    >
                      ✓ Fertig ({zeichneHier.punkte.length} Ecken)
                    </button>
                    <button
                      type="button"
                      disabled={zeichneHier.punkte.length === 0}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-40"
                      onClick={() =>
                        setZeichnung({ ...zeichneHier, punkte: zeichneHier.punkte.slice(0, -1) })
                      }
                    >
                      ↶ Punkt zurück
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-500"
                      onClick={() => setZeichnung(null)}
                    >
                      Abbrechen
                    </button>
                    <span className="text-sm text-sky-800">
                      Ecke für Ecke am Rand entlang klicken — beliebig viele. Schließen: Klick auf
                      den ersten Punkt oder „Fertig".
                    </span>
                  </>
                )}
                {zeichneHier?.art === 'hindernis' && (
                  <>
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
                      onClick={() => setZeichnung(null)}
                    >
                      ✓ Fertig
                    </button>
                    <span className="text-sm text-sky-800">
                      {zeichneHier.punkte.length === 0
                        ? 'Erste Ecke des Hindernisses anklicken (Kamin, Fenster, SAT …).'
                        : 'Jetzt die gegenüberliegende Ecke anklicken — danach gleich das nächste Hindernis.'}
                    </span>
                  </>
                )}
                {!zeichneHier &&
                  (f.hindernisse ?? []).map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      title="Hindernis entfernen"
                      className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                      onClick={() =>
                        patchFlaeche(f.id, {
                          hindernisse: (f.hindernisse ?? []).filter((_, j) => j !== i),
                        })
                      }
                    >
                      {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m ✕
                    </button>
                  ))}
              </div>
            )}

            {raster.positionen.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Fläche zu klein für dieses Modul (inkl. {Math.round(randVon(f) * 100)} cm
                Randabstand){umrissVon(f) ? ' — oder die Dachform lässt kein Modul komplett zu' : ''}.
              </p>
            ) : f.foto && !f.foto.traufePx && !f.foto.eckenPx ? null : (
              <DachSvg
                flaeche={f}
                raster={raster}
                modul={modul}
                zeichnen={
                  zeichneHier
                    ? {
                        aktiv: true,
                        punkteM: zeichneHier.punkte,
                        onKlickM: (p) => klickM(f, p),
                      }
                    : undefined
                }
                onToggle={(key) =>
                  onChange({
                    ...projekt,
                    flaechen: projekt.flaechen.map((x) =>
                      x.id === f.id
                        ? {
                            ...x,
                            inaktiv: x.inaktiv.includes(key)
                              ? x.inaktiv.filter((k) => k !== key)
                              : [...x.inaktiv, key],
                          }
                        : x,
                    ),
                  })
                }
              />
            )}
            <p className="mt-2 text-xs text-slate-400">
              Module antippen zum Deaktivieren — für Kamin/Fenster/SAT besser „Hindernis
              markieren" (rechnet automatisch). Randabstand {Math.round(randVon(f) * 100)} cm,
              Klemmfuge 20 mm{f.umrissM ? `, Umriss mit ${f.umrissM.length} Ecken aktiv` : ''}.
            </p>
          </Karte>
        );
      })}
    </div>
  );
}
