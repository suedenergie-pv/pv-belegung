'use client';

import { INVERTERS, maxModulesPerString, minModulesPerString } from '@pv-belegung/engine';
import {
  aktiveModule,
  fmtDe,
  modulById,
  pruefeStringplan,
  rasterFuer,
  wrById,
  zuordnungsHinweise,
  type Projekt,
  type UiStringDef,
} from '../lib/model';
import { Feld, inputKlasse, Karte, KartenTitel } from './ui';

/** lesbare, eindeutige String-Bezeichnung „<MPPT>.<Nr>" — taucht in Engine-Meldungen auf */
function freieStringId(mpptIdx: number, vorhandene: UiStringDef[]): string {
  let n = 1;
  while (vorhandene.some((s) => s.id === `${mpptIdx + 1}.${n}`)) n++;
  return `${mpptIdx + 1}.${n}`;
}

export function SchrittStrings({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  const modul = modulById(projekt.modulId);
  const wr = projekt.wrId ? wrById(projekt.wrId) : null;
  const result = pruefeStringplan(projekt);
  const zuordnung = zuordnungsHinweise(projekt);

  const setMpptStrings = (mpptIdx: number, strings: UiStringDef[]) =>
    onChange({
      ...projekt,
      mppts: projekt.mppts.map((s, i) => (i === mpptIdx ? strings : s)),
    });

  const hatStrings = projekt.mppts.some((s) => s.length > 0);
  const ampel = !result
    ? null
    : !result.valid
      ? 'rot'
      : Object.values(result.regeln).includes('warn')
        ? 'gelb'
        : 'gruen';

  return (
    <div className="space-y-4">
      <Karte>
        <KartenTitel>
          Wechselrichter <span className="font-normal text-slate-400">(optional — für den Stringplan)</span>
        </KartenTitel>
        <Feld label="Modell">
          <select
            className={inputKlasse}
            value={projekt.wrId ?? ''}
            onChange={(e) => {
              const wrId = e.target.value || null;
              const neuerWr = wrId ? wrById(wrId) : null;
              onChange({
                ...projekt,
                wrId,
                mppts: neuerWr ? Array.from({ length: neuerWr.mpptCount }, () => []) : [],
              });
            }}
          >
            <option value="">— kein Stringplan —</option>
            {['EcoFlow', 'Sigenergy', 'Sungrow'].map((hersteller) => (
              <optgroup key={hersteller} label={hersteller}>
                {INVERTERS.filter((w) => w.manufacturer === hersteller).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Feld>
        {wr && (
          <p className="mt-2 text-xs text-slate-500">
            {wr.mpptCount} MPPTs · maxDC {fmtDe(wr.maxDcVoltageV, 0)} V · MPPT{' '}
            {fmtDe(wr.mpptVoltageRange[0], 0)}–{fmtDe(wr.mpptVoltageRange[1], 0)} V · sinnvolle
            Stringlänge mit {modul.name.split(' ')[0]}: {minModulesPerString(modul, wr)}–
            {maxModulesPerString(modul, wr)} Module
          </p>
        )}
      </Karte>

      {wr &&
        projekt.mppts.map((strings, i) => (
          <Karte key={i}>
            <div className="mb-3 flex items-center justify-between">
              <KartenTitel>MPPT {i + 1}</KartenTitel>
              <span className="text-xs text-slate-400">
                max. {wr.stringsPerMppt[i]} String{wr.stringsPerMppt[i] === 1 ? '' : 's'} ·{' '}
                {fmtDe(wr.maxInputCurrentPerMpptA[i]!, 0)} A / SC{' '}
                {fmtDe(wr.maxShortCircuitCurrentPerMpptA[i]!, 0)} A
              </span>
            </div>

            {strings.map((s) => (
              <div key={s.id} className="mb-2 flex items-center gap-2">
                <select
                  className="h-12 flex-1 rounded-xl border border-slate-300 px-3"
                  value={s.flaecheId}
                  onChange={(e) =>
                    setMpptStrings(
                      i,
                      strings.map((x) => (x.id === s.id ? { ...x, flaecheId: e.target.value } : x)),
                    )
                  }
                >
                  {projekt.flaechen.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="h-12 w-24 rounded-xl border border-slate-300 px-3 text-center"
                  value={s.anzahl}
                  onChange={(e) =>
                    setMpptStrings(
                      i,
                      strings.map((x) =>
                        x.id === s.id
                          ? { ...x, anzahl: Number.parseInt(e.target.value, 10) || 0 }
                          : x,
                      ),
                    )
                  }
                />
                <span className="text-sm text-slate-400">Module</span>
                <button
                  type="button"
                  className="h-12 w-12 rounded-xl border border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500"
                  onClick={() => setMpptStrings(i, strings.filter((x) => x.id !== s.id))}
                >
                  ✕
                </button>
              </div>
            ))}

            {strings.length < (wr.stringsPerMppt[i] ?? 1) && (
              <button
                type="button"
                className="h-12 w-full rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-akzent hover:text-akzent"
                onClick={() => {
                  const ersteFlaeche = projekt.flaechen[0]!;
                  const vorschlag = Math.min(
                    maxModulesPerString(modul, wr),
                    aktiveModule(ersteFlaeche, rasterFuer(ersteFlaeche, modul)) || 1,
                  );
                  setMpptStrings(i, [
                    ...strings,
                    { id: freieStringId(i, strings), flaecheId: ersteFlaeche.id, anzahl: vorschlag },
                  ]);
                }}
              >
                + String anlegen
              </button>
            )}
          </Karte>
        ))}

      {wr && hatStrings && (
        <Karte
          className={
            ampel === 'gruen'
              ? 'border-green-300 bg-green-50'
              : ampel === 'gelb'
                ? 'border-amber-300 bg-amber-50'
                : 'border-red-300 bg-red-50'
          }
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-block h-4 w-4 rounded-full ${
                ampel === 'gruen' ? 'bg-green-500' : ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500'
              }`}
            />
            <span className="font-semibold">
              {ampel === 'gruen'
                ? 'Stringplan gültig — alle Regeln bestanden'
                : ampel === 'gelb'
                  ? 'Stringplan gültig, mit Warnung'
                  : 'Stringplan UNGÜLTIG — nicht exportierbar'}
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            {result?.results
              .filter((r) => r.status !== 'ok')
              .map((r, idx) => (
                <li key={idx} className={r.status === 'fail' ? 'text-red-700' : 'text-amber-700'}>
                  <span className="font-mono font-semibold">{r.rule}</span> — {r.message}
                </li>
              ))}
            {zuordnung.fehler.map((t, idx) => (
              <li key={`f${idx}`} className="text-red-700">
                <span className="font-mono font-semibold">Zuordnung</span> — {t}
              </li>
            ))}
            {zuordnung.hinweise.map((t, idx) => (
              <li key={`h${idx}`} className="text-amber-700">
                <span className="font-mono font-semibold">Hinweis</span> — {t}
              </li>
            ))}
          </ul>
        </Karte>
      )}

      {!wr && (
        <p className="text-sm text-slate-400">
          Ohne Wechselrichter wird nur die Belegung exportiert — der Stringplan ist optional.
        </p>
      )}
    </div>
  );
}
