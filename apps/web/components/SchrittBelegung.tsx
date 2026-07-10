'use client';

import { useState } from 'react';
import {
  aktiveModule,
  besterVersatzFuer,
  extraModulGueltig,
  fmtDe,
  modulById,
  modulMasse,
  randVon,
  rasterFuer,
  umrissVon,
  zonenVon,
  type Flaeche,
  type Projekt,
  type PunktM,
} from '../lib/model';
import { DACHFARBEN } from '../lib/model';
import { DachSvg } from './DachSvg';
import { FotoHintergrund } from './FotoHintergrund';
import { Karte, KartenTitel, ToggleButton, ZonenBadge } from './ui';

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
  // Maße einblenden — beim Kunden vor Ort abschaltbar (Genrih 07.07.)
  const [masseZeigen, setMasseZeigen] = useState(true);
  // „Reihe umschalten"-Modus: Klick auf ein Modul dreht dessen ganze Reihe (Band)
  const [reihenModusId, setReihenModusId] = useState<string | null>(null);
  // „Verschieben"-Modus (Nudge) + frei einstellbare Schrittweite in cm
  const [verschiebeModusId, setVerschiebeModusId] = useState<string | null>(null);
  const [schrittCm, setSchrittCm] = useState(1);
  // „Modul setzen"-Modus: leeres Feld antippen → Zusatzmodul; Extra antippen → auswählen
  const [modulModusId, setModulModusId] = useState<string | null>(null);
  // Index des gerade ausgewählten Zusatzmoduls (zum Verschieben/Löschen), null = keins
  const [gewaehltExtra, setGewaehltExtra] = useState<number | null>(null);
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

  /**
   * Ausrichtung eines ganzen Bandes (Reihe `row`) umschalten → gemischte Belegung
   * (Genrih 07.07.). baender wird auf die aktuelle Reihenzahl aufgefüllt (Rest =
   * Basis), die Reihe gedreht; sind danach alle gleich der Basis, zurück auf
   * einheitlich (baender = undefined). Deaktivierte Module werden verworfen
   * (Spaltenzahl der Reihe ändert sich), wie beim Wechsel Quer/Hochkant.
   */
  const flipBand = (f: Flaeche, row: number) => {
    const rows = rasterFuer(f, modul).rows;
    const base = f.ausrichtung;
    const len = Math.max(rows, f.baender?.length ?? 0, row + 1);
    const arr: ('hoch' | 'quer')[] = Array.from({ length: len }, (_, i) => f.baender?.[i] ?? base);
    arr[row] = arr[row] === 'quer' ? 'hoch' : 'quer';
    const alleBasis = arr.every((b) => b === base);
    // Gemischte Reihen und Versatz vertragen sich (noch) nicht → Versatz verwerfen.
    patchFlaeche(f.id, {
      baender: alleBasis ? undefined : arr,
      versatzXM: undefined,
      versatzYM: undefined,
      inaktiv: [],
    });
  };

  const round2 = (v: number) => Math.round(v * 100) / 100;

  /** Ganze Belegung um `schrittCm` in eine Richtung schieben (sx/sy ∈ {-1,0,1}). */
  const nudge = (f: Flaeche, sx: number, sy: number) => {
    const step = Math.max(0.01, schrittCm / 100);
    const klemm = (v: number, grenze: number) => Math.max(-grenze, Math.min(grenze, v));
    patchFlaeche(f.id, {
      versatzXM: round2(klemm((f.versatzXM ?? 0) + sx * step, f.breiteM)),
      versatzYM: round2(klemm((f.versatzYM ?? 0) + sy * step, f.hoeheM)),
      inaktiv: [],
    });
  };

  const bestePosition = (f: Flaeche) =>
    patchFlaeche(f.id, { ...besterVersatzFuer(f, modul), inaktiv: [] });

  /** Zurück auf automatische Lage (Versatz entfernen). */
  const versatzZuruecksetzen = (f: Flaeche) =>
    patchFlaeche(f.id, { versatzXM: undefined, versatzYM: undefined, inaktiv: [] });

  /** Zusatzmodul mittig auf den Klick, y auf die nächste Rasterreihe fangen, in die Zone klemmen. */
  const snapExtra = (f: Flaeche, p: PunktM, quer: boolean) => {
    const { w, h } = modulMasse(modul, quer);
    const rand = randVon(f);
    const reihenY = [
      ...new Set(rasterFuer(f, modul).positionen.filter((q) => q.row >= 0).map((q) => q.yM)),
    ];
    let yM = p[1] - h / 2;
    if (reihenY.length) {
      yM = reihenY.reduce((a, b) => (Math.abs(b - yM) < Math.abs(a - yM) ? b : a), reihenY[0]!);
    }
    return {
      xM: Math.max(rand, Math.min(f.breiteM - rand - w, p[0] - w / 2)),
      yM: Math.max(rand, Math.min(f.hoeheM - rand - h, yM)),
    };
  };

  /**
   * „Modul setzen": Klick auf ein Zusatzmodul wählt es aus. Klick auf eine freie Stelle
   * verschiebt das gewählte Modul dorthin — oder setzt ein neues (wenn keins gewählt).
   * Nur wenn es passt (Rand/Umriss/Hindernis/keine Überlappung).
   */
  const modulKlick = (f: Flaeche, p: PunktM) => {
    const extras = f.extraModule ?? [];
    const treffer = extras.findIndex((e) => {
      const m = modulMasse(modul, e.quer);
      return p[0] >= e.xM && p[0] <= e.xM + m.w && p[1] >= e.yM && p[1] <= e.yM + m.h;
    });
    if (treffer >= 0) {
      setGewaehltExtra(gewaehltExtra === treffer ? null : treffer); // an-/abwählen
      return;
    }
    if (gewaehltExtra != null && extras[gewaehltExtra]) {
      // Gewähltes Modul auf die freie Stelle verschieben
      const e = extras[gewaehltExtra]!;
      const { xM, yM } = snapExtra(f, p, e.quer);
      if (extraModulGueltig(f, modul, xM, yM, e.quer, gewaehltExtra))
        patchFlaeche(f.id, {
          extraModule: extras.map((x, i) => (i === gewaehltExtra ? { ...x, xM, yM } : x)),
        });
      return;
    }
    // Neues Modul setzen und gleich auswählen
    const quer = f.ausrichtung === 'quer';
    const { xM, yM } = snapExtra(f, p, quer);
    if (!extraModulGueltig(f, modul, xM, yM, quer)) return;
    patchFlaeche(f.id, { extraModule: [...extras, { xM, yM, quer }] });
    setGewaehltExtra(extras.length);
  };

  /** Gewähltes Zusatzmodul um schrittCm in eine Richtung schieben (validiert). */
  const verschiebeExtra = (f: Flaeche, sx: number, sy: number) => {
    if (gewaehltExtra == null) return;
    const e = f.extraModule?.[gewaehltExtra];
    if (!e) return;
    const step = Math.max(0.01, schrittCm / 100);
    const xM = round2(e.xM + sx * step);
    const yM = round2(e.yM + sy * step);
    if (!extraModulGueltig(f, modul, xM, yM, e.quer, gewaehltExtra)) return;
    patchFlaeche(f.id, {
      extraModule: f.extraModule!.map((x, i) => (i === gewaehltExtra ? { ...x, xM, yM } : x)),
    });
  };

  const loescheExtra = (f: Flaeche) => {
    if (gewaehltExtra == null) return;
    patchFlaeche(f.id, { extraModule: (f.extraModule ?? []).filter((_, i) => i !== gewaehltExtra) });
    setGewaehltExtra(null);
  };

  const pfeilKlasse =
    'h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:border-akzent';
  const aktionKlasse =
    'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

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
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <span className="text-4xl font-bold text-slate-900">{fmtDe(kwp, 2)}</span>
            <span className="ml-1 text-lg font-semibold text-slate-500">kWp</span>
          </div>
          <div className="text-sm text-slate-500">
            {gesamt} Module · {modul.name}
          </div>
          <div className="ml-auto">
            <ToggleButton aktiv={masseZeigen} onClick={() => setMasseZeigen((v) => !v)}>
              {masseZeigen ? '📏 Maße an' : '📏 Maße aus'}
            </ToggleButton>
          </div>
        </div>
      </Karte>

      {projekt.flaechen.map((f, i) => {
        const raster = rasterFuer(f, modul);
        const aktiv = aktiveModule(f, raster);
        const zeichneHier = zeichnung?.flaecheId === f.id ? zeichnung : null;
        // Umriss/Hindernis-Zeichnen in SchrittBelegung nur für die Draufsicht
        // (ohne Foto). Bei Foto passiert das in FotoHintergrund auf dem leeren Dach.
        const zeichenbar = !f.foto;
        // Belegung erst zeigen, wenn keine Foto-Markierung mehr läuft (Hindernisse
        // werden VORHER auf dem leeren Foto gesetzt, Genrih 07.07.).
        const belegungZeigen = !f.foto || !!f.markierungFertig || !!f.foto.traufePx;
        return (
          <Karte key={f.id}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <ZonenBadge label={zonenVon(f, i)} />
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
                      x.id === f.id ? { ...x, ausrichtung: 'quer', baender: undefined, inaktiv: [] } : x,
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
                      x.id === f.id ? { ...x, ausrichtung: 'hoch', baender: undefined, inaktiv: [] } : x,
                    ),
                  })
                }
              >
                ▯ Hochkant
              </ToggleButton>
              {belegungZeigen && (
                <ToggleButton
                  aktiv={verschiebeModusId === f.id}
                  disabled={!!f.baender}
                  title={f.baender ? 'Erst „Alle Reihen gleich" — Verschieben geht nur bei einheitlichen Reihen' : undefined}
                  onClick={() => {
                    if (f.baender) return;
                    const an = verschiebeModusId !== f.id;
                    setVerschiebeModusId(an ? f.id : null);
                    if (an) {
                      setReihenModusId(null);
                      setModulModusId(null);
                      setGewaehltExtra(null);
                    }
                    // Beim Aktivieren Versatz aktivieren (Lattice ab aktueller Lage)
                    if (an && f.versatzXM === undefined)
                      patchFlaeche(f.id, { versatzXM: 0, versatzYM: 0 });
                  }}
                >
                  ↔ Verschieben
                </ToggleButton>
              )}
              {belegungZeigen && (
                <ToggleButton
                  aktiv={modulModusId === f.id}
                  onClick={() => {
                    const an = modulModusId !== f.id;
                    setModulModusId(an ? f.id : null);
                    setGewaehltExtra(null);
                    if (an) {
                      setReihenModusId(null);
                      setVerschiebeModusId(null);
                    }
                  }}
                >
                  ➕ Modul setzen
                </ToggleButton>
              )}
              {belegungZeigen && (
                <ToggleButton
                  aktiv={reihenModusId === f.id}
                  disabled={f.versatzXM !== undefined}
                  title={f.versatzXM !== undefined ? 'Erst Versatz zurücksetzen (↔ Verschieben → „↺ Zurücksetzen")' : undefined}
                  onClick={() => {
                    if (f.versatzXM !== undefined) return;
                    const an = reihenModusId !== f.id;
                    setReihenModusId(an ? f.id : null);
                    if (an) {
                      setModulModusId(null);
                      setGewaehltExtra(null);
                    }
                  }}
                >
                  ⟳ Reihe drehen
                </ToggleButton>
              )}
              {f.baender && (
                <button
                  type="button"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:border-slate-400"
                  onClick={() => patchFlaeche(f.id, { baender: undefined, inaktiv: [] })}
                >
                  Alle Reihen gleich
                </button>
              )}
              {belegungZeigen && raster.positionen.length > 0 && aktiv > 0 && (
                <button
                  type="button"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-red-600 hover:border-red-300"
                  title="Alle Module dieser Fläche entfernen (Zusatzmodule werden gelöscht)"
                  onClick={() =>
                    patchFlaeche(f.id, {
                      inaktiv: raster.positionen.map((p) => `${p.row}-${p.col}`),
                      extraModule: undefined,
                    })
                  }
                >
                  🗑 Leeren
                </button>
              )}
              {belegungZeigen && f.inaktiv.length > 0 && (
                <button
                  type="button"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:border-slate-400"
                  onClick={() => patchFlaeche(f.id, { inaktiv: [] })}
                >
                  ↺ Alle zeigen
                </button>
              )}

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

            {verschiebeModusId === f.id && (
              <div className="mb-3 rounded-lg bg-sky-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="grid grid-cols-3 gap-1">
                    <span />
                    <button type="button" className={pfeilKlasse} onClick={() => nudge(f, 0, -1)} title="nach oben">↑</button>
                    <span />
                    <button type="button" className={pfeilKlasse} onClick={() => nudge(f, -1, 0)} title="nach links">←</button>
                    <span className="flex h-9 w-9 items-center justify-center text-slate-400">✥</span>
                    <button type="button" className={pfeilKlasse} onClick={() => nudge(f, 1, 0)} title="nach rechts">→</button>
                    <span />
                    <button type="button" className={pfeilKlasse} onClick={() => nudge(f, 0, 1)} title="nach unten">↓</button>
                    <span />
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    Schritt
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={50}
                      value={schrittCm}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n >= 1) setSchrittCm(n);
                      }}
                      className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                    />
                    cm
                  </label>
                  <button type="button" className={aktionKlasse} onClick={() => bestePosition(f)}>
                    ⌖ Beste Position
                  </button>
                  <button type="button" className={aktionKlasse} onClick={() => versatzZuruecksetzen(f)}>
                    ↺ Zurücksetzen
                  </button>
                  <span className="text-sm text-slate-500">
                    Versatz X {fmtDe((f.versatzXM ?? 0) * 100, 0)} cm, Y{' '}
                    {fmtDe((f.versatzYM ?? 0) * 100, 0)} cm
                  </span>
                </div>
                <p className="mt-1 text-xs text-sky-800">
                  Ganze Anlage cm-weise schieben — Module, die ein Hindernis oder den Rand treffen,
                  entfallen; frei werdende kommen dazu. „⌖ Beste Position" sucht die Lage mit den
                  meisten Modulen. Modulzahl siehe oben rechts.
                </p>
              </div>
            )}

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

            {!belegungZeigen ? null : raster.positionen.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Fläche zu klein für dieses Modul (inkl. {Math.round(randVon(f) * 100)} cm
                Randabstand){umrissVon(f) ? ' — oder die Dachform lässt kein Modul komplett zu' : ''}.
              </p>
            ) : (
              <DachSvg
                flaeche={f}
                raster={raster}
                modul={modul}
                masse={masseZeigen}
                hervorhebenKey={
                  modulModusId === f.id && gewaehltExtra != null ? `-1-${gewaehltExtra}` : undefined
                }
                zeichnen={
                  modulModusId === f.id
                    ? { aktiv: true, punkteM: [], onKlickM: (p) => modulKlick(f, p) }
                    : zeichneHier
                      ? {
                          aktiv: true,
                          punkteM: zeichneHier.punkte,
                          onKlickM: (p) => klickM(f, p),
                        }
                      : undefined
                }
                onToggle={(key) => {
                  const istExtra = key.startsWith('-1-'); // Zusatzmodul (row = -1)
                  if (reihenModusId === f.id) {
                    if (istExtra) return; // Zusatzmodul hat keine Reihe zum Drehen
                    flipBand(f, Number(key.split('-')[0]));
                    return;
                  }
                  if (istExtra) {
                    // Zusatzmodul antippen → löschen (Extras sind manuell gesetzt)
                    const idx = Number(key.slice(3));
                    patchFlaeche(f.id, {
                      extraModule: (f.extraModule ?? []).filter((_, i) => i !== idx),
                    });
                    return;
                  }
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
                  });
                }}
              />
            )}
            {belegungZeigen && reihenModusId === f.id && (
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <strong>Reihe drehen:</strong> ein Modul in der gewünschten Reihe antippen — die
                ganze Reihe wechselt zwischen quer und hochkant. Dabei ändern sich Platz und
                Modulzahl (wird neu gerechnet). „Alle Reihen gleich" setzt zurück.
              </p>
            )}
            {belegungZeigen && modulModusId === f.id && (
              <div className="mt-2 space-y-2">
                {gewaehltExtra != null && f.extraModule?.[gewaehltExtra] && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-akzent/10 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">Gewähltes Modul:</span>
                    <div className="grid grid-cols-3 gap-1">
                      <span />
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeExtra(f, 0, -1)} title="nach oben">↑</button>
                      <span />
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeExtra(f, -1, 0)} title="nach links">←</button>
                      <span className="flex h-9 w-9 items-center justify-center text-slate-400">✥</span>
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeExtra(f, 1, 0)} title="nach rechts">→</button>
                      <span />
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeExtra(f, 0, 1)} title="nach unten">↓</button>
                      <span />
                    </div>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
                      Schritt
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={50}
                        value={schrittCm}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          if (Number.isFinite(n) && n >= 1) setSchrittCm(n);
                        }}
                        className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                      />
                      cm
                    </label>
                    <button type="button" className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300" onClick={() => loescheExtra(f)}>
                      🗑 Löschen
                    </button>
                    <button type="button" className={aktionKlasse} onClick={() => setGewaehltExtra(null)}>
                      ✕ Auswahl aufheben
                    </button>
                  </div>
                )}
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  <strong>Modul setzen/verschieben:</strong> auf eine freie Stelle tippen → dort kommt
                  ein Modul hin (mittig, fluchtet mit der nächsten Reihe). Ein gesetztes Modul antippen
                  → <strong>auswählen</strong> (orange umrandet): dann per Pfeilen fein schieben, auf eine
                  freie Stelle tippen zum Versetzen, oder löschen. Passt es nicht
                  (Rand/Umriss/Hindernis/Überlappung), passiert nichts. Ideal fürs einzelne Modul am Walm.
                </p>
              </div>
            )}
            {belegungZeigen && reihenModusId !== f.id && modulModusId !== f.id && (
              <p className="mt-2 text-xs text-slate-400">
                Module antippen zum Deaktivieren.{' '}
                {f.foto
                  ? 'Kamin/Fenster/SAT vorher über „✎ Markierung ändern" aufs leere Foto setzen.'
                  : 'Für Kamin/Fenster/SAT „Hindernis markieren" (rechnet automatisch).'}{' '}
                Randabstand {Math.round(randVon(f) * 100)} cm, Klemmfuge 20 mm
                {f.umrissM ? `, Umriss mit ${f.umrissM.length} Ecken` : ''}.
              </p>
            )}
          </Karte>
        );
      })}
    </div>
  );
}
