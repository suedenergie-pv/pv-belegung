'use client';

import { aktiveModule, fmtDe, modulById, randVon, rasterFuer, type Projekt } from '../lib/model';
import { DACHFARBEN } from '../lib/model';
import { DachSvg } from './DachSvg';
import { FotoHintergrund } from './FotoHintergrund';
import { Karte, KartenTitel, ToggleButton } from './ui';

export function SchrittBelegung({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  const modul = modulById(projekt.modulId);
  const gesamt = projekt.flaechen.reduce(
    (sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)),
    0,
  );
  const kwp = (gesamt * modul.pmaxW) / 1000;

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
              onFoto={(foto) =>
                onChange({
                  ...projekt,
                  flaechen: projekt.flaechen.map((x) => (x.id === f.id ? { ...x, foto } : x)),
                })
              }
            />

            {raster.positionen.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Fläche zu klein für dieses Modul (inkl. {Math.round(randVon(f) * 100)} cm
                Randabstand).
              </p>
            ) : f.foto && !f.foto.traufePx ? null : (
              <DachSvg
                flaeche={f}
                raster={raster}
                modul={modul}
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
              Module antippen zum Deaktivieren (Kamin, Fenster, SAT …). Randabstand{' '}
              {Math.round(randVon(f) * 100)} cm, Klemmfuge 20 mm.
            </p>
          </Karte>
        );
      })}
    </div>
  );
}
