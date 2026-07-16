'use client';

import { useEffect, useRef, useState } from 'react';
import { posKey, type BelegungsFeldM } from '@pv-belegung/engine';
import {
  aktiveModule,
  fmtDe,
  leerePositionenFuer,
  modulById,
  modulMasse,
  rahmenBreiteVon,
  randVon,
  rasterFuer,
  umrissVon,
  vollFeldFuer,
  zonenVon,
  type Flaeche,
  type Projekt,
  type PunktM,
  type RechteckM,
} from '../lib/model';
import { DACHFARBEN } from '../lib/model';
import { DachSvg, griffPunkte, type GriffId } from './DachSvg';
import { FotoHintergrund } from './FotoHintergrund';
import {
  IconFeld,
  IconHindernis,
  IconLeeren,
  IconMasse,
  IconModulHoch,
  IconModulLoeschen,
  IconModulQuer,
  IconUmriss,
} from './icons';
import { HoldButton, Karte, KartenTitel, ToggleButton, ZonenBadge } from './ui';

/** Laufende Zeichnung (Umriss oder Hindernis) — immer nur eine Fläche gleichzeitig */
interface Zeichnung {
  flaecheId: string;
  art: 'umriss' | 'hindernis';
  punkte: PunktM[];
}

/**
 * Werkzeuge der Belegung (16.07.2026, Genrih: „Belegungsautomatismus mildern").
 * null = FELDER (Standard): Felder aufziehen, auswählen, verschieben.
 * 'zellen' = einzelne Module im Feld antippen und dauerhaft entfernen.
 */
type WerkzeugArt = 'zellen';

/** Laufende Zeiger-Geste — lebt nur im State, wird erst beim Loslassen committet. */
type Drag =
  | { art: 'neu'; flaecheId: string; start: PunktM; aktuell: PunktM }
  | { art: 'move'; flaecheId: string; start: PunktM; aktuell: PunktM; indices: number[] }
  | {
      art: 'resize';
      flaecheId: string;
      start: PunktM;
      aktuell: PunktM;
      index: number;
      griff: GriffId;
    };

/** Klick vs. Ziehen: darunter gilt die Geste als Klick (Meter). */
const KLICK_SCHWELLE_M = 0.05;
/** So viel Feld muss im Rahmen bleiben, damit es nicht „verloren geht" (Meter). */
const MIN_SICHTBAR_M = 0.5;
/** Fangradius der Größen-Griffe (Meter) — etwa Fingerbreite auf dem Tablet. */
const GRIFF_FANG_M = 0.35;
/** Kleinste Feldgröße beim Ziehen an den Griffen (Meter). */
const MIN_FELD_M = 0.2;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Feldgröße aus einem Griff-Zug (16.07.2026): nur die vom Griff berührten Kanten
 * wandern (`nw` = links+oben, `e` = nur rechts …). Zieht man eine Kante über die
 * gegenüberliegende hinaus, klappt das Rechteck um, statt negativ zu werden.
 */
function feldMitGriff(feld: BelegungsFeldM, griff: GriffId, dx: number, dy: number): RechteckM {
  let { xM: links, yM: oben, breiteM, hoeheM } = feld;
  let rechts = links + breiteM;
  let unten = oben + hoeheM;
  if (griff.includes('w')) links += dx;
  if (griff.includes('e')) rechts += dx;
  if (griff.includes('n')) oben += dy;
  if (griff.includes('s')) unten += dy;
  return {
    xM: Math.min(links, rechts),
    yM: Math.min(oben, unten),
    breiteM: Math.max(MIN_FELD_M, Math.abs(rechts - links)),
    hoeheM: Math.max(MIN_FELD_M, Math.abs(unten - oben)),
  };
}

/** Normalisiertes Rechteck aus zwei gezogenen Ecken. */
function rechteckAus(a: PunktM, b: PunktM): RechteckM {
  return {
    xM: Math.min(a[0], b[0]),
    yM: Math.min(a[1], b[1]),
    breiteM: Math.abs(b[0] - a[0]),
    hoeheM: Math.abs(b[1] - a[1]),
  };
}

function punktInRechteck(p: PunktM, r: RechteckM): boolean {
  return p[0] >= r.xM && p[0] <= r.xM + r.breiteM && p[1] >= r.yM && p[1] <= r.yM + r.hoeheM;
}

/**
 * Segment-Knopf der Werkzeugleiste (U1, 08.07.): Werkzeuge liegen als Gruppe auf
 * grauem Grund, das aktive als weiße „Pille" — wie in einem Zeichenprogramm.
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
  // Aktives Werkzeug (exklusiv je Fläche); null = Felder-Werkzeug (Standard)
  const [modus, setModus] = useState<{ art: WerkzeugArt; flaecheId: string } | null>(null);
  // Schrittweite der Pfeil-Bewegung in cm
  const [schrittCm, setSchrittCm] = useState(10);
  // Ausgewählte Felder (Indices in Flaeche.felder) — Mehrfachauswahl per Antippen
  const [auswahl, setAuswahl] = useState<{ flaecheId: string; indices: number[] } | null>(null);
  // Laufende Zeiger-Geste (Aufziehen/Verschieben) — NICHT im Projekt, s. mitDrag()
  const [drag, setDrag] = useState<Drag | null>(null);
  /**
   * Läuft gerade eine Geste? Als Ref, damit `onUpM` doppelt aufgerufen werden darf
   * (SVG-Handler + Sicherheitsnetz unten) und trotzdem genau EINMAL committet — ein
   * zweiter Commit würde das Delta ein zweites Mal aufaddieren.
   */
  const dragAktiv = useRef(false);

  const gesamt = projekt.flaechen.reduce(
    (sum, f) => sum + aktiveModule(f, rasterFuer(f, modul)),
    0,
  );
  const kwp = (gesamt * modul.pmaxW) / 1000;

  /**
   * Aktuellster Projektstand — auch zwischen zwei Renders (16.07.2026). Ein
   * gehaltener Pfeil (Tastatur-Repeat ~30/s, Halte-Knopf alle 130 ms) feuert
   * schneller, als React neu rendert; ohne diese Ref läse jeder Schritt die
   * Fläche der letzten gerenderten Closure und rechnete wieder von derselben
   * Ausgangslage — jeder zweite Schritt ginge verloren (gemessen: 2 statt 8/s).
   */
  const projektRef = useRef(projekt);
  projektRef.current = projekt;

  const patchFlaeche = (id: string, patch: Partial<Flaeche>) => {
    const neu = {
      ...projektRef.current,
      flaechen: projektRef.current.flaechen.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    };
    projektRef.current = neu; // sofort mitziehen, nicht erst beim nächsten Render
    onChange(neu);
  };

  /** Fläche im AKTUELLEN Stand (nicht der gerenderten Closure) — für Wiederhol-Aktionen. */
  const frisch = (f: Flaeche): Flaeche => projektRef.current.flaechen.find((x) => x.id === f.id) ?? f;

  const modusArt = (f: Flaeche): WerkzeugArt | null =>
    modus?.flaecheId === f.id ? modus.art : null;

  /** Werkzeug wechseln — räumt Auswahl/Geste des vorherigen Modus auf. */
  const setzeModus = (f: Flaeche, art: WerkzeugArt | null) => {
    setModus(art ? { art, flaecheId: f.id } : null);
    setAuswahl(null);
    setDrag(null);
  };

  const felderVon = (f: Flaeche): BelegungsFeldM[] => f.felder ?? [];
  const auswahlVon = (f: Flaeche): number[] =>
    auswahl?.flaecheId === f.id ? auswahl.indices.filter((i) => i < felderVon(f).length) : [];

  /**
   * Welcher Ausrichtungs-Knopf leuchtet? Das, was die betroffenen Felder TATSÄCHLICH
   * haben (Auswahl, sonst alle) — bei gemischten Feldern keiner. Ohne Felder gilt die
   * Vorgabe für neue.
   */
  const ausrichtungAktiv = (f: Flaeche): 'hoch' | 'quer' | null => {
    const felder = felderVon(f);
    const indices = auswahlVon(f);
    const betroffen = indices.length ? felder.filter((_, i) => indices.includes(i)) : felder;
    if (betroffen.length === 0) return f.ausrichtung;
    if (betroffen.every((x) => x.quer)) return 'quer';
    if (betroffen.every((x) => !x.quer)) return 'hoch';
    return null; // gemischt
  };

  /**
   * Feld-Position in den Rahmen klemmen: es darf über den Rand hinausragen (dann
   * fallen Module weg — genau das wollte Genrih), aber nicht komplett verschwinden.
   */
  const klemmeFeld = (f: Flaeche, feld: BelegungsFeldM, xM: number, yM: number) => {
    const B = rahmenBreiteVon(f);
    const H = f.hoeheM;
    return {
      xM: Math.max(-feld.breiteM + MIN_SICHTBAR_M, Math.min(B - MIN_SICHTBAR_M, xM)),
      yM: Math.max(-feld.hoeheM + MIN_SICHTBAR_M, Math.min(H - MIN_SICHTBAR_M, yM)),
    };
  };

  /**
   * Fläche mit laufender Zieh-Geste (nur zum Rendern). Während des Ziehens wird
   * NICHT ins Projekt geschrieben: jede Projekt-Änderung serialisiert das ganze
   * Projekt inkl. Foto-DataURLs nach localStorage — das würde bei jedem
   * Mausschritt ruckeln. Commit passiert einmalig beim Loslassen.
   */
  const mitDrag = (f: Flaeche): Flaeche => {
    if (!drag || drag.flaecheId !== f.id) return f;
    const dx = drag.aktuell[0] - drag.start[0];
    const dy = drag.aktuell[1] - drag.start[1];
    if (drag.art === 'move') {
      return {
        ...f,
        felder: felderVon(f).map((feld, i) =>
          drag.indices.includes(i)
            ? { ...feld, ...klemmeFeld(f, feld, feld.xM + dx, feld.yM + dy) }
            : feld,
        ),
      };
    }
    if (drag.art === 'resize') {
      return {
        ...f,
        felder: felderVon(f).map((feld, i) =>
          i === drag.index ? { ...feld, ...feldMitGriff(feld, drag.griff, dx, dy) } : feld,
        ),
      };
    }
    return f;
  };

  /**
   * Ausgewählte Felder um `schrittCm` bewegen (Pfeiltasten und Pfeil-Knöpfe).
   * Liest die Fläche über `frisch()`, damit gehaltene Pfeile jeden Schritt
   * wirklich weiterschieben statt immer wieder dieselbe Zielposition zu setzen.
   */
  const bewegeAuswahl = (fArg: Flaeche, sx: number, sy: number) => {
    const f = frisch(fArg);
    const indices = auswahlVon(f);
    if (indices.length === 0) return;
    const step = Math.max(0.01, schrittCm / 100);
    patchFlaeche(f.id, {
      felder: felderVon(f).map((feld, i) => {
        if (!indices.includes(i)) return feld;
        const k = klemmeFeld(f, feld, feld.xM + sx * step, feld.yM + sy * step);
        return { ...feld, xM: round2(k.xM), yM: round2(k.yM) };
      }),
    });
  };

  /**
   * Pfeiltasten der Tastatur bewegen die Auswahl. Gedrückthalten wiederholt sich
   * über den nativen Key-Repeat des Systems — jedes Event ist ein sichtbarer
   * Schritt, deshalb bewusst KEIN Debounce. Ohne Dep-Array registriert (wie im
   * Rest der Datei), damit die Closures immer frisch sind.
   */
  useEffect(() => {
    const f = projekt.flaechen.find((x) => x.id === auswahl?.flaecheId);
    if (!f || modusArt(f) !== null || auswahlVon(f).length === 0) return;
    const richtung: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const handler = (e: KeyboardEvent) => {
      const v = richtung[e.key];
      if (!v) return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName)) return;
      e.preventDefault();
      bewegeAuswahl(f, v[0], v[1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ---- Zeiger-Gesten im Felder-Werkzeug ----

  const onDownM = (f: Flaeche, p: PunktM) => {
    const felder = felderVon(f);
    // Griffe der AUSGEWÄHLTEN Felder haben Vorrang vor allem anderen — sie liegen
    // auf dem Feldrand, dort würde sonst sofort das Verschieben starten.
    for (const i of auswahlVon(f)) {
      const feld = felder[i];
      if (!feld) continue;
      for (const { id, p: gp } of griffPunkte(feld)) {
        if (Math.hypot(p[0] - gp[0], p[1] - gp[1]) <= GRIFF_FANG_M) {
          dragAktiv.current = true;
          setDrag({ art: 'resize', flaecheId: f.id, start: p, aktuell: p, index: i, griff: id });
          return;
        }
      }
    }
    // Oberstes Feld unter dem Zeiger gewinnt (später gezogen = weiter oben)
    let treffer = -1;
    for (let i = felder.length - 1; i >= 0; i--) {
      if (punktInRechteck(p, felder[i]!)) {
        treffer = i;
        break;
      }
    }
    dragAktiv.current = true;
    if (treffer < 0) {
      setDrag({ art: 'neu', flaecheId: f.id, start: p, aktuell: p });
      return;
    }
    // Feld aus der Auswahl angefasst → ganze Auswahl bewegen, sonst nur dieses
    const gewaehlt = auswahlVon(f);
    const indices = gewaehlt.includes(treffer) ? gewaehlt : [treffer];
    setDrag({ art: 'move', flaecheId: f.id, start: p, aktuell: p, indices });
  };

  const onUpM = (f: Flaeche, p: PunktM) => {
    if (!drag || drag.flaecheId !== f.id || !dragAktiv.current) return;
    dragAktiv.current = false;
    const weit = Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) >= KLICK_SCHWELLE_M;
    if (!weit) {
      // Klick: ins Leere = Auswahl aufheben; auf ein Feld = an-/abwählen;
      // auf einen Griff = nichts (Auswahl behalten, sonst verlöre man sie sofort)
      if (drag.art === 'neu') setAuswahl(null);
      else if (drag.art === 'move') {
        const i = drag.indices[drag.indices.length - 1]!;
        const alt = auswahlVon(f);
        const neu = alt.includes(i) ? alt.filter((x) => x !== i) : [...alt, i];
        setAuswahl(neu.length ? { flaecheId: f.id, indices: neu } : null);
      }
      setDrag(null);
      return;
    }
    if (drag.art === 'neu') {
      const rect = rechteckAus(drag.start, p);
      const { w, h } = modulMasse(modul, f.ausrichtung === 'quer');
      // Winziges Feld = Fehlgriff, kein Modul passt ohnehin rein
      if (rect.breiteM >= w / 2 && rect.hoeheM >= h / 2) {
        const felder = felderVon(f);
        patchFlaeche(f.id, {
          felder: [
            ...felder,
            {
              xM: round2(rect.xM),
              yM: round2(rect.yM),
              breiteM: round2(rect.breiteM),
              hoeheM: round2(rect.hoeheM),
              quer: f.ausrichtung === 'quer',
            },
          ],
        });
        setAuswahl({ flaecheId: f.id, indices: [felder.length] });
      }
    } else {
      // Verschieben/Größe-Ändern committen (Auswahl bleibt bestehen)
      const bewegt = mitDrag(f).felder ?? [];
      const betrifft = (i: number) => (drag.art === 'move' ? drag.indices.includes(i) : i === drag.index);
      patchFlaeche(f.id, {
        felder: bewegt.map((feld, i) =>
          betrifft(i)
            ? {
                ...feld,
                xM: round2(feld.xM),
                yM: round2(feld.yM),
                breiteM: round2(feld.breiteM),
                hoeheM: round2(feld.hoeheM),
              }
            : feld,
        ),
      });
    }
    setDrag(null);
  };

  /**
   * Sicherheitsnetz gegen hängende Gesten (16.07.2026): Kommt das `pointerup`
   * nicht am SVG an — verlorener Pointer-Capture, Systemgeste, Fenster verlassen —,
   * bliebe der Drag ewig offen und die Belegung dauerhaft verschoben ANGEZEIGT,
   * obwohl der gespeicherte Stand ein anderer ist. Hier endet jede Geste, sobald
   * der Zeiger irgendwo losgelassen wird. Doppelaufruf ist über `dragAktiv` sicher.
   */
  useEffect(() => {
    if (!drag) return;
    const f = projekt.flaechen.find((x) => x.id === drag.flaecheId);
    if (!f) return;
    const ende = () => {
      if (dragAktiv.current) onUpM(f, drag.aktuell);
      else setDrag(null);
    };
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
    return () => {
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
    };
  });

  /** Live-Vorschau beim Aufziehen: Rechteck + wie viele Module hineinpassen. */
  const vorschauFuer = (f: Flaeche) => {
    if (!drag || drag.flaecheId !== f.id || drag.art !== 'neu') return null;
    const rect = rechteckAus(drag.start, drag.aktuell);
    const probe: BelegungsFeldM = { ...rect, quer: f.ausrichtung === 'quer' };
    // Zählen lässt die ENGINE (SPEC §3.4) — die UI rechnet nicht selbst
    const anzahl = rasterFuer({ ...f, felder: [...felderVon(f), probe] }, modul).positionen.filter(
      (p) => p.feld === felderVon(f).length,
    ).length;
    return { rect, anzahl };
  };

  // ---- Aktionen ----

  const automatischFuellen = (f: Flaeche) => {
    const feld = vollFeldFuer(f, modul);
    if (feld.breiteM <= 0 || feld.hoeheM <= 0) return; // passt kein Modul
    if (felderVon(f).length > 0 && !window.confirm('Bestehende Felder ersetzen?')) return;
    patchFlaeche(f.id, { felder: [feld] });
    setAuswahl({ flaecheId: f.id, indices: [0] });
  };

  const alleFelderLoeschen = (f: Flaeche) => {
    if (!window.confirm(`Alle Belegungsfelder von „${f.name}" entfernen?`)) return;
    patchFlaeche(f.id, { felder: [] });
    setAuswahl(null);
  };

  const auswahlLoeschen = (f: Flaeche) => {
    const indices = auswahlVon(f);
    if (indices.length === 0) return;
    patchFlaeche(f.id, { felder: felderVon(f).filter((_, i) => !indices.includes(i)) });
    setAuswahl(null);
  };

  /**
   * Quer/Hochkant (16.07.2026, Genrih: „funktioniert nicht"): der Knopf dreht die
   * MODULE — sonst passiert beim Klicken sichtbar nichts. Sind Felder ausgewählt,
   * gilt es nur für die (gemischte Dächer bleiben möglich), sonst für alle. Der
   * Wert ist gleichzeitig die Ausrichtung für neu gezogene Felder.
   */
  const setzeAusrichtung = (f: Flaeche, ausrichtung: 'hoch' | 'quer') => {
    const quer = ausrichtung === 'quer';
    const indices = auswahlVon(f);
    const betroffen = (i: number) => indices.length === 0 || indices.includes(i);
    patchFlaeche(f.id, {
      ausrichtung,
      felder: felderVon(f).map((feld, i) =>
        // leer verwerfen: nach dem Drehen meinen die Zellnummern andere Module
        betroffen(i) && feld.quer !== quer ? { ...feld, quer, leer: undefined } : feld,
      ),
    });
  };

  const leereZellen = (f: Flaeche, indices: number[]) =>
    indices.reduce((n, i) => n + (felderVon(f)[i]?.leer?.length ?? 0), 0);

  const zellenZurueckholen = (f: Flaeche, indices: number[]) =>
    patchFlaeche(f.id, {
      felder: felderVon(f).map((feld, i) => (indices.includes(i) ? { ...feld, leer: undefined } : feld)),
    });

  /**
   * „Module an/aus": angetipptes Modul abschalten — oder einen angetippten Geist
   * wieder anschalten (16.07.2026, Genrih). Toggle statt Einbahnstraße: vorher
   * konnte man ein versehentlich abgeschaltetes Modul nur alle-auf-einmal
   * zurückholen, weil die Lücke unsichtbar war.
   */
  const zelleToggle = (fArg: Flaeche, key: string) => {
    const f = frisch(fArg);
    const m = /^f(\d+):(-?\d+)-(-?\d+)$/.exec(key);
    if (!m) return;
    const fi = Number(m[1]);
    const zelle = `${m[2]}-${m[3]}`;
    const felder = felderVon(f);
    const feld = felder[fi];
    if (!feld) return;
    const aus = feld.leer?.includes(zelle) ?? false;
    const leer = aus
      ? (feld.leer ?? []).filter((z) => z !== zelle)
      : [...(feld.leer ?? []), zelle];
    patchFlaeche(f.id, {
      felder: felder.map((x, i) => (i === fi ? { ...x, leer: leer.length ? leer : undefined } : x)),
    });
  };

  const pfeilKlasse =
    'h-9 w-9 rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:border-akzent active:bg-akzent active:text-white disabled:opacity-40';
  const aktionKlasse =
    'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-40';

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
    const rect = rechteckAus(a, p);
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
        const fEff = mitDrag(f);
        const raster = rasterFuer(fEff, modul);
        const aktiv = aktiveModule(fEff, raster);
        const zeichneHier = zeichnung?.flaecheId === f.id ? zeichnung : null;
        // Umriss/Hindernis-Zeichnen in SchrittBelegung nur für die Draufsicht
        // (ohne Foto). Bei Foto passiert das in FotoHintergrund auf dem leeren Dach.
        const zeichenbar = !f.foto;
        // Belegung erst zeigen, wenn keine Foto-Markierung mehr läuft (Hindernisse
        // werden VORHER auf dem leeren Foto gesetzt, Genrih 07.07.).
        const belegungZeigen = !f.foto || !!f.markierungFertig || !!f.foto.traufePx;
        const felder = felderVon(fEff);
        const gewaehlt = auswahlVon(f);
        // Felder-Werkzeug: aktiv, solange kein anderes Werkzeug und nichts gezeichnet wird
        const felderWerkzeug = modusArt(f) === null && !zeichneHier && belegungZeigen;
        const leerZahl = leereZellen(f, gewaehlt.length ? gewaehlt : felder.map((_, k) => k));

        return (
          <Karte key={f.id}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <ZonenBadge label={zonenVon(f, i)} />
              <KartenTitel>{f.name}</KartenTitel>
              <span className="ml-auto text-sm text-slate-500">
                {aktiv} {aktiv === 1 ? 'Modul' : 'Module'} · {fmtDe((aktiv * modul.pmaxW) / 1000, 2)}{' '}
                kWp
                {felder.length > 0 && ` · ${felder.length} ${felder.length === 1 ? 'Feld' : 'Felder'}`}
              </span>
            </div>

            {/* Zeile 1 — WERKZEUGE + Aktionen */}
            {belegungZeigen && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === null}
                    title="Felder aufziehen, auswählen und verschieben"
                    onClick={() => setzeModus(f, null)}
                  >
                    <IconFeld />
                    Felder
                  </WerkzeugKnopf>
                  <WerkzeugKnopf
                    aktiv={modusArt(f) === 'zellen'}
                    disabled={felder.length === 0}
                    title={
                      felder.length === 0
                        ? 'Erst ein Belegungsfeld aufziehen'
                        : 'Einzelne Module antippen zum Ab- und wieder Anschalten'
                    }
                    onClick={() => setzeModus(f, modusArt(f) === 'zellen' ? null : 'zellen')}
                  >
                    <IconModulLoeschen />
                    Module an/aus
                  </WerkzeugKnopf>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={aktionKlasse}
                    title="Ein Feld über die ganze nutzbare Fläche legen (danach frei verschiebbar)"
                    onClick={() => automatischFuellen(f)}
                  >
                    <IconFeld />
                    Automatisch füllen
                  </button>
                  {felder.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                      title="Alle Belegungsfelder dieser Fläche entfernen"
                      onClick={() => alleFelderLoeschen(f)}
                    >
                      <IconLeeren />
                      Leeren
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Zeile 2 — EINSTELLUNGEN: Ausrichtung, Randabstand, Dachfarbe */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <WerkzeugKnopf
                  aktiv={ausrichtungAktiv(fEff) === 'quer'}
                  title={
                    gewaehlt.length > 0
                      ? `Die ${gewaehlt.length} ausgewählten Felder quer legen`
                      : 'Alle Module quer legen (und Vorgabe für neue Felder)'
                  }
                  onClick={() => setzeAusrichtung(f, 'quer')}
                >
                  <IconModulQuer />
                  Quer
                </WerkzeugKnopf>
                <WerkzeugKnopf
                  aktiv={ausrichtungAktiv(fEff) === 'hoch'}
                  title={
                    gewaehlt.length > 0
                      ? `Die ${gewaehlt.length} ausgewählten Felder hochkant stellen`
                      : 'Alle Module hochkant stellen (und Vorgabe für neue Felder)'
                  }
                  onClick={() => setzeAusrichtung(f, 'hoch')}
                >
                  <IconModulHoch />
                  Hochkant
                </WerkzeugKnopf>
              </div>

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
                    patchFlaeche(f.id, { randM: cm / 100 });
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
                    onClick={() => patchFlaeche(f.id, { dachfarbe: d.id })}
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
                      className={aktionKlasse}
                      onClick={() => {
                        setAuswahl(null);
                        setZeichnung({ flaecheId: f.id, art: 'umriss', punkte: [] });
                      }}
                    >
                      <IconUmriss />
                      Umriss zeichnen{f.umrissM ? ' (neu)' : ''}
                    </button>
                    <button
                      type="button"
                      className={aktionKlasse}
                      onClick={() => {
                        setAuswahl(null);
                        setZeichnung({ flaecheId: f.id, art: 'hindernis', punkte: [] });
                      }}
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
                  (f.hindernisse ?? []).map((h, hi) => (
                    <button
                      key={hi}
                      type="button"
                      title="Hindernis entfernen"
                      className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                      onClick={() =>
                        patchFlaeche(f.id, {
                          hindernisse: (f.hindernisse ?? []).filter((_, j) => j !== hi),
                        })
                      }
                    >
                      {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m ✕
                    </button>
                  ))}
              </div>
            )}

            {/* Felder-Panel: Pfeile (Tastatur + Halten), Auswahl-Aktionen */}
            {felderWerkzeug && felder.length > 0 && (
              <div className="mb-3 rounded-lg bg-sky-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="grid grid-cols-3 gap-1">
                    <span />
                    <HoldButton
                      className={pfeilKlasse}
                      disabled={gewaehlt.length === 0}
                      title="nach oben (Pfeiltaste ↑, gedrückt halten schiebt weiter)"
                      onTrigger={() => bewegeAuswahl(f, 0, -1)}
                    >
                      ↑
                    </HoldButton>
                    <span />
                    <HoldButton
                      className={pfeilKlasse}
                      disabled={gewaehlt.length === 0}
                      title="nach links (Pfeiltaste ←, gedrückt halten schiebt weiter)"
                      onTrigger={() => bewegeAuswahl(f, -1, 0)}
                    >
                      ←
                    </HoldButton>
                    <span className="flex h-9 w-9 items-center justify-center text-slate-400">✥</span>
                    <HoldButton
                      className={pfeilKlasse}
                      disabled={gewaehlt.length === 0}
                      title="nach rechts (Pfeiltaste →, gedrückt halten schiebt weiter)"
                      onTrigger={() => bewegeAuswahl(f, 1, 0)}
                    >
                      →
                    </HoldButton>
                    <span />
                    <HoldButton
                      className={pfeilKlasse}
                      disabled={gewaehlt.length === 0}
                      title="nach unten (Pfeiltaste ↓, gedrückt halten schiebt weiter)"
                      onTrigger={() => bewegeAuswahl(f, 0, 1)}
                    >
                      ↓
                    </HoldButton>
                    <span />
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    Schritt
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      value={schrittCm}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n >= 1) setSchrittCm(n);
                      }}
                      className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                    />
                    cm
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={aktionKlasse}
                      onClick={() =>
                        setAuswahl({ flaecheId: f.id, indices: felder.map((_, k) => k) })
                      }
                    >
                      Alle auswählen
                    </button>
                    <button
                      type="button"
                      className={aktionKlasse}
                      disabled={gewaehlt.length === 0}
                      onClick={() => setAuswahl(null)}
                    >
                      ✕ Auswahl aufheben
                    </button>
                    {leerZahl > 0 && (
                      <button
                        type="button"
                        className={aktionKlasse}
                        title="Gelöschte Module in den ausgewählten Feldern wiederherstellen"
                        onClick={() =>
                          zellenZurueckholen(f, gewaehlt.length ? gewaehlt : felder.map((_, k) => k))
                        }
                      >
                        Gelöschte Module zurückholen ({leerZahl})
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300 disabled:opacity-40"
                      disabled={gewaehlt.length === 0}
                      onClick={() => auswahlLoeschen(f)}
                    >
                      🗑 Feld löschen{gewaehlt.length > 1 ? ` (${gewaehlt.length})` : ''}
                    </button>
                  </div>
                  <span className="text-sm text-slate-500">
                    {gewaehlt.length === 0
                      ? 'kein Feld ausgewählt'
                      : `${gewaehlt.length} von ${felder.length} ausgewählt`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-sky-800">
                  <strong>Ziehen</strong> auf freier Fläche = neues Feld · <strong>Antippen</strong>{' '}
                  = aus-/abwählen (mehrere möglich) · <strong>Ziehen am Feld</strong> = verschieben ·{' '}
                  <strong>an den weißen Griffen ziehen</strong> = Größe korrigieren ·{' '}
                  <strong>Pfeiltasten</strong> (oder die Knöpfe, gedrückt halten) = cm-genau schieben.
                  Über den Rand/Umriss/ein Hindernis geschobene Module fallen einfach weg. Einzelne
                  Module ab-/anschalten: Werkzeug „Module an/aus".
                </p>
              </div>
            )}

            {belegungZeigen && modusArt(f) === 'zellen' && (
              <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Module antippen zum Ab- und wieder Anschalten.
                  </span>
                  {leerZahl > 0 && (
                    <button
                      type="button"
                      className={aktionKlasse}
                      onClick={() => zellenZurueckholen(f, felder.map((_, k) => k))}
                    >
                      Alle anschalten ({leerZahl})
                    </button>
                  )}
                  <button type="button" className={aktionKlasse} onClick={() => setzeModus(f, null)}>
                    ✓ Fertig
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Abgeschaltete Module bleiben als graue Lücke sichtbar — nochmal antippen holt sie
                  zurück. Die Lücke gehört zum Feld und wandert beim Verschieben mit. Im PDF ist
                  dort nichts.
                </p>
              </div>
            )}

            {!belegungZeigen ? null : (
              <DachSvg
                flaeche={fEff}
                raster={raster}
                modul={modul}
                masse={masseZeigen}
                felderAnzeige={felder.map((feld, k) => ({
                  rect: feld,
                  ausgewaehlt: gewaehlt.includes(k),
                }))}
                feldVorschau={vorschauFuer(f)}
                geister={
                  modusArt(f) === 'zellen'
                    ? leerePositionenFuer(fEff, modul).map((p) => ({
                        key: posKey(p),
                        xM: p.xM,
                        yM: p.yM,
                        wM: p.wM,
                        hM: p.hM,
                      }))
                    : undefined
                }
                pointer={
                  felderWerkzeug
                    ? {
                        onDownM: (p) => onDownM(f, p),
                        onMoveM: (p) =>
                          setDrag((d) =>
                            !d || d.flaecheId !== f.id ? d : p ? { ...d, aktuell: p } : null,
                          ),
                        onUpM: (p) => onUpM(f, p),
                      }
                    : undefined
                }
                zeichnen={
                  zeichneHier
                    ? { aktiv: true, punkteM: zeichneHier.punkte, onKlickM: (p) => klickM(f, p) }
                    : undefined
                }
                onToggle={modusArt(f) === 'zellen' ? (key) => zelleToggle(f, key) : undefined}
              />
            )}

            {belegungZeigen && felder.length === 0 && !zeichneHier && (
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <strong>Noch nichts belegt.</strong> Ein Rechteck aufs Dach ziehen — es füllt sich
                mit Modulen. Beliebig viele Felder möglich; „Automatisch füllen" legt eins über die
                ganze Fläche.
              </p>
            )}
            {belegungZeigen && felder.length > 0 && raster.positionen.length === 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Kein Modul passt — Feld zu klein oder außerhalb der nutzbaren Fläche (Randabstand{' '}
                {Math.round(randVon(f) * 100)} cm
                {umrissVon(f) ? ', Umriss' : ''}
                {(f.hindernisse?.length ?? 0) > 0 ? ', Hindernis' : ''}).
              </p>
            )}
            {belegungZeigen && (
              <p className="mt-2 text-xs text-slate-400">
                Randabstand {Math.round(randVon(f) * 100)} cm, Klemmfuge 20 mm
                {f.umrissM ? `, Umriss mit ${f.umrissM.length} Ecken` : ''}
                {f.foto ? ' · Kamin/Fenster/SAT über „✎ Markierung ändern" aufs leere Foto setzen.' : ''}
              </p>
            )}
          </Karte>
        );
      })}
    </div>
  );
}
