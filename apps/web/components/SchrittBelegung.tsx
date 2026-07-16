'use client';

import { useEffect, useState } from 'react';
import {
  aktiveModule,
  besterVersatzFuer,
  extraModulGueltig,
  fmtDe,
  modulById,
  modulMasse,
  rahmenBreiteVon,
  randVon,
  rasterFuer,
  umrissVon,
  zonenVon,
  type Flaeche,
  type Projekt,
  type PunktM,
  type RechteckM,
} from '../lib/model';
import { DACHFARBEN } from '../lib/model';
import { DachSvg, type GeistModul } from './DachSvg';
import { FotoHintergrund } from './FotoHintergrund';
import {
  IconAlleZeigen,
  IconAntippen,
  IconEinzelnVerschieben,
  IconHindernis,
  IconLeeren,
  IconMasse,
  IconModulHoch,
  IconModulLoeschen,
  IconModulQuer,
  IconModulSetzen,
  IconReiheDrehen,
  IconReihenVersetzen,
  IconUmriss,
  IconVerschieben,
} from './icons';
import { Karte, KartenTitel, ToggleButton, ZonenBadge } from './ui';

/** Laufende Zeichnung (Umriss oder Hindernis) — immer nur eine Fläche gleichzeitig */
interface Zeichnung {
  flaecheId: string;
  art: 'umriss' | 'hindernis';
  punkte: PunktM[];
}

/**
 * Exklusive Werkzeuge der Belegung (null = Antippen). 13.07.2026 dazu:
 * 'loeschen' (Module endgültig raus, Felder bleiben leer) und 'einzeln'
 * (EIN Rastermodul für sich verschieben, Rest bleibt stehen — Genrih).
 */
type WerkzeugArt = 'verschieben' | 'setzen' | 'reihe' | 'loeschen' | 'einzeln';

/**
 * Segment-Knopf der Werkzeugleiste (U1, 08.07.): Werkzeuge liegen als Gruppe auf
 * grauem Grund, das aktive als weiße „Pille" — wie in einem Zeichenprogramm. Trennt
 * die exklusiven MODI optisch von Aktionen und Einstellungen.
 */
function WerkzeugKnopf({
  aktiv,
  disabled,
  title,
  onClick,
  children,
}: {
  aktiv: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : aktiv
            ? 'bg-white font-semibold text-akzent shadow'
            : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
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
  // Aktives Werkzeug (exklusiv, je eine Fläche) — null = Antippen überall
  const [modus, setModus] = useState<{ art: WerkzeugArt; flaecheId: string } | null>(null);
  // Schrittweite in cm (Verschieben/Einzeln/Modul setzen)
  const [schrittCm, setSchrittCm] = useState(1);
  // Lösch-Modus: angetippte Module (Keys "row-col"); erst „Endgültig löschen" wirkt
  const [loeschAuswahl, setLoeschAuswahl] = useState<string[]>([]);
  // „Einzeln verschieben": Indizes der gewählten Zusatzmodule — MEHRERE möglich
  // (Genrih 13.07.), die Gruppe bewegt sich gemeinsam
  const [einzelAuswahl, setEinzelAuswahl] = useState<number[]>([]);
  // Index des gerade ausgewählten Zusatzmoduls (zum Verschieben/Löschen), null = keins
  const [gewaehltExtra, setGewaehltExtra] = useState<number | null>(null);
  // Mausposition (Flächen-Meter) für die Geist-Vorschau beim „Modul setzen"
  const [geistM, setGeistM] = useState<PunktM | null>(null);
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

  const modusArt = (f: Flaeche): WerkzeugArt | null =>
    modus?.flaecheId === f.id ? modus.art : null;

  /** Werkzeug wechseln — räumt Auswahl/Geist des vorherigen Modus auf. */
  const setzeModus = (f: Flaeche, art: WerkzeugArt | null) => {
    setModus(art ? { art, flaecheId: f.id } : null);
    setGewaehltExtra(null);
    setGeistM(null);
    setLoeschAuswahl([]);
    setEinzelAuswahl([]);
  };

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

  // Gelöschte Felder brauchen beim Verschieben KEINE Sonderbehandlung mehr: sie
  // sind relativ zum Gitter-Anker gespeichert (geloeschtRel) und kleben damit von
  // selbst am Raster — egal ob Nudge, „Beste Position" oder Optimierer (16.07.2026).

  /** Ganze Belegung um `schrittCm` in eine Richtung schieben (sx/sy ∈ {-1,0,1}). */
  const nudge = (f: Flaeche, sx: number, sy: number) => {
    const step = Math.max(0.01, schrittCm / 100);
    const klemm = (v: number, grenze: number) => Math.max(-grenze, Math.min(grenze, v));
    patchFlaeche(f.id, {
      versatzXM: round2(klemm((f.versatzXM ?? 0) + sx * step, rahmenBreiteVon(f))),
      versatzYM: round2(klemm((f.versatzYM ?? 0) + sy * step, f.hoeheM)),
      inaktiv: [],
    });
  };

  const bestePosition = (f: Flaeche) =>
    patchFlaeche(f.id, { ...besterVersatzFuer(f, modul), inaktiv: [] });

  /** Zurück auf automatische Lage (Versatz entfernen). */
  const versatzZuruecksetzen = (f: Flaeche) =>
    patchFlaeche(f.id, { versatzXM: undefined, versatzYM: undefined, inaktiv: [] });

  /**
   * Zusatzmodul mittig auf den Klick; y wird auf die nächste GITTERreihe gefangen.
   * Die Reihen kommen aus dem Gitter-Anker der Engine — nicht aus den belegten
   * Modulen, sonst fehlt eine komplett gelöschte/leere Reihe in der Fangliste und
   * das Modul hängt daneben, obwohl Platz ist (Genrih 16.07.). `freiY` = ungefangene
   * Alternative für den Fall, dass die gefangene Reihe belegt ist.
   */
  const snapExtra = (f: Flaeche, p: PunktM, quer: boolean) => {
    const { w, h } = modulMasse(modul, quer);
    const rand = randVon(f);
    const raster = rasterFuer(f, modul);
    const klemmY = (v: number) => Math.max(rand, Math.min(f.hoeheM - rand - h, v));
    const freiY = klemmY(p[1] - h / 2);
    const reihenY: number[] = [];
    if (!f.baender) {
      const pitchY = raster.modulHoeheM + raster.fugeM;
      const k0 = Math.ceil((rand - raster.ankerYM) / pitchY - 1e-9);
      for (let k = k0; reihenY.length <= 500; k++) {
        const y = raster.ankerYM + k * pitchY;
        if (y + raster.modulHoeheM > f.hoeheM - rand + 1e-6) break;
        reihenY.push(y);
      }
    } else {
      // Gemischte Bänder: kein einheitliches Gitter → an den belegten Reihen fangen
      reihenY.push(...new Set(raster.positionen.filter((q) => q.row >= 0).map((q) => q.yM)));
    }
    const yM = reihenY.length
      ? klemmY(reihenY.reduce((a, b) => (Math.abs(b - freiY) < Math.abs(a - freiY) ? b : a), reihenY[0]!))
      : freiY;
    return {
      xM: Math.max(rand, Math.min(rahmenBreiteVon(f) - rand - w, p[0] - w / 2)),
      yM,
      freiY,
    };
  };

  /**
   * Ziel fürs Setzen/Versetzen: erst die gefangene Reihe probieren, sonst die freie
   * Klickposition — was zuerst gültig ist. Vorher scheiterte das Setzen komplett,
   * wenn die nächstgelegene Reihe voll war, obwohl daneben Platz gewesen wäre.
   */
  const zielExtra = (
    f: Flaeche,
    p: PunktM,
    quer: boolean,
    ausser?: number,
  ): { xM: number; yM: number; ok: boolean } => {
    const s = snapExtra(f, p, quer);
    if (extraModulGueltig(f, modul, s.xM, s.yM, quer, ausser)) return { xM: s.xM, yM: s.yM, ok: true };
    if (Math.abs(s.freiY - s.yM) > 1e-9 && extraModulGueltig(f, modul, s.xM, s.freiY, quer, ausser))
      return { xM: s.xM, yM: s.freiY, ok: true };
    return { xM: s.xM, yM: s.yM, ok: false };
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
      const z = zielExtra(f, p, e.quer, gewaehltExtra);
      if (z.ok)
        patchFlaeche(f.id, {
          extraModule: extras.map((x, i) => (i === gewaehltExtra ? { ...x, xM: z.xM, yM: z.yM } : x)),
        });
      return;
    }
    // Neues Modul setzen und gleich auswählen
    const quer = f.ausrichtung === 'quer';
    const z = zielExtra(f, p, quer);
    if (!z.ok) return;
    patchFlaeche(f.id, { extraModule: [...extras, { xM: z.xM, yM: z.yM, quer }] });
    setGewaehltExtra(extras.length);
  };

  /**
   * Geist-Vorschau unter dem Cursor: exakt an der SNAP-Position, die auch der
   * Klick nähme (inkl. Reihen-Fang), grün/rot je nach Gültigkeit. Orientierung =
   * die des gewählten Zusatzmoduls, sonst die Basis-Ausrichtung der Fläche.
   */
  const geistFuer = (f: Flaeche): GeistModul | null => {
    if (!geistM) return null;
    const gewaehlt = gewaehltExtra != null ? f.extraModule?.[gewaehltExtra] : undefined;
    const quer = gewaehlt ? gewaehlt.quer : f.ausrichtung === 'quer';
    const z = zielExtra(f, geistM, quer, gewaehltExtra ?? undefined);
    const { w, h } = modulMasse(modul, quer);
    return { xM: z.xM, yM: z.yM, wM: w, hM: h, ok: z.ok };
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

  /**
   * „Einzeln verschieben" (13.07., Genrih): RASTERmodule antippen → sie werden zu
   * frei beweglichen Zusatzmodulen, ihr altes Feld wird als gelöscht vermerkt (bleibt
   * leer, der Rest der Anlage bewegt sich nicht). Mehrfachauswahl: jedes weitere
   * Antippen nimmt dazu, Zusatzmodule antippen wählt an/ab — die Gruppe bewegt sich
   * dann gemeinsam.
   */
  const waehleEinzeln = (f: Flaeche, key: string) => {
    if (key.startsWith('-1-')) {
      const idx = Number(key.slice(3));
      setEinzelAuswahl((a) => (a.includes(idx) ? a.filter((i) => i !== idx) : [...a, idx]));
      return;
    }
    const raster = rasterFuer(f, modul);
    const p = raster.positionen.find((q) => `${q.row}-${q.col}` === key);
    if (!p) return;
    const extras = f.extraModule ?? [];
    // Schutz vor Doppel-Umwandlung (schnelle Klicks vor dem Re-Render): liegt an
    // der Stelle schon ein Zusatzmodul, nur auswählen statt erneut umwandeln.
    const vorhanden = extras.findIndex(
      (x) => Math.abs(x.xM - p.xM) < 1e-6 && Math.abs(x.yM - p.yM) < 1e-6,
    );
    if (vorhanden >= 0) {
      setEinzelAuswahl((a) => (a.includes(vorhanden) ? a : [...a, vorhanden]));
      return;
    }
    patchFlaeche(f.id, {
      geloeschtRel: [
        ...(f.geloeschtRel ?? []),
        { xM: p.xM - raster.ankerXM, yM: p.yM - raster.ankerYM, breiteM: p.wM, hoeheM: p.hM },
      ],
      extraModule: [...extras, { xM: p.xM, yM: p.yM, quer: p.quer }],
      inaktiv: f.inaktiv.filter((k) => k !== key),
    });
    setEinzelAuswahl((a) => [...a, extras.length]);
  };

  /**
   * Die ganze Einzeln-Auswahl um schrittCm bewegen — alles oder nichts: passt EIN
   * Ziel nicht (Rand/Umriss/Hindernis/fremdes Modul), bleibt die Gruppe stehen.
   * Die Auswahl selbst wird bei der Kollisionsprüfung ignoriert (bewegt sich
   * gemeinsam, innere Abstände bleiben gleich).
   */
  const verschiebeAuswahl = (f: Flaeche, sx: number, sy: number) => {
    const extras = f.extraModule ?? [];
    const auswahl = einzelAuswahl.filter((i) => i < extras.length);
    if (auswahl.length === 0) return;
    const step = Math.max(0.01, schrittCm / 100);
    const neu = extras.map((e, i) =>
      auswahl.includes(i)
        ? { ...e, xM: round2(e.xM + sx * step), yM: round2(e.yM + sy * step) }
        : e,
    );
    const ok = auswahl.every((i) => {
      const e = neu[i]!;
      return extraModulGueltig(f, modul, e.xM, e.yM, e.quer, auswahl);
    });
    if (ok) patchFlaeche(f.id, { extraModule: neu });
  };

  /**
   * Lösch-Auswahl endgültig anwenden: Raster-Felder als dauerhaft leer vermerken
   * (geloescht-Fußabdrücke — sie kommen auch durch Verschieben nicht wieder),
   * ausgewählte Zusatzmodule ganz entfernen.
   */
  const loeschBestaetigen = (f: Flaeche) => {
    if (loeschAuswahl.length === 0) return;
    const raster = rasterFuer(f, modul);
    const felder: RechteckM[] = [];
    const extraWeg = new Set<number>();
    for (const key of loeschAuswahl) {
      if (key.startsWith('-1-')) {
        extraWeg.add(Number(key.slice(3)));
        continue;
      }
      const p = raster.positionen.find((q) => `${q.row}-${q.col}` === key);
      // Fußabdruck relativ zum Gitter-Anker → klebt am Raster (16.07.2026)
      if (p)
        felder.push({
          xM: p.xM - raster.ankerXM,
          yM: p.yM - raster.ankerYM,
          breiteM: p.wM,
          hoeheM: p.hM,
        });
    }
    patchFlaeche(f.id, {
      geloeschtRel: [...(f.geloeschtRel ?? []), ...felder],
      extraModule: extraWeg.size
        ? (f.extraModule ?? []).filter((_, i) => !extraWeg.has(i))
        : f.extraModule,
      inaktiv: f.inaktiv.filter((k) => !loeschAuswahl.includes(k)),
    });
    setLoeschAuswahl([]);
  };

  // Pfeiltasten bewegen die Einzeln-Auswahl bzw. das gewählte Setz-Modul.
  // Ohne Dep-Array bewusst bei jedem Render neu registriert — Closures bleiben frisch.
  useEffect(() => {
    const aktivEinzeln = modus?.art === 'einzeln' && einzelAuswahl.length > 0;
    const aktivSetzen = modus?.art === 'setzen' && gewaehltExtra != null;
    if (!modus || (!aktivEinzeln && !aktivSetzen)) return;
    const f = projekt.flaechen.find((x) => x.id === modus.flaecheId);
    if (!f) return;
    const handler = (e: KeyboardEvent) => {
      const richtung: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const v = richtung[e.key];
      if (!v) return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName)) return;
      e.preventDefault();
      if (aktivEinzeln) verschiebeAuswahl(f, v[0], v[1]);
      else verschiebeExtra(f, v[0], v[1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const pfeilKlasse =
    'h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:border-akzent';
  const aktionKlasse =
    'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

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
              <IconMasse />
              {masseZeigen ? 'Maße an' : 'Maße aus'}
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

            {/* Zeile 1 — WERKZEUGE (exklusive Modi, wie in einem Zeichenprogramm) + Aktionen */}
            {belegungZeigen && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === null}
                    title="Standard: Module antippen zum Deaktivieren/Aktivieren"
                    onClick={() => setzeModus(f, null)}
                  >
                    <IconAntippen />
                    Antippen
                  </WerkzeugKnopf>
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === 'verschieben'}
                    disabled={!!f.baender || !!raster.reihenVersetzt}
                    title={
                      f.baender
                        ? 'Erst „Alle Reihen gleich“ — Verschieben geht nur bei einheitlichen Reihen'
                        : raster.reihenVersetzt
                          ? 'Die Reihen sind einzeln versetzt („Reihen frei versetzen"/Schrägdach) — Verschieben braucht fluchtende Spalten'
                          : 'Ganze Belegung cm-weise schieben'
                    }
                    onClick={() => {
                      if (f.baender || raster.reihenVersetzt) return;
                      const an = modusArt(f) !== 'verschieben';
                      setzeModus(f, an ? 'verschieben' : null);
                      // Beim Aktivieren Versatz aktivieren (Gitter ab der Standardlage —
                      // dank gemeinsamem Anker exakt dieselbe Belegung, kein Springen)
                      if (an && f.versatzXM === undefined)
                        patchFlaeche(f.id, { versatzXM: 0, versatzYM: 0 });
                    }}
                  >
                    <IconVerschieben />
                    Verschieben
                  </WerkzeugKnopf>
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === 'einzeln'}
                    title="Ein einzelnes Modul auswählen und mit den Pfeiltasten verschieben — der Rest der Anlage bleibt stehen"
                    onClick={() => setzeModus(f, modusArt(f) === 'einzeln' ? null : 'einzeln')}
                  >
                    <IconEinzelnVerschieben />
                    Einzeln verschieben
                  </WerkzeugKnopf>
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === 'setzen'}
                    title="Einzelnes Zusatzmodul setzen, verschieben oder entfernen"
                    onClick={() => setzeModus(f, modusArt(f) === 'setzen' ? null : 'setzen')}
                  >
                    <IconModulSetzen />
                    Modul setzen
                  </WerkzeugKnopf>
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === 'loeschen'}
                    title="Module auswählen und endgültig löschen — die Felder bleiben dauerhaft leer"
                    onClick={() => setzeModus(f, modusArt(f) === 'loeschen' ? null : 'loeschen')}
                  >
                    <IconModulLoeschen />
                    Modul löschen
                  </WerkzeugKnopf>
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === 'reihe'}
                    disabled={f.versatzXM !== undefined}
                    title={f.versatzXM !== undefined ? 'Erst Versatz zurücksetzen (↔ Verschieben → „↺ Zurücksetzen“)' : 'Ganze Reihe zwischen quer und hochkant umschalten'}
                    onClick={() => {
                      if (f.versatzXM !== undefined) return;
                      setzeModus(f, modusArt(f) === 'reihe' ? null : 'reihe');
                    }}
                  >
                    <IconReiheDrehen />
                    Reihe drehen
                  </WerkzeugKnopf>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  {f.baender && (
                    <button type="button" className={aktionKlasse} onClick={() => patchFlaeche(f.id, { baender: undefined, inaktiv: [] })}>
                      Alle Reihen gleich
                    </button>
                  )}
                  {raster.positionen.length > 0 && aktiv > 0 && (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                      title="Alle Module dieser Fläche entfernen (Zusatzmodule werden gelöscht)"
                      onClick={() =>
                        patchFlaeche(f.id, {
                          inaktiv: raster.positionen.map((p) => `${p.row}-${p.col}`),
                          extraModule: undefined,
                        })
                      }
                    >
                      <IconLeeren />
                      Leeren
                    </button>
                  )}
                  {f.inaktiv.length > 0 && (
                    <button type="button" className={aktionKlasse} onClick={() => patchFlaeche(f.id, { inaktiv: [] })}>
                      <IconAlleZeigen />
                      Alle zeigen
                    </button>
                  )}
                  {(f.geloeschtRel?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      className={aktionKlasse}
                      title="Alle endgültig gelöschten Modul-Felder wieder freigeben"
                      onClick={() => patchFlaeche(f.id, { geloeschtRel: undefined })}
                    >
                      <IconAlleZeigen />
                      Gelöschte zurückholen ({f.geloeschtRel!.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Zeile 2 — EINSTELLUNGEN: Ausrichtung, Randabstand, Dachfarbe */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <WerkzeugKnopf
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
                  <IconModulQuer />
                  Quer
                </WerkzeugKnopf>
                <WerkzeugKnopf
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
                  <IconModulHoch />
                  Hochkant
                </WerkzeugKnopf>
              </div>

              {(() => {
                // Der Reihen-Optimierer kann nur wirken, wenn etwas das Raster
                // beschneidet (Umriss/Dachform oder Hindernis) und kein manueller
                // Versatz aktiv ist — sonst Knopf ehrlich ausgrauen (Genrih 13.07.:
                // „hat keine Funktion").
                const beschnitten = !!umrissVon(f) || (f.hindernisse?.length ?? 0) > 0;
                const gesperrt = !beschnitten || f.versatzXM !== undefined;
                return (
                  <button
                    type="button"
                    disabled={gesperrt}
                    title={
                      !beschnitten
                        ? 'Wirkt nur bei beschnittenen Flächen (Trapez/Schief/Umriss oder Hindernis) — auf dem vollen Rechteck sind alle Reihen ohnehin voll.'
                        : f.versatzXM !== undefined
                          ? 'Erst Versatz zurücksetzen (Verschieben → „↺ Zurücksetzen") — mit manuellem Versatz ist der Optimierer aus.'
                          : 'Für schiefe Dächer (Parallelogramm, Schrägschnitt): jede Reihe wird einzeln maximal gefüllt, ohne dass die Spalten fluchten müssen. Standard: gerade Montage, Versatz nur bei klarem Gewinn.'
                    }
                    onClick={() =>
                      patchFlaeche(f.id, {
                        optimierung: f.optimierung === 'frei' ? undefined : 'frei',
                        inaktiv: [],
                      })
                    }
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                      f.optimierung === 'frei'
                        ? 'border-akzent bg-akzent text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <IconReihenVersetzen />
                    Reihen frei versetzen
                  </button>
                );
              })()}

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
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
                      onClick={() => setZeichnung({ flaecheId: f.id, art: 'umriss', punkte: [] })}
                    >
                      <IconUmriss />
                      Umriss zeichnen{f.umrissM ? ' (neu)' : ''}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
                      onClick={() =>
                        setZeichnung({ flaecheId: f.id, art: 'hindernis', punkte: [] })
                      }
                    >
                      <IconHindernis />
                      Hindernis markieren
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

            {/* Aktives Werkzeug: Bedienpanel + Anleitung direkt am Dach */}
            {belegungZeigen && modusArt(f) === 'loeschen' && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-red-800">
                    {loeschAuswahl.length} {loeschAuswahl.length === 1 ? 'Modul' : 'Module'} ausgewählt
                  </span>
                  <button
                    type="button"
                    disabled={loeschAuswahl.length === 0}
                    className="h-9 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white enabled:hover:bg-red-700 disabled:opacity-40"
                    onClick={() => loeschBestaetigen(f)}
                  >
                    Endgültig löschen
                  </button>
                  <button
                    type="button"
                    className={aktionKlasse}
                    onClick={() => setzeModus(f, null)}
                  >
                    Abbrechen
                  </button>
                </div>
                <p className="mt-1 text-xs text-red-800">
                  <strong>Modul löschen:</strong> zu löschende Module antippen (rot umrandet), dann
                  „Endgültig löschen". Diese Felder bleiben dauerhaft leer — auch beim Verschieben
                  oder Neu-Rechnen kommt dort kein Modul mehr hin. Nur „Modul setzen" darf dort
                  wieder eines platzieren. Rückgängig: „Gelöschte zurückholen".
                </p>
              </div>
            )}

            {belegungZeigen && modusArt(f) === 'einzeln' && (
              <div className="mb-3 rounded-lg bg-sky-50 px-3 py-2">
                {einzelAuswahl.length > 0 && (
                  <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      {einzelAuswahl.length === 1
                        ? 'Gewähltes Modul:'
                        : `${einzelAuswahl.length} Module gewählt:`}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      <span />
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeAuswahl(f, 0, -1)} title="nach oben">↑</button>
                      <span />
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeAuswahl(f, -1, 0)} title="nach links">←</button>
                      <span className="flex h-9 w-9 items-center justify-center text-slate-400">✥</span>
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeAuswahl(f, 1, 0)} title="nach rechts">→</button>
                      <span />
                      <button type="button" className={pfeilKlasse} onClick={() => verschiebeAuswahl(f, 0, 1)} title="nach unten">↓</button>
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
                    <button type="button" className={aktionKlasse} onClick={() => setEinzelAuswahl([])}>
                      ✕ Auswahl aufheben
                    </button>
                  </div>
                )}
                <p className="text-xs text-sky-800">
                  <strong>Einzeln verschieben:</strong> Module antippen (orange umrandet, mehrere
                  möglich — nochmal antippen wählt ab), dann mit den <strong>Pfeiltasten</strong> der
                  Tastatur oder den Pfeilknöpfen schieben. Die Auswahl bewegt sich gemeinsam, der Rest
                  der Anlage bleibt stehen; die alten Positionen bleiben frei. Passt die neue Lage
                  nicht (Rand/Umriss/Hindernis/Überlappung), passiert nichts.
                </p>
              </div>
            )}

            {modusArt(f) === 'verschieben' && (
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

            {belegungZeigen && modusArt(f) === 'reihe' && (
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <strong>Reihe drehen:</strong> ein Modul in der gewünschten Reihe antippen — die
                ganze Reihe wechselt zwischen quer und hochkant. Dabei ändern sich Platz und
                Modulzahl (wird neu gerechnet). „Alle Reihen gleich" setzt zurück.
              </p>
            )}
            {belegungZeigen && modusArt(f) === 'setzen' && (
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
                hervorheben={
                  modusArt(f) === 'loeschen'
                    ? { keys: loeschAuswahl, farbe: '#dc2626' }
                    : modusArt(f) === 'einzeln'
                      ? { keys: einzelAuswahl.map((i) => `-1-${i}`) }
                      : modusArt(f) === 'setzen' && gewaehltExtra != null
                        ? { keys: [`-1-${gewaehltExtra}`] }
                        : undefined
                }
                geist={modusArt(f) === 'setzen' ? geistFuer(f) : undefined}
                zeichnen={
                  modusArt(f) === 'setzen'
                    ? {
                        aktiv: true,
                        punkteM: [],
                        onKlickM: (p) => modulKlick(f, p),
                        onMoveM: (p) => setGeistM(p),
                      }
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
                  if (modusArt(f) === 'loeschen') {
                    // Auswahl an-/abwählen — gelöscht wird erst bei „Endgültig löschen"
                    setLoeschAuswahl((a) =>
                      a.includes(key) ? a.filter((k) => k !== key) : [...a, key],
                    );
                    return;
                  }
                  if (modusArt(f) === 'einzeln') {
                    waehleEinzeln(f, key);
                    return;
                  }
                  if (modusArt(f) === 'reihe') {
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
            {belegungZeigen && (modusArt(f) === null || modusArt(f) === 'verschieben') && (
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
