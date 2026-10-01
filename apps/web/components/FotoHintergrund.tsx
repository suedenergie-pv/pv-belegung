'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
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
import { artVon, DACHFARBEN, fmtDe, massFreigabe, perspektiveQuelle, rahmenBreiteVon, type DachFoto, type Flaeche } from '../lib/model';
import { IconFoto } from './icons';
import { useEntwurfNavigation } from '../lib/entwurf-navigation';
import { useTouchBedienung } from '../lib/touch-bedienung';
import type { FotoPunktSteuerung } from './EditorViewport';

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

export type FotoArbeitsbereich = {
  bild: React.ReactNode;
  steuerung: React.ReactNode;
  hinweis: React.ReactNode;
  bildSeitenverhaeltnis: number;
  /** Bricht nur die laufende Zeigergeste ab; bestätigte Daten bleiben erhalten. */
  abbrechen: () => void;
  punktSteuerung?: FotoPunktSteuerung;
};

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
  onMassVorschlag,
  renderArbeitsbereich,
  kompakt = false,
  initialWerkzeug,
  cancelRevision,
  onMasseBearbeiten,
  fotoOverlay,
}: {
  flaeche: Flaeche;
  onPatch: (patch: Partial<Flaeche>) => void;
  /** false: Upload/Ersetzen/Löschen übernimmt die übergeordnete Foto-Gruppe. */
  fotoVerwalten?: boolean;
  /** Wechselt das übergeordnete Foto-Asset, werden alle flüchtigen Werkzeuge zurückgesetzt. */
  zustandsKey?: string;
  /** Neue Foto-Perspektiven dürfen den gemeinsamen metrischen Umriss nicht löschen. */
  geometrieBehalten?: boolean;
  /** Foto-Schätzung in den Maßentwurf übernehmen; verändert noch keine Belegung. */
  onMassVorschlag?: (masse: { breiteM: number; hoeheM: number }) => void;
  renderArbeitsbereich?: (bereich: FotoArbeitsbereich) => React.ReactNode;
  kompakt?: boolean;
  /** Direkteinstieg; der Aufrufer löst offene Entwürfe vor dem Wechsel auf. */
  initialWerkzeug?: 'umriss' | 'hindernis';
  cancelRevision?: number;
  onMasseBearbeiten?: () => void;
  /** Bereits belegte andere Ebenen desselben Fotos, im identischen Bildraum. */
  fotoOverlay?: (clipIdPrefix: string) => React.ReactNode;
}) {
  const overlayId = useId().replace(/:/g, '');
  const [fotoEntwurf, setFotoEntwurf] = useState<DachFoto | null>(null);
  const foto = fotoEntwurf ?? flaeche.foto;
  const navigation = useEntwurfNavigation();
  const massCheck = massFreigabe(flaeche);
  const flaechenArt = artVon(flaeche);
  const istSchraegdach = flaechenArt === 'dach';
  const istFlachdach = flaechenArt === 'flachdach';
  const kantenName = istSchraegdach ? 'Traufe' : istFlachdach ? 'Referenzkante' : 'Unterkante';
  const flaechenName = istSchraegdach ? 'Dach' : istFlachdach ? 'Flachdach' : 'Fassade';
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [eckenOrientiert, setEckenOrientiert] = useState(false);
  const [umrissBearbeiten, setUmrissBearbeiten] = useState(false);
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
  const [touchGeraet, aktiviereTouch, deaktiviereTouch] = useTouchBedienung();
  const [fadenkreuzAktiv, setFadenkreuzAktiv] = useState(false);
  const [touchCursorPx, setTouchCursorPx] = useState<Punkt | null>(null);
  const [touchGriff, setTouchGriff] = useState<Griff | null>(null);
  const [markierungsFehler, setMarkierungsFehler] = useState<string | null>(null);
  const [entwurfGeaendert, setEntwurfGeaendert] = useState(false);
  const gestenBasis = useRef<{ punkte: Punkt[]; firstLinie: [Punkt, Punkt] | null; geaendert: boolean } | null>(null);
  const gesteGesperrt = useRef(false);
  const touchSwipeRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const gesteAbbrechen = () => {
    if (gestenBasis.current) {
      setPunkte(gestenBasis.current.punkte);
      setFirstLinie(gestenBasis.current.firstLinie);
      setEntwurfGeaendert(gestenBasis.current.geaendert);
    }
    gestenBasis.current = null;
    ziehtRef.current = null;
    touchSwipeRef.current = null;
    aufHandle.current = true;
    gesteGesperrt.current = true;
    setGreift(false);
    setTouchGriff(null);
    setMausPx(null);
  };
  const gesteAbbrechenRef = useRef(gesteAbbrechen);
  gesteAbbrechenRef.current = gesteAbbrechen;
  const vorigeCancelRevision = useRef(cancelRevision);
  useEffect(() => {
    if (cancelRevision !== vorigeCancelRevision.current) gesteAbbrechenRef.current();
    vorigeCancelRevision.current = cancelRevision;
  }, [cancelRevision]);

  // Beim Ersetzen/Wechseln des Bild-Assets darf kein Entwurf oder Werkzeugmodus
  // des vorigen Fotos weiterlaufen. Bestehende Ecken führen direkt zu Hindernissen.
  useEffect(() => {
    setPunkte([]);
    setEckenOrientiert(false);
    setUmrissBearbeiten(false);
    setFirstLinie(null);
    setMausPx(null);
    setFadenkreuzAktiv(false);
    setTouchCursorPx(null);
    setTouchGriff(null);
    setMarkierungsFehler(null);
    setEntwurfGeaendert(false);
    gestenBasis.current = null;
    ziehtRef.current = null;
    setGreift(false);
    touchSwipeRef.current = null;
    wechsleModus(foto?.eckenPx ? initialWerkzeug ?? 'hindernis' : 'first');
  }, [foto?.dataUrl, zustandsKey, initialWerkzeug]);
  useEffect(() => { setFotoEntwurf(null); }, [zustandsKey, flaeche.foto?.dataUrl]);
  useEffect(() => {
    if (!touchGeraet || !renderArbeitsbereich || !foto) return;
    setFadenkreuzAktiv(true);
    setTouchCursorPx((punkt) => punkt ?? [foto.breitePx / 2, foto.hoehePx / 2]);
  }, [touchGeraet, foto?.dataUrl, zustandsKey]);

  const B = flaeche.breiteM; // Traufe (Referenzstrecke für den Maß-Check)
  const rahmenB = rahmenBreiteVon(flaeche); // Rahmen (Homographie/Umriss/Hindernis)
  const H = flaeche.hoeheM;
  const deckCm = deckbreiteCm ?? deckbreiteDefaultCm(flaeche);
  const onFoto = (f: DachFoto | undefined) => {
    if (fotoEntwurf && f) setFotoEntwurf(f);
    else onPatch({ foto: f });
  };

  const markiert = !!(foto && (foto.eckenPx || foto.traufePx));
  const inMarkierung = !!foto && (!!fotoEntwurf || !flaeche.markierungFertig);
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
    return eckenOrientiert ? vier : firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
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
    modus === 'first' || modus === 'perspektive' || modus === 'umriss' || modus === 'hindernis' || modus === 'ziegel';

  const wechsleModus = (m: Modus) => {
    setModus(m);
    setEckenOrientiert(m === 'perspektive' && !!foto?.eckenPx);
    setUmrissBearbeiten(m === 'umriss' && !!hom && !!flaeche.umrissM);
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
    setEntwurfGeaendert(false);
  };

  const perspektiveAbschliessen = (pts: Punkt[]) => {
    if (!foto || pts.length < 4) return;
    const vier: [Punkt, Punkt, Punkt, Punkt] = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
    // Firstlinie (falls gezogen) legt die Traufe-Achse fest; sonst alter Heuristik-Fallback
    const ecken = eckenOrientiert ? vier : firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
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
    setFotoEntwurf(null);
    setEntwurfGeaendert(false);
    setPunkte([]);
    setMarkierungsFehler(null);
    setModus(kompakt || geometrieBehalten ? 'hindernis' : 'umriss');
    setUmrissBearbeiten(false);
  };

  const umrissAbschliessen = (pts: Punkt[]) => {
    if (!foto?.eckenPx) return;
    const ergebnis = pruefeUmrissAusKlicks(pts, rahmenB, H, foto.eckenPx, quelle);
    if (!ergebnis.ok) {
      setMarkierungsFehler(ergebnis.grund);
      return;
    }
    onPatch({ umrissM: ergebnis.punkte, inaktiv: [] });
    setEntwurfGeaendert(false);
    setPunkte([]);
    setMarkierungsFehler(null);
    setModus('hindernis');
  };

  const umrissEntfernen = () => {
    if (!flaeche.umrissM) return;
    onPatch({ umrissM: undefined, inaktiv: [] });
    setPunkte([]);
    setUmrissBearbeiten(false);
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
   * Trauflinie. Umriss-Griffe sind erst beim Bearbeiten eines abgeschlossenen
   * Umrisses aktiv. Beim Neuzeichnen muss der Startpunkt den Umriss schließen.
   */
  const handles = (): { x: number; y: number; z: Griff }[] => {
    if (!foto) return [];
    const arr: { x: number; y: number; z: Griff }[] = [];
    if ((modus === 'perspektive' && punkte.length === 4) || (modus === 'umriss' && umrissBearbeiten)) {
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
    setEntwurfGeaendert(true);
    if (z.art === 'punkt') {
      setPunkte(punkte.map((p, i) => (i === z.i ? [k[0], k[1]] : p)));
    } else if (z.art === 'first' && firstLinie) {
      setFirstLinie(firstLinie.map((p, i) => (i === z.i ? [k[0], k[1]] : p)) as [Punkt, Punkt]);
    }
  };

  /** Eine Foto-Koordinate verarbeiten — gemeinsame Wahrheit für Maus und Tablet. */
  const verarbeitePunkt = (k: Punkt) => {
    if (!foto || (kompakt && !massCheck.belegen)) return;
    setEntwurfGeaendert(true);
    const [x, y] = k;

    if (modus === 'first') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      setFirstLinie([neu[0]!, neu[1]!]);
      setEckenOrientiert(false);
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
      setEntwurfGeaendert(false);
      setPunkte([]);
      return setModus(foto.eckenPx ? 'hindernis' : 'perspektive');
    }

    if (modus === 'hindernis') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) return setPunkte(neu);
      hindernisSetzen(neu[0]!, neu[1]!);
      setEntwurfGeaendert(false);
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
    if (fadenkreuzAktiv || gesteGesperrt.current) return;
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
    setEckenOrientiert(false);
    setFirstLinie(null);
    setModus('first');
    setEntwurfGeaendert(false);
  };

  const entwurfVerwerfen = () => {
    setFotoEntwurf(null);
    setPunkte([]);
    setFirstLinie(null);
    setTouchGriff(null);
    setMarkierungsFehler(null);
    setEntwurfGeaendert(false);
    setUmrissBearbeiten(false);
    setModus(flaeche.foto?.eckenPx ? 'hindernis' : 'first');
  };
  const entwurfGueltig = () => {
    if (modus === 'perspektive' && perspektivVorschau && vorschauCheck?.status !== 'fehler') return true;
    if (modus === 'umriss' && umrissVorschauPruefung?.ok) return true;
    setMarkierungsFehler('Bitte die Markierung abschließen oder den Entwurf verwerfen. Der bisherige Plan bleibt erhalten.');
    return false;
  };
  const entwurfCallbacks = useRef({
    gueltig: entwurfGueltig,
    uebernehmen: () => { if (modus === 'perspektive') perspektiveAbschliessen(punkte); else if (modus === 'umriss') umrissAbschliessen(punkte); },
    verwerfen: entwurfVerwerfen,
  });
  entwurfCallbacks.current = {
    gueltig: entwurfGueltig,
    uebernehmen: () => { if (modus === 'perspektive') perspektiveAbschliessen(punkte); else if (modus === 'umriss') umrissAbschliessen(punkte); },
    verwerfen: entwurfVerwerfen,
  };
  useEffect(() => {
    if (!entwurfGeaendert && !fotoEntwurf) return;
    return navigation.registriere(`foto-${flaeche.id}-${zustandsKey ?? ''}`, {
      name: `${flaeche.name} · Foto-Markierung`,
      gueltig: () => entwurfCallbacks.current.gueltig(),
      uebernehmen: () => entwurfCallbacks.current.uebernehmen(),
      verwerfen: () => entwurfCallbacks.current.verwerfen(),
    });
  }, [entwurfGeaendert, fotoEntwurf, flaeche.id, flaeche.name, zustandsKey, navigation]);

  const belegenFreigegeben = !!foto?.eckenPx && foto.perspektiveBestaetigt !== false && perspektivCheck?.status !== 'fehler' && massCheck.belegen;
  const belegen = () => {
    if (!belegenFreigegeben || entwurfGeaendert || fotoEntwurf) return;
    setPunkte([]);
    onPatch({ markierungFertig: true });
  };
  const werkzeugWaehlen = (m: Modus) => {
    if (entwurfGeaendert) navigation.weiter(() => wechsleModus(m));
    else wechsleModus(m);
  };
  const dateiLaden = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const neu = await dateiZuFoto(file);
      zurueckAufAnfang();
      // Ein Ersatzfoto bleibt lokal, bis seine neue Perspektive übernommen wird.
      if (flaeche.foto) setFotoEntwurf(neu);
      else onFoto(neu);
    } catch (fehler) {
      setMarkierungsFehler(fehler instanceof Error ? fehler.message : 'Das Foto konnte nicht geladen werden.');
    }
  };

  const px = (v: number) => (foto ? foto.breitePx * v : 0);
  const letzter = punkte[punkte.length - 1];
  const kreuzPx = fadenkreuzAktiv ? touchCursorPx : mausPx;
  const griffAmKreuz = touchCursorPx ? naheHandle(touchCursorPx) : undefined;

  const gesteBeginnen = () => {
    gesteGesperrt.current = false;
    gestenBasis.current = { punkte: punkte.map((p) => [...p] as Punkt), firstLinie: firstLinie ? firstLinie.map((p) => [...p] as Punkt) as [Punkt, Punkt] : null, geaendert: entwurfGeaendert };
  };

  const kompakteSteuerung = <div className="space-y-3 text-sm text-slate-700" data-foto-einrichtung>
    {fotoVerwalten && <div className="flex flex-wrap gap-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={dateiLaden} />
      <button type="button" className={knopfKlasse} onClick={() => inputRef.current?.click()}><IconFoto />{foto ? 'Anderes Foto' : 'Foto hinzufügen'}</button>
    </div>}
    {foto && <>
      <ol aria-label="Einrichtungsschritte" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
        <li>Foto ✓</li>
        <li aria-current={!massCheck.belegen ? 'step' : undefined}>Maße {massCheck.belegen ? '✓' : 'offen'}</li>
        <li aria-current={massCheck.belegen && modus === 'first' ? 'step' : undefined}>{kantenName}</li>
        <li aria-current={massCheck.belegen && modus === 'perspektive' ? 'step' : undefined}>Dachecken {foto.eckenPx && foto.perspektiveBestaetigt !== false ? '✓' : ''}</li>
        <li aria-current={modus === 'hindernis' ? 'step' : undefined}>Aussparungen</li>
        <li>Belegen</li>
      </ol>
      {!massCheck.belegen ? <div>
        <p className="mb-2">Dachform und wahre Maße bestätigen, dann die Lage im Foto festlegen.</p>
        {onMasseBearbeiten && <button type="button" className="min-h-11 rounded-lg bg-akzent px-4 font-semibold text-white" onClick={onMasseBearbeiten}>Maße & Dachform festlegen</button>}
      </div> : <>
        <div role="toolbar" aria-label="Werkzeuge für die Foto-Markierung" className="flex flex-wrap gap-2">
          <button type="button" className={modusKnopfKlasse(modus === 'first')} aria-pressed={modus === 'first'} onClick={() => werkzeugWaehlen('first')}>{kantenName}</button>
          <button type="button" className={modusKnopfKlasse(modus === 'perspektive')} aria-pressed={modus === 'perspektive'} onClick={() => werkzeugWaehlen('perspektive')}>Dachecken</button>
          <button type="button" className={modusKnopfKlasse(modus === 'hindernis')} aria-pressed={modus === 'hindernis'} disabled={!foto.eckenPx || !!fotoEntwurf} onClick={() => werkzeugWaehlen('hindernis')}>Aussparungen</button>
          <button type="button" className={modusKnopfKlasse(modus === 'umriss')} aria-pressed={modus === 'umriss'} disabled={!foto.eckenPx || !!fotoEntwurf} onClick={() => werkzeugWaehlen('umriss')}>Umriss</button>
        </div>
        <p className="text-sm text-slate-700">
          {modus === 'first' ? `Zwei Punkte entlang der ${kantenName} setzen. Die Linie bestimmt die Ausrichtung.`
            : modus === 'perspektive' ? parametrisch
              ? `Vier echte Dachecken markieren. Die ${flaeche.dachform === 'schief' ? 'schiefe Form' : 'Trapezform'} kommt aus deinen Maßen.`
              : 'Vier Ecken des Dachrechtecks markieren. Die Punkte lassen sich anschließend ziehen.'
            : modus === 'hindernis' ? 'Kamin, Fenster oder andere Aussparungen jeweils mit zwei gegenüberliegenden Ecken einrahmen.'
            : modus === 'umriss' ? 'Optionalen Dachumriss Ecke für Ecke zeichnen. Vorhandene Eckpunkte lassen sich ziehen.'
            : `Eine Reihe über ${anzahlZiegel} Ziegel mit bekannter Deckbreite markieren.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {modus === 'first' && <button type="button" className={knopfKlasse} onClick={() => { setPunkte([]); setEntwurfGeaendert(false); wechsleModus('perspektive'); }}>Überspringen ({kantenName} unten)</button>}
          {modus === 'perspektive' && <>
            {punkte.length === 4 && <button type="button" disabled={vorschauCheck?.status === 'fehler'} className="min-h-11 rounded-lg bg-akzent px-4 font-semibold text-white disabled:opacity-40" onClick={() => perspektiveAbschliessen(punkte)}>4 Ecken übernehmen</button>}
            {punkte.length === 4 && <button type="button" className={knopfKlasse} onClick={() => { setPunkte(traufeWechseln((perspektivVorschau ?? punkte) as Ecken)); setEckenOrientiert(true); setEntwurfGeaendert(true); }}>↻ {kantenName} wechseln</button>}
            {!!foto.eckenPx && <button type="button" className={knopfKlasse} onClick={() => { setPunkte([]); setEckenOrientiert(false); setEntwurfGeaendert(true); }}>Ecken neu</button>}
          </>}
          {modus === 'umriss' && <>
            <button type="button" disabled={punkte.length < 3 || !!umrissVorschauFehler} className="min-h-11 rounded-lg bg-akzent px-4 font-semibold text-white disabled:opacity-40" onClick={() => umrissAbschliessen(punkte)}>Umriss übernehmen</button>
            {!!flaeche.umrissM && <button type="button" className={knopfKlasse} onClick={umrissEntfernen}>Manuellen Umriss entfernen</button>}
          </>}
          {punkte.length > 0 && <button type="button" className={knopfKlasse} onClick={() => { setPunkte(punkte.slice(0, -1)); setEntwurfGeaendert(true); }}>Punkt zurück</button>}
          {(entwurfGeaendert || fotoEntwurf) && <button type="button" className={knopfKlasse} onClick={entwurfVerwerfen}>Entwurf verwerfen</button>}
          {modus === 'hindernis' && !entwurfGeaendert && <button type="button" disabled={!belegenFreigegeben || !!fotoEntwurf} className="min-h-11 rounded-lg bg-akzent px-4 font-semibold text-white disabled:bg-slate-200 disabled:text-slate-600" onClick={belegen}>{(flaeche.hindernisse ?? []).length ? 'Aussparungen fertig · Belegen' : 'Aussparungen überspringen · Belegen'}</button>}
        </div>
        {modus === 'hindernis' && (flaeche.hindernisse ?? []).length > 0 && <ul className="space-y-1">
          {flaeche.hindernisse!.map((h, i) => <li key={i} className="flex items-center justify-between gap-3"><span>Aussparung {i + 1} · {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m</span><button type="button" className="min-h-11 px-3 text-red-700" aria-label={`Aussparung ${i + 1} entfernen`} onClick={() => onPatch({ hindernisse: flaeche.hindernisse!.filter((_, j) => j !== i), inaktiv: [] })}>Entfernen</button></li>)}
        </ul>}
        {touchGeraet && !renderArbeitsbereich && <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={fadenkreuzAktiv} className={knopfKlasse} onClick={() => { if (fadenkreuzAktiv) { setFadenkreuzAktiv(false); setTouchGriff(null); } else starteFadenkreuz(); }}>{fadenkreuzAktiv ? 'Fadenkreuz beenden' : 'Fadenkreuz bedienen'}</button>
          {fadenkreuzAktiv && <button type="button" className={knopfKlasse} onClick={fadenkreuzAktion}>{touchGriff ? 'Ecke hier ablegen' : griffAmKreuz ? 'Ecke greifen' : 'Punkt setzen'}</button>}
        </div>}
        <details className="border-t border-slate-200 pt-2"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Weitere Markierungen</summary><div className="flex flex-wrap gap-2">
          {istSchraegdach && <button type="button" className={knopfKlasse} onClick={() => werkzeugWaehlen('ziegel')}>Ziegel zählen (Maßstab)</button>}
        </div></details>
        {modus === 'ziegel' && <div className="flex flex-wrap gap-2">
          <label>Ziegelanzahl<input type="number" min={2} max={100} value={anzahlZiegel} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 2) setAnzahlZiegel(n); }} className="block min-h-11 w-24 rounded-lg border border-slate-300 px-2" /></label>
          <label>Deckbreite (cm)<input type="number" min={10} max={80} value={deckCm} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) setDeckbreiteCm(n); }} className="block min-h-11 w-24 rounded-lg border border-slate-300 px-2" /></label>
        </div>}
      </>}
      <details className="border-t border-slate-200 pt-2"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Maße und Foto prüfen</summary>
        <dl className="space-y-2 pb-2"><div><dt className="font-semibold">Maße</dt><dd>{massCheck.status === 'bestaetigt' ? 'Von dir bestätigt.' : massCheck.status === 'bestand' ? 'Aus bestehender Belegung übernommen.' : 'Noch nicht bestätigt.'}</dd></div>
          <div><dt className="font-semibold">Perspektive</dt><dd>{!foto.eckenPx || foto.perspektiveBestaetigt === false ? 'Dachecken noch nicht bestätigt.' : perspektivCheck?.status === 'fehler' ? perspektivCheck.meldungen.join(' ') : perspektivCheck?.status === 'warnung' ? perspektivCheck.meldungen.join(' ') : 'Dachecken bestätigt.'}</dd></div>
          <div><dt className="font-semibold">Foto-Plausibilität</dt><dd>{!check || check.status === 'ungeprueft' ? 'Nicht geprüft. Ein unabhängiger Foto-Maßstab fehlt.' : check.meldungen.join(' ')}</dd></div>
        </dl>
        {check?.vorschlag && onMassVorschlag && <button type="button" className={knopfKlasse} onClick={() => onMassVorschlag({ breiteM: check.vorschlag!.breiteM, hoeheM: check.vorschlag!.hoeheM })}>Maße aus Foto prüfen ({fmtDe(check.vorschlag.breiteM, 1)} × {fmtDe(check.vorschlag.hoeheM, 1)} m)</button>}
      </details>
    </>}
    {(markierungsFehler || umrissVorschauFehler || vorschauCheck?.status === 'fehler') && <p role="alert" className="text-sm text-red-700">{markierungsFehler ?? umrissVorschauFehler ?? vorschauCheck?.meldungen.join(' ')}</p>}
  </div>;

  const bild = foto && (inMarkierung || renderArbeitsbereich) ? (
            <svg
              viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
              tabIndex={0}
              role="img"
              aria-label={`${flaechenName} im Foto markieren. Pfeiltasten bewegen das Fadenkreuz, Enter setzt einen Punkt, Escape bricht die laufende Markierung ab.`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
              className={`block h-full w-full focus:outline-none focus:ring-4 focus:ring-akzent/40 ${greift ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ touchAction: 'none' }}
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
                  entwurfVerwerfen();
                  setFadenkreuzAktiv(touchGeraet && !!renderArbeitsbereich);
                }
              }}
              onClick={klick}
              onMouseDown={(e) => {
                if (fadenkreuzAktiv) return;
                gesteBeginnen();
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
                if (fadenkreuzAktiv || gesteGesperrt.current) return;
                const k = svgKoord(e);
                setMausPx(k);
                if (ziehtRef.current && k) setzeHandle(ziehtRef.current, k);
              }}
              onMouseUp={() => {
                if (fadenkreuzAktiv) return;
                ziehtRef.current = null;
                gestenBasis.current = null;
                setGreift(false);
              }}
              onMouseLeave={() => {
                if (fadenkreuzAktiv) return;
                setMausPx(null);
                ziehtRef.current = null;
                setGreift(false);
              }}
              onPointerDown={(e) => {
                gesteBeginnen();
                if (e.pointerType === 'mouse') return;
                if (!fadenkreuzAktiv) {
                  const k = svgKoord(e);
                  const h = k ? naheHandle(k) : undefined;
                  aufHandle.current = !!h;
                  if (h) { ziehtRef.current = h.z; setGreift(true); }
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Synthetischer Pointer. */ }
                  return;
                }
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
                if (gesteGesperrt.current) return;
                if (!fadenkreuzAktiv && e.pointerType !== 'mouse') {
                  const k = svgKoord(e);
                  setMausPx(k);
                  if (ziehtRef.current && k) setzeHandle(ziehtRef.current, k);
                  return;
                }
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
                ziehtRef.current = null;
                gestenBasis.current = null;
                setGreift(false);
              }}
              onPointerCancel={gesteAbbrechen}
            >
              <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
              {fotoOverlay && !fotoEntwurf && <g pointerEvents="none">{fotoOverlay(`fotoeinrichtung-${overlayId}`)}</g>}

              {/* Firstlinie (Achs-Referenz) — bleibt als Guide sichtbar */}
              {firstLinie && (
                <g>
                  <line
                    x1={firstLinie[0][0]}
                    y1={firstLinie[0][1]}
                    x2={firstLinie[1][0]}
                    y2={firstLinie[1][1]}
                    stroke="#0d9488"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                  {firstLinie.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r={px(0.0025)} fill="#0d9488" stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
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

              {/* Feines Fadenkreuz: Strichbreite bleibt auch bei großen Fotos konstant. */}
              {zeigtKreuz && kreuzPx && !(renderArbeitsbereich && fadenkreuzAktiv) && (
                <g data-testid="foto-fadenkreuz" data-x={kreuzPx[0]} data-y={kreuzPx[1]} style={{ pointerEvents: 'none' }}>
                  <g stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2.5} fill="none">
                    <line vectorEffect="non-scaling-stroke" x1={0} y1={kreuzPx[1]} x2={foto.breitePx} y2={kreuzPx[1]} />
                    <line vectorEffect="non-scaling-stroke" x1={kreuzPx[0]} y1={0} x2={kreuzPx[0]} y2={foto.hoehePx} />
                    <circle vectorEffect="non-scaling-stroke" cx={kreuzPx[0]} cy={kreuzPx[1]} r={px(0.006)} />
                  </g>
                  <g stroke="#0284c7" strokeOpacity={0.95} strokeWidth={1} fill="none">
                    <line vectorEffect="non-scaling-stroke" x1={0} y1={kreuzPx[1]} x2={foto.breitePx} y2={kreuzPx[1]} />
                    <line vectorEffect="non-scaling-stroke" x1={kreuzPx[0]} y1={0} x2={kreuzPx[0]} y2={foto.hoehePx} />
                    <circle vectorEffect="non-scaling-stroke" cx={kreuzPx[0]} cy={kreuzPx[1]} r={px(0.006)} />
                  </g>
                </g>
              )}

              {/* Vorschaulinie: letzter Punkt → Mauszeiger */}
              {(modus === 'first' || (modus === 'perspektive' && punkte.length < 4) || (modus === 'umriss' && !umrissBearbeiten)) && letzter && kreuzPx && (
                <line
                  data-testid="naechste-kante-vorschau"
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
                  style={{ cursor: (modus === 'umriss' && umrissBearbeiten) || (modus === 'perspektive' && punkte.length === 4) || modus === 'first' ? 'grab' : undefined }}
                >
                  {modus === 'umriss' && umrissBearbeiten && (
                    <circle cx={qx} cy={qy} r={px(0.018)} fill="rgba(249,115,22,0.18)" />
                  )}
                  <circle
                    cx={qx}
                    cy={qy}
                    r={px(modus === 'first' ? 0.0025 : i === 0 && modus === 'umriss' && punkte.length >= 3 ? 0.011 : 0.007)}
                    fill={umrissVorschauFehler ? '#dc2626' : modus === 'first' ? '#0d9488' : modus === 'ziegel' ? '#0ea5e9' : modus === 'hindernis' ? '#ef4444' : i === 0 && modus === 'umriss' ? '#ea580c' : '#f97316'}
                    stroke="#ffffff"
                    strokeWidth={modus === 'first' ? 1 : px(0.002)}
                    vectorEffect={modus === 'first' ? 'non-scaling-stroke' : undefined}
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
  ) : null;
  const punktAktionText = fadenkreuzAktiv && renderArbeitsbereich ? 'mit dem Fadenkreuz anvisieren und „Punkt setzen“ drücken' : 'anklicken';
  const eckeAktionText = fadenkreuzAktiv && renderArbeitsbereich ? 'mit „Ecke greifen“ und „Ecke hier ablegen“ versetzen' : 'ziehen';
  const hinweis = foto && inMarkierung ? (
          <p className="mt-1 text-xs text-slate-600">
            {modus === 'first'
              ? punkte.length === 0
                ? `Anfang der ${istSchraegdach ? 'First-/Trauflinie' : kantenName} ${punktAktionText}.`
                : `Ende der Linie ${punktAktionText}.`
              : modus === 'perspektive'
              ? punkte.length < 4
                ? `Ecke ${punkte.length + 1} von 4 ${punktAktionText} (${flaechenName}).`
                : `Vorschau prüfen, einzelne Punkte bei Bedarf ${eckeAktionText} und dann „4 Ecken übernehmen".`
              : modus === 'umriss'
                ? flaeche.umrissM && punkte.length >= 3
                  ? umrissVorschauFehler
                    ? `Der Entwurf ist ungültig. Rote Ecke ${eckeAktionText}; Speichern bleibt gesperrt.`
                    : `Nummerierte Ecke ${eckeAktionText} und anschließend „Umriss übernehmen" drücken.`
                  : punkte.length < 3
                  ? `Ecke ${punkte.length + 1} ${punktAktionText} (mind. 3) — oder „${flaechenName} belegen“ für ein Rechteck.`
                  : 'Weitere Ecken — oder ersten Punkt / „Umriss fertig" zum Schließen.'
                : modus === 'hindernis'
                  ? punkte.length === 0
                    ? `Erste Ecke des Hindernisses ${punktAktionText}.`
                    : `Gegenüberliegende Ecke ${punktAktionText}.`
                  : punkte.length === 0
                    ? `Anfang der Ziegel-Strecke ${punktAktionText}.`
                    : `Ende der ${anzahlZiegel}-Ziegel-Strecke ${punktAktionText}.`}
          </p>
  ) : null;

  const standardSteuerung = (
    <div className="mb-3">
      {fotoVerwalten && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={dateiLaden}
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
                onClick={() => { setPunkte(traufeWechseln((perspektivVorschau ?? punkte) as Ecken)); setEckenOrientiert(true); setEntwurfGeaendert(true); }}
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
            {check?.vorschlag && onMassVorschlag && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => onMassVorschlag({
                  breiteM: check.vorschlag!.breiteM,
                  hoeheM: check.vorschlag!.hoeheM,
                })}
              >
                Maße aus Foto prüfen ({fmtDe(check.vorschlag.breiteM, 1)} ×{' '}
                {fmtDe(check.vorschlag.hoeheM, 1)} m)
              </button>
            )}
            {fotoVerwalten && (
              <button
                type="button"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-700 hover:border-red-300"
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
            check.status === 'ungeprueft'
              ? 'bg-slate-100 text-slate-700'
              : check.status === 'ok'
                ? 'bg-emerald-50 text-emerald-800'
                : check.status === 'warnung'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-red-50 text-red-700'
          }`}
        >
          <strong>Foto-Plausibilität: {check.status === 'ungeprueft' ? 'Nicht geprüft.' : ''}</strong>{' '}
          {check.meldungen.map((m, i) => (
            <span key={i}>{m} </span>
          ))}
        </div>
      )}

      {foto && !massCheck.belegen && (
        <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <strong>Maße:</strong> {massCheck.meldung}
        </p>
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
                  onClick={() => {
                    setPunkte(punkte.slice(0, -1));
                    if (punkte.length <= 3) setUmrissBearbeiten(false);
                  }}
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
                disabled={!massCheck.belegen}
                title={massCheck.meldung ?? undefined}
                className="ml-auto h-9 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                onClick={() => {
                  if (!massCheck.belegen) return;
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


        </div>
      )}
    </div>
  );

  const steuerung = kompakt ? kompakteSteuerung : standardSteuerung;
  if (renderArbeitsbereich) return <>{renderArbeitsbereich({
    bild, steuerung, hinweis,
    bildSeitenverhaeltnis: foto ? foto.breitePx / foto.hoehePx : 1,
    abbrechen: gesteAbbrechen,
    punktSteuerung: foto ? {
      aktiv: fadenkreuzAktiv,
      aktivieren: () => { aktiviereTouch(); if (!fadenkreuzAktiv) starteFadenkreuz(); },
      deaktivieren: () => {
        deaktiviereTouch(); setFadenkreuzAktiv(false); setTouchGriff(null);
        touchSwipeRef.current = null;
      },
      punkt: touchCursorPx ?? [foto.breitePx / 2, foto.hoehePx / 2],
      breitePx: foto.breitePx, hoehePx: foto.hoehePx,
      onBewegen: setTouchCursorPx, onBestaetigen: fadenkreuzAktion,
      aktion: touchGriff ? 'Ecke hier ablegen' : griffAmKreuz ? 'Ecke greifen' : 'Punkt setzen',
      deaktiviert: !massCheck.belegen || (modus === 'perspektive' && punkte.length >= 4 && !touchGriff && !griffAmKreuz),
    } : undefined,
  })}</>;
  return <>{steuerung}{bild && foto && <div
    className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
    style={{ aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`, maxHeight: 480, maxWidth: 480 * foto.breitePx / foto.hoehePx }}
  >{bild}</div>}{hinweis}</>;
}
