'use client';

import {
  AZIMUT_PRESETS,
  artVon,
  farbenFuer,
  flachdachPitchDefault,
  naechsteZone,
  neueFlaeche,
  randDefaultVon,
  zonenVon,
  type Flaeche,
  type FlaechenArt,
  type Projekt,
} from '../lib/model';
import { IconFormRechteck, IconFormSchief, IconFormTrapez } from './icons';
import { Feld, inputKlasse, Karte, KartenTitel, ToggleButton, ZonenBadge } from './ui';

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

  /**
   * Flächen-Art wechseln (16.07.2026): setzt die zur Art passenden Defaults —
   * Neigung (Fassade fest 90°, Flachdach 0°), Oberfläche, Randabstand (Flachdach
   * per Windlast-Empfehlung größer) und die PROFINESS-Aufständerung. Die Felder
   * (Belegung) bleiben erhalten — der Nutzer sieht sofort das neue Raster.
   */
  const setArt = (f: Flaeche, art: FlaechenArt) => {
    if (artVon(f) === art) return;
    const patch: Partial<Flaeche> = { art, randM: undefined, dachform: 'rechteck' };
    if (art === 'flachdach') {
      patch.neigungDeg = 0;
      patch.flachdach = f.flachdach ?? { aufstaenderung: 'ostwest', winkelDeg: 10 };
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

  return (
    <div className="space-y-4">
      {projekt.flaechen.map((f, i) => (
        <Karte key={f.id}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ZonenBadge label={zonenVon(f, i)} />
              <KartenTitel>{f.name}</KartenTitel>
            </div>
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

          <div className="mb-4">
            <span className="mb-1 block text-sm font-medium text-slate-600">Art der Fläche</span>
            <div className="flex flex-wrap gap-2">
              <ToggleButton aktiv={artVon(f) === 'dach'} onClick={() => setArt(f, 'dach')}>
                Schrägdach
              </ToggleButton>
              <ToggleButton aktiv={artVon(f) === 'flachdach'} onClick={() => setArt(f, 'flachdach')}>
                Flachdach (aufgeständert)
              </ToggleButton>
              <ToggleButton aktiv={artVon(f) === 'fassade'} onClick={() => setArt(f, 'fassade')}>
                Fassade
              </ToggleButton>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ZahlenFeld
              label={
                artVon(f) === 'flachdach'
                  ? 'Breite (Ost↔West)'
                  : artVon(f) === 'fassade'
                    ? 'Breite der Fassade'
                    : 'Breite Traufe'
              }
              einheit="m"
              value={f.breiteM}
              min={1}
              onChange={(v) => setFlaeche(f.id, { breiteM: v })}
            />
            <ZahlenFeld
              label={
                artVon(f) === 'flachdach'
                  ? 'Tiefe (Nord↔Süd)'
                  : artVon(f) === 'fassade'
                    ? 'Höhe der Fassade'
                    : 'Sparrenlänge, wahres Maß'
              }
              einheit="m"
              value={f.hoeheM}
              min={1}
              onChange={(v) => setFlaeche(f.id, { hoeheM: v })}
            />
            {artVon(f) === 'dach' && (
              <ZahlenFeld
                label="Dachneigung"
                einheit="°"
                value={f.neigungDeg}
                min={0}
                max={75}
                step={1}
                onChange={(v) => setFlaeche(f.id, { neigungDeg: v })}
              />
            )}
          </div>

          {artVon(f) === 'flachdach' && f.flachdach && (
            <div className="mt-4">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                Aufständerung (PROFINESS Flat)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { a: 'ostwest', w: 10, label: 'Ost-West 10°' },
                    { a: 'sued', w: 10, label: 'Süd 10°' },
                    { a: 'sued', w: 15, label: 'Süd 15°' },
                  ] as const
                ).map((o) => (
                  <ToggleButton
                    key={o.label}
                    aktiv={f.flachdach!.aufstaenderung === o.a && f.flachdach!.winkelDeg === o.w}
                    onClick={() =>
                      setFlaeche(f.id, {
                        flachdach: { aufstaenderung: o.a, winkelDeg: o.w },
                        randM: undefined, // neuer Windlast-Default greift
                      })
                    }
                  >
                    {o.label}
                  </ToggleButton>
                ))}
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  {f.flachdach.aufstaenderung === 'ostwest' ? 'Paar-Pitch' : 'Reihen-Pitch'}
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.01}
                    min={1}
                    value={
                      f.flachdach.pitchM ??
                      flachdachPitchDefault(f.flachdach.aufstaenderung, f.flachdach.winkelDeg)
                    }
                    onChange={(e) => {
                      const v = Number.parseFloat(e.target.value);
                      if (Number.isFinite(v) && v > 0)
                        setFlaeche(f.id, { flachdach: { ...f.flachdach!, pitchM: v } });
                    }}
                    className="h-10 w-24 rounded-lg border border-slate-300 px-2 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
                  />
                  m
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Systemmaße PROFINESS Flat (Montageanleitung 05/2025): Ost-West Paar-Pitch 2,48 m;
                Süd Reihen-Pitch 1,80 m (10°) / 1,90 m (15°) — bei anderem Gestell den Pitch
                anpassen. Module liegen immer quer. Randabstand-Empfehlung {' '}
                {Math.round(randDefaultVon(f) * 100)} cm (Windlast), in der Belegung änderbar.
                <strong> Konvention: die Unterkante der Fläche zeigt nach Süden</strong> — beim
                Foto-Markieren so ausrichten.
              </p>
            </div>
          )}

          {artVon(f) !== 'flachdach' && (
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              {artVon(f) === 'fassade' ? 'Form der Fassade' : 'Dachform'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleButton
                aktiv={(f.dachform ?? 'rechteck') === 'rechteck'}
                onClick={() =>
                  setFlaeche(f.id, {
                    dachform: 'rechteck',
                    firstBreiteM: undefined,
                    firstVersatzM: undefined,
                    umrissM: undefined,
                  })
                }
              >
                <IconFormRechteck />
                Rechteck
              </ToggleButton>
              <ToggleButton
                aktiv={f.dachform === 'trapez'}
                onClick={() =>
                  setFlaeche(f.id, {
                    dachform: 'trapez',
                    firstBreiteM: f.firstBreiteM ?? Math.round(f.breiteM * 0.6 * 10) / 10,
                    firstVersatzM: undefined,
                    umrissM: undefined,
                  })
                }
              >
                <IconFormTrapez />
                Trapez / Walm
              </ToggleButton>
              <ToggleButton
                aktiv={f.dachform === 'schief'}
                onClick={() =>
                  setFlaeche(f.id, {
                    dachform: 'schief',
                    firstBreiteM: f.firstBreiteM ?? f.breiteM,
                    firstVersatzM: f.firstVersatzM ?? 1,
                    umrissM: undefined,
                  })
                }
              >
                <IconFormSchief />
                Schief / Parallelogramm
              </ToggleButton>
              {(f.dachform === 'trapez' || f.dachform === 'schief') && (
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  Firstbreite oben
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={f.breiteM}
                    step={0.1}
                    value={Number.isFinite(f.firstBreiteM as number) ? (f.firstBreiteM as number) : ''}
                    onChange={(e) =>
                      setFlaeche(f.id, { firstBreiteM: Number.parseFloat(e.target.value) })
                    }
                    className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
                  />
                  m
                </label>
              )}
              {f.dachform === 'schief' && (
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  First versetzt um
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    value={Number.isFinite(f.firstVersatzM as number) ? (f.firstVersatzM as number) : ''}
                    onChange={(e) =>
                      setFlaeche(f.id, { firstVersatzM: Number.parseFloat(e.target.value) })
                    }
                    className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
                  />
                  m (+ rechts / − links)
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {f.dachform === 'trapez'
                ? 'Traufe unten = Breite, First oben schmaler (0 m = Walmspitze). Für komplexere Formen später „Umriss zeichnen" in der Belegung.'
                : f.dachform === 'schief'
                  ? 'Für Parallelogramm-/Schrägdächer: Traufe unten, First oben seitlich versetzt. Firstbreite = Traufe ergibt ein echtes Parallelogramm.'
                  : artVon(f) === 'fassade'
                    ? 'Rechteck ist Standard; Trapez für Giebelwände. Fenster/Türen als Hindernis in der Belegung markieren.'
                    : 'Rechteck ist Standard. Trapez/Walm bzw. Schief füllt die Fläche gleich richtig — auch ohne Foto.'}
            </p>
          </div>
          )}

          {artVon(f) !== 'flachdach' && (
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              {artVon(f) === 'fassade' ? 'Blickrichtung der Fassade (Azimut)' : 'Ausrichtung (Azimut)'}
            </span>
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
          )}

          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              {artVon(f) === 'fassade'
                ? 'Fassaden-Oberfläche'
                : artVon(f) === 'flachdach'
                  ? 'Dachbelag'
                  : 'Dacheindeckung'}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {farbenFuer(artVon(f)).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setFlaeche(f.id, { dachfarbe: d.id })}
                  className={`flex h-14 items-center gap-2 rounded-xl border-2 bg-white px-3 text-left transition ${
                    f.dachfarbe === d.id
                      ? 'border-akzent ring-2 ring-akzent/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className="inline-block h-8 w-8 shrink-0 rounded-lg"
                    style={{ backgroundColor: d.fill }}
                  />
                  <span className="text-xs font-medium leading-tight text-slate-700">{d.name}</span>
                </button>
              ))}
            </div>
          </div>

          {artVon(f) === 'dach' &&
            (f.neigungDeg < 0 || f.neigungDeg > 75 || !Number.isFinite(f.neigungDeg)) && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                Neigung muss zwischen 0° und 75° liegen (Pflichtfeld — sonst ist die Belegung
                gesperrt).
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
          onChange({ ...projekt, flaechen: [...projekt.flaechen, neueFlaeche(nr, naechsteZone(projekt.flaechen))] });
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
