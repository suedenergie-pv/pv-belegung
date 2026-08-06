'use client';

import {
  AZIMUT_PRESETS,
  artVon,
  farbenFuer,
  flachdachPitchDefault,
  flachdachRichtungsLabel,
  flachdachSuedRichtung,
  naechsteZone,
  neueFlaeche,
  patchFlaechenGeometrie,
  randDefaultVon,
  zonenVon,
  type Dachform,
  type DachfarbeId,
  type Flaeche,
  type FlaechenArt,
  type FlachdachSuedRichtung,
  type Projekt,
} from '../lib/model';
import { Karte, KartenTitel, ZonenBadge } from './ui';

const kompaktInput =
  'h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30';

function KompaktZahl({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  einheit,
  breite = 'w-24',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  einheit?: string;
  breite?: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block whitespace-nowrap text-xs font-medium text-slate-500">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          className={`${kompaktInput} ${breite}`}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        />
        {einheit && <span className="text-sm text-slate-500">{einheit}</span>}
      </span>
    </label>
  );
}

export function SchrittFlaechen({
  projekt,
  onChange,
  nurFlaecheId,
  eingebettet = false,
  onFertig,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
  nurFlaecheId?: string;
  eingebettet?: boolean;
  onFertig?: (flaecheId: string) => void;
}) {
  const setFlaeche = (id: string, patch: Partial<Flaeche>) =>
    onChange({
      ...projekt,
      flaechen: projekt.flaechen.map((f) =>
        f.id === id ? patchFlaechenGeometrie(f, patch) : f,
      ),
    });

  const formAendern = (f: Flaeche, dachform: Dachform) => {
    const altForm = f.dachform ?? 'rechteck';
    if (dachform === altForm) return;
    if (
      f.umrissM &&
      !window.confirm('Die Dachform ändern? Der manuell gezeichnete Umriss wird entfernt.')
    ) return;
    if (dachform === 'rechteck') {
      setFlaeche(f.id, {
        dachform,
        firstBreiteM: undefined,
        firstVersatzM: undefined,
        umrissM: undefined,
      });
    } else if (dachform === 'trapez') {
      setFlaeche(f.id, {
        dachform,
        firstBreiteM: f.firstBreiteM ?? Math.round(f.breiteM * 6) / 10,
        firstVersatzM: undefined,
        umrissM: undefined,
      });
    } else {
      setFlaeche(f.id, {
        dachform,
        firstBreiteM: f.firstBreiteM ?? f.breiteM,
        firstVersatzM: f.firstVersatzM ?? 1,
        umrissM: undefined,
      });
    }
  };

  const setArt = (f: Flaeche, art: FlaechenArt) => {
    if (artVon(f) === art) return;
    const patch: Partial<Flaeche> = { art, randM: undefined, dachform: 'rechteck' };
    if (art === 'flachdach') {
      patch.neigungDeg = 0;
      patch.flachdach = f.flachdach ?? {
        aufstaenderung: 'ostwest',
        winkelDeg: 10,
        richtungSued: 'unten',
      };
      patch.dachfarbe = 'bitumen';
    } else {
      patch.flachdach = undefined;
      if (art === 'fassade') {
        patch.neigungDeg = 90;
        patch.dachfarbe = 'putz';
      } else {
        patch.neigungDeg = 35;
        patch.dachfarbe = 'anthrazit';
      }
    }
    setFlaeche(f.id, patch);
  };

  const hauptflaechen = projekt.flaechen.filter(
    (f) => !f.gaubenTyp && (!nurFlaecheId || f.id === nurFlaecheId),
  );
  const naechsteNr = () =>
    Math.max(0, ...projekt.flaechen.map((f) => Number.parseInt(f.id.slice(1), 10) || 0)) + 1;

  return (
    <div className="space-y-4">
      {hauptflaechen.map((f, i) => (
        <Karte
          key={f.id}
          className={eingebettet ? 'border-0 bg-transparent p-0 shadow-none' : ''}
        >
          {!eingebettet && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZonenBadge label={zonenVon(f, i)} />
                <KartenTitel>{f.name}</KartenTitel>
              </div>
              {hauptflaechen.length > 1 && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 hover:text-red-600"
                  onClick={() =>
                    onChange({
                      ...projekt,
                      flaechen: projekt.flaechen.filter(
                        (x) => x.id !== f.id && x.elternFlaecheId !== f.id,
                      ),
                      mppts: projekt.mppts.map((strings) =>
                        strings.filter(
                          (s) =>
                            s.flaecheId !== f.id &&
                            !projekt.flaechen.some(
                              (x) => x.id === s.flaecheId && x.elternFlaecheId === f.id,
                            ),
                        ),
                      ),
                    })
                  }
                >
                  Entfernen
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Art der Fläche</span>
              <select
                aria-label="Art der Fläche"
                value={artVon(f)}
                onChange={(e) => setArt(f, e.target.value as FlaechenArt)}
                className={`${kompaktInput} w-44 font-medium`}
              >
                <option value="dach">Schrägdach</option>
                <option value="flachdach">Flachdach (aufgeständert)</option>
                {artVon(f) === 'fassade' && <option value="fassade">Fassade · Bestand</option>}
              </select>
            </label>
            <KompaktZahl
              label={artVon(f) === 'dach' ? 'Traufe' : 'Breite'}
              einheit="m"
              value={f.breiteM}
              min={1}
              onChange={(breiteM) => setFlaeche(f.id, { breiteM })}
            />
            <KompaktZahl
              label={artVon(f) === 'dach' ? 'Sparrenlänge' : artVon(f) === 'fassade' ? 'Höhe' : 'Tiefe'}
              einheit="m"
              value={f.hoeheM}
              min={1}
              onChange={(hoeheM) => setFlaeche(f.id, { hoeheM })}
            />
            {artVon(f) !== 'flachdach' && (
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Dachform</span>
                <select
                  aria-label="Dachform"
                  value={f.dachform ?? 'rechteck'}
                  onChange={(e) => formAendern(f, e.target.value as Dachform)}
                  className={`${kompaktInput} w-40 font-medium`}
                >
                  <option value="rechteck">Rechteck</option>
                  <option value="trapez">Trapez / Walm</option>
                  <option value="schief">Schief / Parallelogramm</option>
                </select>
              </label>
            )}
            {artVon(f) !== 'flachdach' && (
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Ausrichtung</span>
                <select
                  aria-label="Ausrichtung"
                  value={AZIMUT_PRESETS.some((a) => a.deg === f.azimutDeg) ? f.azimutDeg : 'frei'}
                  onChange={(e) => {
                    if (e.target.value !== 'frei') setFlaeche(f.id, { azimutDeg: Number(e.target.value) });
                  }}
                  className={`${kompaktInput} w-28 font-medium`}
                >
                  {AZIMUT_PRESETS.map((a) => <option key={a.deg} value={a.deg}>{a.label}</option>)}
                  <option value="frei">Frei</option>
                </select>
              </label>
            )}
            {artVon(f) !== 'flachdach' && (
              <KompaktZahl
                label="Azimut"
                einheit="°"
                value={f.azimutDeg}
                min={0}
                max={359}
                step={1}
                breite="w-20"
                onChange={(azimutDeg) => setFlaeche(f.id, { azimutDeg })}
              />
            )}
            {artVon(f) === 'dach' && (
              <KompaktZahl
                label="Neigung"
                einheit="°"
                value={f.neigungDeg}
                min={0}
                max={75}
                step={1}
                breite="w-20"
                onChange={(neigungDeg) => setFlaeche(f.id, { neigungDeg })}
              />
            )}
            {eingebettet && onFertig && (
              <button
                type="button"
                className="ml-auto h-10 rounded-lg bg-akzent px-5 text-sm font-semibold text-white hover:bg-akzent/90"
                onClick={() => onFertig(f.id)}
              >
                Dachfläche übernehmen
              </button>
            )}
          </div>

          {artVon(f) !== 'flachdach' && (f.dachform === 'trapez' || f.dachform === 'schief') && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <KompaktZahl
                label="Firstbreite oben"
                einheit="m"
                value={f.firstBreiteM ?? f.breiteM}
                min={0}
                max={f.breiteM}
                onChange={(firstBreiteM) => setFlaeche(f.id, { firstBreiteM })}
              />
              {f.dachform === 'schief' && (
                <KompaktZahl
                  label="Firstversatz (+ rechts / − links)"
                  einheit="m"
                  value={f.firstVersatzM ?? 0}
                  onChange={(firstVersatzM) => setFlaeche(f.id, { firstVersatzM })}
                />
              )}
            </div>
          )}

          {artVon(f) === 'flachdach' && f.flachdach && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Aufständerung</span>
                <select
                  aria-label="Aufständerung"
                  value={`${f.flachdach.aufstaenderung}-${f.flachdach.winkelDeg}`}
                  onChange={(e) => {
                    const [aufstaenderung, winkel] = e.target.value.split('-') as ['ostwest' | 'sued', string];
                    setFlaeche(f.id, {
                      flachdach: { aufstaenderung, winkelDeg: Number(winkel), richtungSued: flachdachSuedRichtung(f) },
                      randM: undefined,
                    });
                  }}
                  className={`${kompaktInput} w-40 font-medium`}
                >
                  <option value="ostwest-10">Ost-West 10°</option>
                  <option value="sued-10">Süd 10°</option>
                  <option value="sued-15">Süd 15°</option>
                </select>
              </label>
              <KompaktZahl
                label={f.flachdach.aufstaenderung === 'ostwest' ? 'Paar-Pitch' : 'Reihen-Pitch'}
                einheit="m"
                value={f.flachdach.pitchM ?? flachdachPitchDefault(f.flachdach.aufstaenderung, f.flachdach.winkelDeg)}
                min={1}
                step={0.01}
                onChange={(pitchM) => setFlaeche(f.id, { flachdach: { ...f.flachdach!, pitchM } })}
              />
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Süden im Foto</span>
                <select
                  aria-label="Südrichtung im Foto"
                  value={flachdachSuedRichtung(f)}
                  onChange={(e) => setFlaeche(f.id, {
                    flachdach: { ...f.flachdach!, richtungSued: e.target.value as FlachdachSuedRichtung },
                    felder: f.felder?.map((feld) => ({ ...feld, leer: undefined })),
                  })}
                  className={`${kompaktInput} w-32 font-medium`}
                >
                  <option value="unten">↓ unten</option>
                  <option value="links">← links</option>
                  <option value="oben">↑ oben</option>
                  <option value="rechts">→ rechts</option>
                </select>
              </label>
              <span className="pb-2 text-sm font-semibold text-slate-700">{flachdachRichtungsLabel(f)}</span>
              <span className="pb-2 text-xs text-slate-500">Rand-Default {Math.round(randDefaultVon(f) * 100)} cm</span>
            </div>
          )}

          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">Technische Details</summary>
            <label className="mt-3 block max-w-xs">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {artVon(f) === 'fassade' ? 'Fassaden-Oberfläche' : artVon(f) === 'flachdach' ? 'Dachbelag' : 'Dacheindeckung'}
              </span>
              <select
                aria-label="Dacheindeckung"
                value={f.dachfarbe}
                onChange={(e) => setFlaeche(f.id, { dachfarbe: e.target.value as DachfarbeId })}
                className={`${kompaktInput} w-full`}
              >
                {farbenFuer(artVon(f)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Die Oberfläche wird nur für technische Projektdaten gespeichert; die Belegung erscheint ausschließlich auf dem Drohnenfoto.
            </p>
          </details>

          {artVon(f) === 'dach' &&
            (f.neigungDeg < 0 || f.neigungDeg > 75 || !Number.isFinite(f.neigungDeg)) && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                Neigung muss zwischen 0° und 75° liegen.
              </p>
            )}
        </Karte>
      ))}

      {!nurFlaecheId && (
        <button
          type="button"
          className="h-12 w-full rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-akzent hover:text-akzent"
          onClick={() => {
            const nr = naechsteNr();
            onChange({
              ...projekt,
              flaechen: [...projekt.flaechen, neueFlaeche(nr, naechsteZone(projekt.flaechen))],
            });
          }}
        >
          + Haupt-Dachfläche
        </button>
      )}

      {!nurFlaecheId && (
        <p className="text-xs text-slate-400">
          Maße bitte als Aufmaß-Werte eingeben. Anschließend jeder Dachfläche mindestens ein Drohnenfoto zuordnen und kalibrieren; Gauben werden direkt im Foto ihres Hauptdachs angelegt.
        </p>
      )}
    </div>
  );
}
