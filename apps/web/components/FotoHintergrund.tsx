'use client';

import React, { useEffect, useRef, useState } from 'react';
import { dateiZuBild } from '../lib/bild';
import {
  belegungsCheck,
  hindernisAusKlicks,
  homographie,
  orientiereEcken,
  pruefePerspektive,
  pruefeUmrissAusKlicks,
  projiziere,
  sortiereEcken,
  traufeWechseln,
  verschiebeFotoPunkt,
  type Ecken,
  type Punkt,
} from '../lib/foto-geometrie';
import { artVon, DACHFARBEN, fmtDe, perspektiveQuelle, rahmenBreiteVon, type DachFoto, type Flaeche } from '../lib/model';
import { IconFoto } from './icons';

/**
 * Drohnenfoto-Hintergrund je Dachfläche (Foto bleibt lokal, SPEC §8.1).
 *
 * Ablauf (07.07.2026, nach Genrih-Feedback):
 * 1. FIRST: eine Linie entlang First/Traufe ziehen → legt die Traufe-Achse fest
 *    (behebt vertauschte Hoch/Quer-Ausrichtung bei schrägen Dächern). Überspringbar.
 * 2. PERSPEKTIVE: die 4 Ecken des Dach-Rechtecks markieren (auch wenn eine in der
 *    Luft liegt) → Homographie. Ein Fadenkreuz am Mauszeiger hilft beim Zielen.
 * 3. UMRISS (optional): den echten Rand der Dachfläche einzeichnen (beliebig viele
 *    Ecken; rechteckiges Dach → überspringen). Wieder mit Fadenkreuz + Vorschaulinie.
 * 4. HINDERNIS: Kamin/Fenster/SAT aufs noch leere Dach setzen.
 * 5. „Dach belegen".
 * „Ziegel zählen" liefert den Maßstab für den Belegungs-Check.
 */

async function dateiZuFoto(file: File): Promise<DachFoto> {
  const bild = await dateiZuBild(file);
  return { ...bild, traufePx: null, perspektiveBestaetigt: false };
}

function deckbreiteDefaultCm(f: Flaeche): number {
  const art = DACHFARBEN.find((d) => d.id === f.dachfarbe)?.art;
  return art === 'blech' ? 53 : 30;
}

type Modus = 'first' | 'perspektive' | 'umriss' | 'hindernis' | 'ziegel';

/** Ziehbarer Griff: ein noch nicht bestätigter Punkt oder ein Trauflinien-Punkt. */
type Griff = { art: 'punkt' | 'first'; i: number };

const knopfKlasse =
  'touch-target inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

function modusKnopfKlasse(aktiv: boolean): string {
  return `touch-target h-9 rounded-lg border px-3 text-sm font-medium ${
    aktiv ? 'border-akzent bg-akzent text-white' : 'border-slate-300 bg-white text-slate-700'
  }`;
}

/**
 * Schritt-Chip der Markier-Kette ①–④ (U3, 08.07.): zeigt Fortschritt (✓),
 * aktiven Schritt und gesperrte Schritte — die Vertriebler sehen, WO im Ablauf
 * sie sind, statt lose Modus-Knöpfe zu raten.
 */
function SchrittChip({
  nr,
  label,
  aktiv,
  erledigt,
  gesperrt,
  titel,
  onClick,
}: {
  nr: string;
  label: string;
  aktiv: boolean;
  erledigt: boolean;
  gesperrt?: boolean;
  titel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={gesperrt}
      title={titel}
      onClick={onClick}
      className={`touch-target h-9 rounded-lg border px-3 text-sm font-medium ${
        aktiv
          ? 'border-akzent bg-akzent text-white'
          : gesperrt
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
            : erledigt
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
      }`}
    >
      {erledigt && !aktiv ? '✓ ' : ''}
      {nr} {label}
    </button>
  );
}

export function FotoHintergrund({
  flaeche,
  onPatch,
  fotoVerwalten = true,
  zustandsKey,
  geometrieBehalten = false,
}: {
  flaeche: Flaeche;
  onPatch: (patch: Partial<Flaeche>) => void;
  /** false: Upload/Ersetzen/Löschen übernimmt die übergeordnete Foto-Gruppe. */
  fotoVerwalten?: boolean;
  /** Wechselt das übergeordnete Foto-Asset, werden alle flüchtigen Werkzeuge zurückgesetzt. */
  zustandsKey?: string;
  /** Neue Foto-Perspektiven dürfen den gemeinsamen metrischen Umriss nicht löschen. */
  geometrieBehalten?: boolean;
}) {
  const foto = flaeche.foto;
  const flaechenArt = artVon(flaeche);
  const istSchraegdach = flaechenArt === 'dach';
  const istFlachdach = flaechenArt === 'flachdach';
  const kantenName = istSchraegdach ? 'Traufe' : istFlachdach ? 'Referenzkante' : 'Unterkante';
  const flaechenName = istSchraegdach ? 'Dach' : istFlachdach ? 'Flachdach' : 'Fassade';
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [modus, setModus] = useState<Modus>('first');
  const [anzahlZiegel, setAnzahlZiegel] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState<number | null>(null);
  const [mausPx, setMausPx] = useState<Punkt | null>(null);
  // Referenzlinie First/Traufe → legt die Traufe-Achse fest (transient, nur beim Markieren)
  const [firstLinie, setFirstLinie] = useState<[Punkt, Punkt] | null>(null);
  // Gerade gezogener Punkt (Ecke/Trauflinie/Draft) — freies Nachjustieren per Drag.
  // In einem Ref, damit das Ziehen sofort greift (nicht erst nach dem Re-Render).
  const ziehtRef = useRef<Griff | null>(null);
  const [greift, setGreift] = useState(false); // nur für den Cursor
  // Startete der Maus-Druck auf einem Griff? Dann den folgenden Klick NICHT als „neuen Punkt" werten.
  const aufHandle = useRef(false);
  const [touchGeraet, setTouchGeraet] = useState(false);
  const [fadenkreuzAktiv, setFadenkreuzAktiv] = useState(false);
  const [touchCursorPx, setTouchCursorPx] = useState<Punkt | null>(null);
  const [touchGriff, setTouchGriff] = useState<Griff | null>(null);
  const [markierungsFehler, setMarkierungsFehler] = useState<string | null>(null);
  const touchSwipeRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const aktualisieren = () => setTouchGeraet(media.matches);
    aktualisieren();
    media.addEventListener?.('change', aktualisieren);
    return () => media.removeEventListener?.('change', aktualisieren);
  }, []);

  // Beim Ersetzen/Wechseln des Bild-Assets darf kein Entwurf oder Werkzeugmodus
  // des vorigen Fotos weiterlaufen. Bestehende Ecken führen direkt zu Hindernissen.
  useEffect(() => {
    setPunkte([]);
    setFirstLinie(null);
    setMausPx(null);
    setFadenkreuzAktiv(false);
    setTouchCursorPx(null);
    setTouchGriff(null);
    setMarkierungsFehler(null);
    touchSwipeRef.current = null;
    setModus(foto?.eckenPx ? 'hindernis' : 'first');
  }, [foto?.dataUrl, zustandsKey]);

  const B = flaeche.breiteM; // Traufe (Referenzstrecke für den Maß-Check)
  const rahmenB = rahmenBreiteVon(flaeche); // Rahmen (Homographie/Umriss/Hindernis)
  const H = flaeche.hoeheM;
  const deckCm = deckbreiteCm ?? deckbreiteDefaultCm(flaeche);
  const onFoto = (f: DachFoto | undefined) => onPatch({ foto: f });

  const markiert = !!(foto && (foto.eckenPx || foto.traufePx));
  const inMarkierung = !!foto && !flaeche.markierungFertig;
  // Parametrische Form (Trapez/Schief): Quell-Ecken bekannt → Nutzer klickt die
  // echten Dach-Ecken, kein Umriss nötig. Rechteck/manueller Umriss → undefined.
  const quelle = perspektiveQuelle(flaeche);
  const parametrisch = quelle !== undefined;
  const firstBreiteEff =
    flaeche.dachform === 'trapez' || flaeche.dachform === 'schief'
      ? flaeche.firstBreiteM ?? B
      : undefined;
  const erwFirstAnteil = firstBreiteEff !== undefined ? firstBreiteEff / B : 1;
  const hom = foto?.eckenPx ? homographie(rahmenB, H, foto.eckenPx, quelle) : null;
  const check =
    foto?.eckenPx != null
      ? belegungsCheck(
          foto.eckenPx,
          B,
          H,
          flaeche.neigungDeg,
          foto.pxProM,
          erwFirstAnteil,
          flaechenArt,
        )
      : null;
  const perspektivCheck = foto?.eckenPx
    ? pruefePerspektive(rahmenB, H, foto.eckenPx, quelle)
    : null;
  const perspektivVorschau: Ecken | null = (() => {
    if (modus !== 'perspektive' || punkte.length !== 4) return null;
    const vier = [punkte[0]!, punkte[1]!, punkte[2]!, punkte[3]!] as [Punkt, Punkt, Punkt, Punkt];
    return firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
  })();
  const vorschauCheck = perspektivVorschau
    ? pruefePerspektive(rahmenB, H, perspektivVorschau, quelle)
    : null;
  const umrissVorschauPruefung =
    modus === 'umriss' && punkte.length >= 3 && foto?.eckenPx
      ? pruefeUmrissAusKlicks(punkte, rahmenB, H, foto.eckenPx, quelle)
      : null;
  const umrissVorschauFehler =
    umrissVorschauPruefung && !umrissVorschauPruefung.ok
      ? umrissVorschauPruefung.grund
      : null;

  // Fadenkreuz-Vorschau nur in den Punkt-Setz-Modi
  const zeigtKreuz =
    modus === 'first' || modus === 'perspektive' || modus === 'umriss' || modus === 'hindernis';

  const wechsleModus = (m: Modus) => {
    setModus(m);
    setPunkte(
      m === 'perspektive' && foto?.eckenPx
        ? foto.eckenPx.map((p) => [p[0], p[1]] as Punkt)
        : m === 'umriss' && hom && flaeche.umrissM
          ? flaeche.umrissM.map((p) => {
              const [x, y] = projiziere(hom, [p[0], p[1]]);
              return [x, y] as Punkt;
            })
        : [],
    );
    setTouchGriff(null);
    setMarkierungsFehler(null);
  };

  const perspektiveAbschliessen = (pts: Punkt[]) => {
    if (!foto || pts.length < 4) return;
    const vier: [Punkt, Punkt, Punkt, Punkt] = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
    // Firstlinie (falls gezogen) legt die Traufe-Achse fest; sonst alter Heuristik-Fallback
    const ecken = firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
    const pruefung = pruefePerspektive(rahmenB, H, ecken, quelle);
    if (pruefung.status === 'fehler') {
      setMarkierungsFehler(pruefung.meldungen.join(' '));
      return;
    }
    onPatch({
      foto: {
        ...foto,
        eckenPx: ecken,
        traufePx: null,
        perspektiveBestaetigt: true,
      },
      ...(geometrieBehalten ? {} : { umrissM: undefined }),
      markierungFertig: false,
      inaktiv: [],
    });
    setPunkte([]);
    setMarkierungsFehler(null);
    setModus(geometrieBehalten ? 'hindernis' : 'umriss');
  };

  const umrissAbschliessen = (pts: Punkt[]) => {
    if (!foto?.eckenPx) return;
    const ergebnis = pruefeUmrissAusKlicks(pts, rahmenB, H, foto.eckenPx, quelle);
    if (!ergebnis.ok) {
      setMarkierungsFehler(ergebnis.grund);
      return;
    }
    onPatch({ umrissM: ergebnis.punkte, inaktiv: [] });
    setPunkte([]);
    setMarkierungsFehler(null);
    setModus('hindernis');
  };

  const umrissEntfernen = () => {
    if (!flaeche.umrissM) return;
    onPatch({ umrissM: undefined, inaktiv: [] });
    setPunkte([]);
    setTouchGriff(null);
    setMarkierungsFehler(null);
  };

  const hindernisSetzen = (p1: Punkt, p2: Punkt) => {
    if (!foto?.eckenPx) return;
    const rect = hindernisAusKlicks(p1, p2, rahmenB, H, foto.eckenPx, quelle);
    if (rect) onPatch({ hindernisse: [...(flaeche.hindernisse ?? []), rect], inaktiv: [] });
  };

  const svgKoord = (e: React.MouseEvent<SVGSVGElement>): Punkt | null => {
    if (!foto) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [
      ((e.clientX - rect.left) / rect.width) * foto.breitePx,
      ((e.clientY - rect.top) / rect.height) * foto.hoehePx,
    ];
  };

  /**
   * Ziehbare Griffe (Genrih 08.07.): die 4 Ecken lassen sich nach dem Setzen frei
   * verschieben (grob klicken, dann exakt auf die Dachecke ziehen), ebenso die
   * Trauflinie. Im Umriss-Modus sind sowohl neue als auch bereits gespeicherte
   * Eckpunkte ziehbar; freie Klicks ergänzen weiterhin zusätzliche Ecken.
   */
  const handles = (): { x: number; y: number; z: Griff }[] => {
    if (!foto) return [];
    const arr: { x: number; y: number; z: Griff }[] = [];
    if (modus === 'perspektive' || modus === 'umriss') {
      punkte.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'punkt', i } }));
    } else if (modus === 'first') {
      punkte.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'punkt', i } }));
      if (firstLinie) firstLinie.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'first', i } }));
    }
    return arr;
  };

  const naheHandle = (k: Punkt) => {
    const schwelle = foto ? foto.breitePx * 0.022 : 0;
    return handles().find((h) => Math.hypot(h.x - k[0], h.y - k[1]) <= schwelle);
  };

  /** Griff auf neue Position setzen (Ecke im Foto, Trauflinien-Punkt oder Draft-Punkt). */
  const setzeHandle = (z: Griff, k: Punkt) => {
    if (!foto) return;
    if (z.art === 'punkt') {
      setPunkte(punkte.map((p, i) => (i === z.i ? [k[0], k[1]] : p)));
    } else if (z.art === 'first' && firstLinie) {
      setFirstLinie(firstLinie.map((p, i) => (i === z.i ? [k[0], k[1]] : p)) as [Punkt, Punkt]);
    }
  };

  /** Eine Foto-Koordinate verarbeiten — gemeinsame Wahrheit für Maus und Tablet. */
  const verarbeitePunkt = (k: Punkt) => {
    if (!foto) return;
    const [x, y] = k;

    if (modus === 'first') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      setFirstLinie([neu[0]!, neu[1]!]);
      setPunkte([]);
      return setModus('perspektive');
    }

    if (modus === 'ziegel') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      const [[x1, y1], [x2, y2]] = neu as [Punkt, Punkt];
      const distPx = Math.hypot(x2 - x1, y2 - y1);
      const streckeM = (anzahlZiegel * deckCm) / 100;
      if (distPx > 0 && streckeM > 0) onFoto({ ...foto, pxProM: distPx / streckeM });
      setPunkte([]);
      return setModus(foto.eckenPx ? 'hindernis' : 'perspektive');
    }

    if (modus === 'hindernis') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      hindernisSetzen(neu[0]!, neu[1]!);
      return setPunkte([]);
    }

    if (modus === 'perspektive') {
      // Sind die 4 Ecken schon gesetzt, fügt ein Klick KEINE neue an — man justiert
      // dann nur noch per Ziehen. Neu setzen geht über „Ecken neu".
      if (punkte.length >= 4) return;
      const neu: Punkt[] = [...punkte, [x, y]];
      return setPunkte(neu);
    }

    // umriss: Klick nahe erstem Punkt schließt (ab 3 Ecken)
    if (punkte.length >= 3) {
      const [fx, fy] = punkte[0]!;
      if (Math.hypot(x - fx, y - fy) <= foto.breitePx * 0.025) return umrissAbschliessen(punkte);
    }
    setPunkte([...punkte, [x, y]]);
  };

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (fadenkreuzAktiv) return;
    // Kam der Klick vom Loslassen eines Griffs? Dann keinen neuen Punkt setzen.
    if (aufHandle.current) {
      aufHandle.current = false;
      return;
    }
    const k = svgKoord(e);
    if (k) verarbeitePunkt(k);
  };

  const starteFadenkreuz = () => {
    if (!foto) return;
    const ersterGriff = handles()[0];
    const letzterPunkt = punkte[punkte.length - 1];
    setTouchCursorPx(
      ersterGriff
        ? [ersterGriff.x, ersterGriff.y]
        : letzterPunkt
          ? [letzterPunkt[0], letzterPunkt[1]]
          : [foto.breitePx / 2, foto.hoehePx / 2],
    );
    setTouchGriff(null);
    setFadenkreuzAktiv(true);
  };

  const fadenkreuzAktion = () => {
    if (!touchCursorPx) return;
    if (touchGriff) {
      setzeHandle(touchGriff, touchCursorPx);
      setTouchGriff(null);
      return;
    }
    const griff = naheHandle(touchCursorPx);
    if (griff) {
      setTouchGriff(griff.z);
      return;
    }
    verarbeitePunkt(touchCursorPx);
  };

  const zurueckAufAnfang = () => {
    setPunkte([]);
    setFirstLinie(null);
    setModus('first');
  };

  const px = (v: number) => (foto ? foto.breitePx * v : 0);
  const letzter = punkte[punkte.length - 1];
  const kreuzPx = fadenkreuzAktiv ? touchCursorPx : mausPx;
  const griffAmKreuz = touchCursorPx ? naheHandle(touchCursorPx) : undefined;

  return (
    <div className="mb-3">
      {fotoVerwalten && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            zurueckAufAnfang();
            try {
              onFoto(await dateiZuFoto(file));
            } catch (fehler) {
              setMarkierungsFehler(
                fehler instanceof Error ? fehler.message : 'Das Foto konnte nicht geladen werden.',
              );
            }
          }}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {fotoVerwalten && (
          <button type="button" className={knopfKlasse} onClick={() => inputRef.current?.click()}>
            <IconFoto />
            {foto ? 'Anderes Foto' : 'Drohnenfoto als Hintergrund'}
          </button>
        )}
        {foto && (
          <>
            {flaeche.markierungFertig && (
              <button
                type="button"
                className={knopfKlasse}
                title="Zurück aufs leere Foto, um Hindernisse zu setzen oder den Umriss zu ändern"
                onClick={() => {
                  setPunkte([]);
                  setModus('hindernis');
                  onPatch({ markierungFertig: false });
                }}
              >
                ✎ Markierung ändern
              </button>
            )}
            {modus === 'perspektive' && punkte.length === 4 && (
              <button
                type="button"
                className={knopfKlasse}
                title={`Nur den noch nicht gespeicherten Entwurf drehen: andere Kante als ${kantenName} verwenden`}
                onClick={() => setPunkte(traufeWechseln(punkte as Ecken))}
              >
                ↻ {kantenName} wechseln
              </button>
            )}
            {modus === 'perspektive' && foto.eckenPx && (
              <button
                type="button"
                className={knopfKlasse}
                title="Alle 4 Ecken verwerfen und neu anklicken"
                onClick={() => {
                  setPunkte([]);
                  setMarkierungsFehler(null);
                }}
              >
                Ecken neu
              </button>
            )}
            {foto.pxProM !== undefined && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => {
                  const { pxProM: _weg, ...rest } = foto;
                  setPunkte([]);
                  onFoto(rest);
                }}
              >
                {istSchraegdach ? 'Ziegel-Maßstab' : 'Foto-Maßstab'} löschen ({fmtDe(foto.pxProM, 1)} px/m)
              </button>
            )}
            {check?.vorschlag && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => onPatch({
                  breiteM: check.vorschlag!.breiteM,
                  hoeheM: check.vorschlag!.hoeheM,
                })}
              >
                Maße aus Foto übernehmen ({fmtDe(check.vorschlag.breiteM, 1)} ×{' '}
                {fmtDe(check.vorschlag.hoeheM, 1)} m)
              </button>
            )}
            {fotoVerwalten && (
              <button
                type="button"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-500 hover:border-red-300"
                onClick={() => {
                  zurueckAufAnfang();
                  onFoto(undefined);
                }}
              >
                Foto entfernen
              </button>
            )}
          </>
        )}
      </div>

      {check && (
        <div
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${
            check.status === 'ok'
              ? 'bg-emerald-50 text-emerald-800'
              : check.status === 'warnung'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-700'
          }`}
        >
          <strong>Belegungs-Check:</strong>{' '}
          {check.meldungen.map((m, i) => (
            <span key={i}>{m} </span>
          ))}
        </div>
      )}

      {perspektivCheck?.status === 'warnung' && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Starke Perspektive:</strong> {perspektivCheck.meldungen.join(' ')}
        </div>
      )}

      {(perspektivCheck?.status === 'fehler' || vorschauCheck?.status === 'fehler' || umrissVorschauFehler || markierungsFehler) && (
        <div className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          <strong>Markierung prüfen:</strong>{' '}
          {markierungsFehler ?? umrissVorschauFehler ?? vorschauCheck?.meldungen.join(' ') ?? perspektivCheck?.meldungen.join(' ')}
        </div>
      )}

      {foto && inMarkierung && (
        <div className="mt-3">
          <div
            role="toolbar"
            aria-label="Werkzeuge für die Foto-Markierung"
            className="-mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm"
          >
            {touchGeraet && (
              <button
                type="button"
                aria-pressed={fadenkreuzAktiv}
                className={
                  fadenkreuzAktiv
                    ? 'touch-target rounded-lg border border-sky-700 bg-sky-700 px-3 text-sm font-semibold text-white'
                    : 'touch-target rounded-lg border border-sky-300 bg-sky-50 px-3 text-sm font-semibold text-sky-800'
                }
                onClick={() => {
                  if (fadenkreuzAktiv) {
                    setFadenkreuzAktiv(false);
                    setTouchGriff(null);
                    touchSwipeRef.current = null;
                  } else {
                    starteFadenkreuz();
                  }
                }}
              >
                {fadenkreuzAktiv ? 'Fadenkreuz beenden' : 'Fadenkreuz bedienen'}
              </button>
            )}
            {/* Schrittanzeige ①–④: immer sichtbar, ✓ = erledigt, grau = noch gesperrt */}
            <SchrittChip
              nr="①"
              label="Ausrichtung"
              aktiv={modus === 'first'}
              erledigt={!!firstLinie || !!foto.eckenPx}
              onClick={() => wechsleModus('first')}
            />
            <SchrittChip
              nr="②"
              label="Perspektivrahmen"
              aktiv={modus === 'perspektive'}
              erledigt={!!foto.eckenPx}
              titel="Vier Ecken legen fest, wie die Dachfläche im Foto liegt"
              onClick={() => wechsleModus('perspektive')}
            />
            <SchrittChip
              nr="③"
              label="Dachumriss"
              aktiv={modus === 'umriss'}
              erledigt={!!flaeche.umrissM || (parametrisch && !!foto.eckenPx)}
              gesperrt={!foto.eckenPx}
              titel={
                !foto.eckenPx
                  ? 'Erst die 4 Ecken setzen'
                  : parametrisch
                    ? 'Form (Trapez/Parallelogramm) kommt automatisch — Umriss nur für Sonderformen'
                    : 'Nur nötig, wenn das Dach kein Rechteck ist'
              }
              onClick={() => wechsleModus('umriss')}
            />
            <SchrittChip
              nr="④"
              label="Hindernisse"
              aktiv={modus === 'hindernis'}
              erledigt={(flaeche.hindernisse ?? []).length > 0}
              gesperrt={!foto.eckenPx}
              titel={!foto.eckenPx ? 'Erst die 4 Ecken setzen' : 'Kamin/Fenster/SAT einrahmen'}
              onClick={() => wechsleModus('hindernis')}
            />
            {modus === 'first' && (
              <button type="button" className={knopfKlasse} onClick={() => wechsleModus('perspektive')}>
                ➡ Überspringen ({kantenName} ist unten)
              </button>
            )}
            {istSchraegdach && (
              <button type="button" className={modusKnopfKlasse(modus === 'ziegel')} onClick={() => wechsleModus('ziegel')}>
                Ziegel zählen (Maßstab)
              </button>
            )}

            {(modus === 'perspektive' || modus === 'first') && (
              <button
                type="button"
                disabled={punkte.length === 0}
                className={`${knopfKlasse} disabled:opacity-40`}
                onClick={() => setPunkte(punkte.slice(0, -1))}
              >
                ↶ Punkt zurück
              </button>
            )}
            {modus === 'perspektive' && punkte.length === 4 && (
              <button
                type="button"
                disabled={vorschauCheck?.status === 'fehler'}
                className="touch-target h-9 rounded-lg bg-akzent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => perspektiveAbschliessen(punkte)}
              >
                4 Ecken übernehmen
              </button>
            )}
            {modus === 'umriss' && (
              <>
                <button
                  type="button"
                  disabled={punkte.length < 3 || !!umrissVorschauFehler}
                  className="h-9 rounded-lg bg-akzent px-3 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={() => umrissAbschliessen(punkte)}
                >
                  {flaeche.umrissM ? '✓ Umriss übernehmen' : '✓ Umriss fertig'} ({punkte.length} Ecken)
                </button>
                <button
                  type="button"
                  disabled={punkte.length === 0}
                  className={`${knopfKlasse} disabled:opacity-40`}
                  onClick={() => setPunkte(punkte.slice(0, -1))}
                >
                  ↶ Punkt zurück
                </button>
                {flaeche.umrissM && (
                  <button
                    type="button"
                    className="touch-target h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                    onClick={umrissEntfernen}
                  >
                    Manuellen Umriss entfernen
                  </button>
                )}
                {foto.eckenPx && (
                  <button type="button" className={knopfKlasse} onClick={() => wechsleModus('perspektive')}>
                    Perspektivrahmen bearbeiten
                  </button>
                )}
              </>
            )}
            {modus === 'ziegel' && istSchraegdach && (
              <>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={100}
                    value={anzahlZiegel}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n >= 1) setAnzahlZiegel(n);
                    }}
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                  />
                  Ziegel à
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={80}
                    value={deckCm}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n > 0) setDeckbreiteCm(n);
                    }}
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                  />
                  cm Deckbreite
                </label>
              </>
            )}
            {foto.eckenPx &&
              foto.perspektiveBestaetigt !== false &&
              perspektivCheck?.status !== 'fehler' && (
              <button
                type="button"
                className="ml-auto h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => {
                  setPunkte([]);
                  onPatch({ markierungFertig: true });
                }}
              >
                ✓ {flaechenName} belegen →
              </button>
            )}
          </div>

          {fadenkreuzAktiv && touchCursorPx && (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <span className="min-w-52 flex-1">
                Auf dem Foto wischen verschiebt nur das Fadenkreuz.
                {touchGriff
                  ? ' Die gewählte Ecke wird erst beim Ablegen gespeichert.'
                  : griffAmKreuz
                    ? ' Das Fadenkreuz liegt auf einem verschiebbaren Punkt.'
                    : ' Mit „Punkt setzen“ wird ein Mausklick an dieser Stelle ausgeführt.'}
              </span>
              <button
                type="button"
                className="touch-target rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white active:bg-sky-800"
                onClick={fadenkreuzAktion}
              >
                {touchGriff ? 'Ecke hier ablegen' : griffAmKreuz ? 'Ecke greifen' : 'Punkt setzen'}
              </button>
              {touchGriff && (
                <button
                  type="button"
                  className={knopfKlasse}
                  onClick={() => setTouchGriff(null)}
                >
                  Greifen abbrechen
                </button>
              )}
            </div>
          )}

          {modus === 'first' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {istSchraegdach ? (
                <>
                  <strong>Trauflinie (2 Klicks entlang der Traufe/Dachrinne):</strong> die{' '}
                  <strong>unterste waagerechte Dachkante</strong> anklicken. Damit weiß das Programm,
                  wo unten ist — die 4 Ecken danach sind in <strong>beliebiger Reihenfolge</strong>{' '}
                  klickbar. Traufe bereits unten im Bild? <strong>„Überspringen“</strong> genügt.
                </>
              ) : (
                <>
                  <strong>{kantenName} festlegen:</strong> mit 2 Klicks eine gut erkennbare Kante
                  markieren. Sie bestimmt nur, wie die Fläche im Foto gedreht ist. Liegt diese Kante
                  bereits unten im Bild? <strong>„Überspringen“</strong> genügt.
                </>
              )}
            </p>
          ) : modus === 'perspektive' ? (
            parametrisch ? (
              <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <strong>
                  Perspektive – 4 Ecken ({flaeche.dachform === 'schief' ? 'Parallelogramm/schief' : 'Trapez/Walm'}):
                </strong>{' '}
                die 4 <strong>echten Dach-Ecken</strong> anklicken — 2 an der Traufe, 2 am First
                oben. <strong>Keine Ecken in die Luft verlängern!</strong> Das Tool kennt die Form
                (Firstbreite {fmtDe(firstBreiteEff ?? B, 1)} m
                {flaeche.dachform === 'schief' && flaeche.firstVersatzM
                  ? `, Versatz ${fmtDe(flaeche.firstVersatzM, 1)} m`
                  : ''}
                ) aus Schritt 2 und rechnet sie automatisch — kein Umriss nötig. Reihenfolge egal.{' '}
                <strong>Ecke nicht genau getroffen? Einfach mit der Maus draufziehen.</strong>
              </p>
            ) : (
              <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                {istSchraegdach ? (
                  <>
                    <strong>Perspektive – 4 Ecken:</strong> die 4 Ecken des
                    Dach-<strong>Rechtecks</strong> anklicken (Traufe + First),{' '}
                    <strong>Reihenfolge egal</strong>. Liegt eine Ecke in der Luft, am{' '}
                    <strong>Fadenkreuz</strong> ausrichten. Sitzt die Belegung verdreht:{' '}
                    <strong>↻ Traufe wechseln</strong>.
                  </>
                ) : (
                  <>
                    <strong>Perspektive – 4 Ecken:</strong> die vier äußeren Ecken der{' '}
                    {istFlachdach ? 'Flachdachfläche' : 'Fassade'} anklicken,{' '}
                    <strong>Reihenfolge egal</strong>. Das Fadenkreuz hilft bei verdeckten oder
                    schwer sichtbaren Ecken. Sitzt die Belegung verdreht:{' '}
                    <strong>↻ {kantenName} wechseln</strong>.
                  </>
                )}
              </p>
            )
          ) : modus === 'umriss' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {flaeche.umrissM ? (
                <>
                  <strong>Dachumriss bearbeiten:</strong> Die nummerierten orangefarbenen Ecken
                  direkt ziehen oder per Fadenkreuz versetzen. Danach „Umriss übernehmen" drücken.
                </>
              ) : (
                <>
                  <strong>Kein manueller Dachumriss vorhanden.</strong> Die orange gestrichelte
                  Außenlinie ist der <strong>Perspektivrahmen</strong> aus vier Ecken. Für ein
                  Rechteck einfach „{flaechenName} belegen" drücken. Nur bei Sonderformen hier den
                  echten Rand Ecke für Ecke anklicken.
                </>
              )}{' '}
              <em>Der Perspektivrahmen legt die Lage im Foto fest; der optionale Dachumriss legt die Form fest.</em>
            </p>
          ) : modus === 'hindernis' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Hindernis markieren:</strong>{' '}
              {istSchraegdach ? 'Kamin, Dachfenster oder SAT' : istFlachdach ? 'Lichtkuppel, Lüfter oder Technik' : 'Fenster, Türen oder Anbauten'} mit{' '}
              <strong>2 Klicks</strong> einrahmen — solange die Fläche noch leer ist. Diese Bereiche
              bleiben frei. Mehrere möglich.
            </p>
          ) : (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Ziegel zählen:</strong> Anfang und Ende über {anzahlZiegel} Ziegelbreiten{' '}
              <strong>entlang einer Reihe</strong> anklicken (quer zur Falllinie). Beton: 30 cm ist
              Standard; Ton je Modell 18–30 cm.
            </p>
          )}

          <div
            className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
            style={{
              aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`,
              maxHeight: 480,
              maxWidth: (480 * foto.breitePx) / foto.hoehePx,
            }}
          >
            <svg
              viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
              tabIndex={0}
              role="img"
              aria-label={`${flaechenName} im Foto markieren. Pfeiltasten bewegen das Fadenkreuz, Enter setzt einen Punkt, Escape bricht die laufende Markierung ab.`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
              className={`block h-full w-full focus:outline-none focus:ring-4 focus:ring-akzent/40 ${greift ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ touchAction: fadenkreuzAktiv ? 'none' : undefined }}
              onFocus={(e) => {
                // Ein Mausklick fokussiert das SVG ebenfalls. Nur echter
                // Tastaturfokus darf deshalb in den Fadenkreuzmodus wechseln.
                if (!e.currentTarget.matches(':focus-visible')) return;
                if (!touchCursorPx) {
                  setTouchCursorPx([foto.breitePx / 2, foto.hoehePx / 2]);
                }
                setFadenkreuzAktiv(true);
              }}
              onKeyDown={(e) => {
                const richtung: Record<string, Punkt> = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                const v = richtung[e.key];
                if (v) {
                  e.preventDefault();
                  const step = Math.max(1, foto.breitePx / 200);
                  setTouchCursorPx((aktuell) => {
                    const [x, y] = aktuell ?? [foto.breitePx / 2, foto.hoehePx / 2];
                    return [
                      Math.max(0, Math.min(foto.breitePx, x + v[0] * step)),
                      Math.max(0, Math.min(foto.hoehePx, y + v[1] * step)),
                    ];
                  });
                  setFadenkreuzAktiv(true);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  fadenkreuzAktion();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setPunkte([]);
                  setTouchGriff(null);
                  setFadenkreuzAktiv(false);
                  setMarkierungsFehler(null);
                }
              }}
              onClick={klick}
              onMouseDown={(e) => {
                if (fadenkreuzAktiv) return;
                const k = svgKoord(e);
                const h = k ? naheHandle(k) : undefined;
                aufHandle.current = !!h;
                if (h) {
                  ziehtRef.current = h.z;
                  setGreift(true);
                  e.preventDefault();
                }
              }}
              onMouseMove={(e) => {
                if (fadenkreuzAktiv) return;
                const k = svgKoord(e);
                setMausPx(k);
                if (ziehtRef.current && k) setzeHandle(ziehtRef.current, k);
              }}
              onMouseUp={() => {
                if (fadenkreuzAktiv) return;
                ziehtRef.current = null;
                setGreift(false);
              }}
              onMouseLeave={() => {
                if (fadenkreuzAktiv) return;
                setMausPx(null);
                ziehtRef.current = null;
                setGreift(false);
              }}
              onPointerDown={(e) => {
                if (!fadenkreuzAktiv || e.pointerType === 'mouse') return;
                e.preventDefault();
                touchSwipeRef.current = {
                  pointerId: e.pointerId,
                  clientX: e.clientX,
                  clientY: e.clientY,
                };
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Window-/Browser-Geste darf den Fadenkreuzzustand nicht zerstören.
                }
              }}
              onPointerMove={(e) => {
                const swipe = touchSwipeRef.current;
                if (
                  !fadenkreuzAktiv ||
                  !swipe ||
                  swipe.pointerId !== e.pointerId
                ) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                const dx = ((e.clientX - swipe.clientX) / rect.width) * foto.breitePx;
                const dy = ((e.clientY - swipe.clientY) / rect.height) * foto.hoehePx;
                setTouchCursorPx((aktuell) =>
                  aktuell
                    ? verschiebeFotoPunkt(
                        aktuell,
                        dx,
                        dy,
                        foto.breitePx,
                        foto.hoehePx,
                      )
                    : aktuell,
                );
                touchSwipeRef.current = {
                  pointerId: e.pointerId,
                  clientX: e.clientX,
                  clientY: e.clientY,
                };
              }}
              onPointerUp={(e) => {
                if (touchSwipeRef.current?.pointerId === e.pointerId) touchSwipeRef.current = null;
              }}
              onPointerCancel={(e) => {
                if (touchSwipeRef.current?.pointerId === e.pointerId) touchSwipeRef.current = null;
              }}
            >
              <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />

              {/* Firstlinie (Achs-Referenz) — bleibt als Guide sichtbar */}
              {firstLinie && (
                <g>
                  <line
                    x1={firstLinie[0][0]}
                    y1={firstLinie[0][1]}
                    x2={firstLinie[1][0]}
                    y2={firstLinie[1][1]}
                    stroke="#0d9488"
                    strokeWidth={px(0.003)}
                    strokeLinecap="round"
                  />
                  {firstLinie.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r={px(0.008)} fill="#0d9488" stroke="#fff" strokeWidth={px(0.002)} />
                  ))}
                </g>
              )}

              {/* Bereits gesetzter Umriss / Perspektiv-Rechteck */}
              {foto.eckenPx && !(modus === 'umriss' && punkte.length >= 3) && (
                <polygon
                  points={(flaeche.umrissM && hom
                    ? flaeche.umrissM.map((p) => projiziere(hom, [p[0], p[1]]))
                    : foto.eckenPx
                  )
                    .map(([qx, qy]) => `${qx.toFixed(1)},${qy.toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={px(0.002)}
                  strokeDasharray={`${px(0.01)} ${px(0.006)}`}
                />
              )}

              {/* Sortierte Vorschau: Rohpunkte bleiben separat sichtbar und werden
                  erst über den ausdrücklichen Übernehmen-Knopf gespeichert. */}
              {perspektivVorschau && (
                <polygon
                  points={perspektivVorschau.map(([qx, qy]) => `${qx},${qy}`).join(' ')}
                  fill="rgba(2,132,199,0.08)"
                  stroke={vorschauCheck?.status === 'fehler' ? '#dc2626' : '#0284c7'}
                  strokeWidth={px(0.003)}
                  strokeDasharray={`${px(0.01)} ${px(0.005)}`}
                />
              )}

              {/* Ziehbare Ecken-Griffe: nur im Perspektive-Modus, zum exakten Nachjustieren */}
              {modus === 'perspektive' &&
                (punkte.length === 4 ? punkte : foto.eckenPx)?.map((p, i) => (
                  <g key={i} style={{ cursor: 'grab' }}>
                    <circle cx={p[0]} cy={p[1]} r={px(0.018)} fill="rgba(249,115,22,0.18)" />
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={px(0.01)}
                      fill="#f97316"
                      stroke="#ffffff"
                      strokeWidth={px(0.0028)}
                    />
                  </g>
                ))}

              {/* Bereits markierte Hindernisse */}
              {hom &&
                (flaeche.hindernisse ?? []).map((r, i) => (
                  <polygon
                    key={i}
                    points={[
                      [r.xM, r.yM],
                      [r.xM + r.breiteM, r.yM],
                      [r.xM + r.breiteM, r.yM + r.hoeheM],
                      [r.xM, r.yM + r.hoeheM],
                    ]
                      .map((p) => projiziere(hom, p as Punkt))
                      .map(([qx, qy]) => `${qx.toFixed(1)},${qy.toFixed(1)}`)
                      .join(' ')}
                    fill="rgba(239,68,68,0.4)"
                    stroke="#ef4444"
                    strokeWidth={px(0.002)}
                  />
                ))}

              {/* Fadenkreuz am Mauszeiger — kräftig, mit weißem Halo + Zielring (auf
                  jedem Fotohintergrund gut sichtbar) */}
              {zeigtKreuz && kreuzPx && (
                <g style={{ pointerEvents: 'none' }}>
                  <g stroke="#ffffff" strokeOpacity={0.85} strokeWidth={px(0.0045)} fill="none">
                    <line x1={0} y1={kreuzPx[1]} x2={foto.breitePx} y2={kreuzPx[1]} />
                    <line x1={kreuzPx[0]} y1={0} x2={kreuzPx[0]} y2={foto.hoehePx} />
                    <circle cx={kreuzPx[0]} cy={kreuzPx[1]} r={px(0.013)} />
                  </g>
                  <g stroke="#0284c7" strokeOpacity={0.95} strokeWidth={px(0.002)} fill="none">
                    <line x1={0} y1={kreuzPx[1]} x2={foto.breitePx} y2={kreuzPx[1]} />
                    <line x1={kreuzPx[0]} y1={0} x2={kreuzPx[0]} y2={foto.hoehePx} />
                    <circle cx={kreuzPx[0]} cy={kreuzPx[1]} r={px(0.013)} />
                  </g>
                </g>
              )}

              {/* Vorschaulinie: letzter Punkt → Mauszeiger */}
              {(modus === 'first' || modus === 'perspektive' || modus === 'umriss') && letzter && kreuzPx && (
                <line
                  x1={letzter[0]}
                  y1={letzter[1]}
                  x2={kreuzPx[0]}
                  y2={kreuzPx[1]}
                  stroke="#f97316"
                  strokeOpacity={0.7}
                  strokeWidth={px(0.0022)}
                  strokeDasharray={`${px(0.008)} ${px(0.005)}`}
                />
              )}

              {/* Bisher gesetzte Punkte + Verbindung */}
              {punkte.length >= 2 && (
                <polyline
                  points={punkte.map(([qx, qy]) => `${qx},${qy}`).join(' ')}
                  fill="none"
                  stroke={umrissVorschauFehler ? '#dc2626' : '#f97316'}
                  strokeWidth={px(0.0025)}
                  strokeDasharray={`${px(0.008)} ${px(0.005)}`}
                />
              )}
              {modus === 'umriss' && punkte.length >= 3 && (
                <line
                  x1={punkte[punkte.length - 1]![0]}
                  y1={punkte[punkte.length - 1]![1]}
                  x2={punkte[0]![0]}
                  y2={punkte[0]![1]}
                  stroke={umrissVorschauFehler ? '#dc2626' : '#f97316'}
                  strokeOpacity={0.4}
                  strokeWidth={px(0.0016)}
                  strokeDasharray={`${px(0.004)} ${px(0.004)}`}
                />
              )}
              {punkte.map(([qx, qy], i) => (
                <g
                  key={i}
                  data-testid={modus === 'umriss' ? 'umriss-griff' : undefined}
                  style={{ cursor: modus === 'umriss' || modus === 'perspektive' || modus === 'first' ? 'grab' : undefined }}
                >
                  {modus === 'umriss' && (
                    <circle cx={qx} cy={qy} r={px(0.018)} fill="rgba(249,115,22,0.18)" />
                  )}
                  <circle
                    cx={qx}
                    cy={qy}
                    r={px(i === 0 && modus === 'umriss' && punkte.length >= 3 ? 0.011 : 0.007)}
                    fill={umrissVorschauFehler ? '#dc2626' : modus === 'first' ? '#0d9488' : modus === 'ziegel' ? '#0ea5e9' : modus === 'hindernis' ? '#ef4444' : i === 0 && modus === 'umriss' ? '#ea580c' : '#f97316'}
                    stroke="#ffffff"
                    strokeWidth={px(0.002)}
                  />
                  {modus === 'umriss' && (
                    <text
                      x={qx}
                      y={qy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={px(0.009)}
                      fontWeight={700}
                      style={{ pointerEvents: 'none' }}
                    >
                      {i + 1}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>

          {modus === 'hindernis' && (flaeche.hindernisse ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(flaeche.hindernisse ?? []).map((h, i) => (
                <button
                  key={i}
                  type="button"
                  title="Hindernis entfernen"
                  className="h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm font-medium text-red-700 hover:border-red-300"
                  onClick={() =>
                    onPatch({ hindernisse: (flaeche.hindernisse ?? []).filter((_, j) => j !== i), inaktiv: [] })
                  }
                >
                  {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m ✕
                </button>
              ))}
            </div>
          )}

          <p className="mt-1 text-xs text-slate-500">
            {modus === 'first'
              ? punkte.length === 0
                ? `Anfang der ${istSchraegdach ? 'First-/Trauflinie' : kantenName} anklicken.`
                : 'Ende der Linie anklicken.'
              : modus === 'perspektive'
              ? punkte.length < 4
                ? `Ecke ${punkte.length + 1} von 4 anklicken (${flaechenName}).`
                : 'Vorschau prüfen, einzelne Punkte bei Bedarf ziehen und dann „4 Ecken übernehmen".'
              : modus === 'umriss'
                ? flaeche.umrissM && punkte.length >= 3
                  ? umrissVorschauFehler
                    ? 'Der Entwurf ist ungültig. Rote Ecke nachziehen; Speichern bleibt gesperrt.'
                    : 'Nummerierte Ecke ziehen und anschließend „Umriss übernehmen" drücken.'
                  : punkte.length < 3
                  ? `Ecke ${punkte.length + 1} anklicken (mind. 3) — oder „${flaechenName} belegen“ für ein Rechteck.`
                  : 'Weitere Ecken — oder ersten Punkt / „Umriss fertig" zum Schließen.'
                : modus === 'hindernis'
                  ? punkte.length === 0
                    ? 'Erste Ecke des Hindernisses anklicken.'
                    : 'Gegenüberliegende Ecke anklicken.'
                  : punkte.length === 0
                    ? 'Anfang der Ziegel-Strecke anklicken.'
                    : `Ende der ${anzahlZiegel}-Ziegel-Strecke anklicken.`}
          </p>
        </div>
      )}
    </div>
  );
}
