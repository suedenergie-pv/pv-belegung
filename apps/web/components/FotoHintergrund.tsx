'use client';

import React, { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { hindernisUmriss, punktInPolygon, type HindernisM } from '@pv-belegung/engine';
import { aussparungEcke, aussparungFehler, skaliereAussparung, verschiebeAussparung } from '../lib/aussparung-geometrie';
import { dateiZuBild } from '../lib/bild';
import {
  belegungsCheck,
  hindernisAusKlicks,
  homographie,
  inverseHomographie,
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
import styles from './FotoEinrichtung.module.css';
import { EditorAktionen } from './EditorAktionen';
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
type Griff = { art: 'punkt' | 'first'; i: number } | { art: 'aussparung' | 'aussparung-ecke'; i: number; ecke?: number; start: Punkt; basis: HindernisM };

export type FotoArbeitsbereich = {
  bild: React.ReactNode;
  steuerung: React.ReactNode;
  hinweis: React.ReactNode;
  bildSeitenverhaeltnis: number;
  aufgabe?: { titel: string; phase: string };
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
  ansichtZoom = 1,
  cancelRevision,
  onMasseBearbeiten,
  onReferenzBearbeiten,
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
  /** Ansichtszoom ändert nur die Bildschirmgröße der Griffe, nie die Geometrie. */
  ansichtZoom?: number;
  cancelRevision?: number;
  onMasseBearbeiten?: () => void;
  onReferenzBearbeiten?: () => void;
  /** Bereits belegte andere Ebenen desselben Fotos, im identischen Bildraum. */
  fotoOverlay?: (clipIdPrefix: string) => React.ReactNode;
}) {
  const overlayId = useId().replace(/:/g, '');
  const [fotoEntwurf, setFotoEntwurf] = useState<DachFoto | null>(null);
  const foto = fotoEntwurf ?? flaeche.foto;
  const [bildSvg, setBildSvg] = useState<SVGSVGElement | null>(null);
  const [einheitenProPixel, setEinheitenProPixel] = useState(1);
  useLayoutEffect(() => {
    if (!bildSvg || !foto) return;
    const messen = () => {
      const matrix = bildSvg.getScreenCTM?.();
      const rect = bildSvg.getBoundingClientRect();
      const skala = matrix ? Math.hypot(matrix.a, matrix.b) : Math.min(rect.width / foto.breitePx, rect.height / foto.hoehePx);
      if (Number.isFinite(skala) && skala > 0) setEinheitenProPixel(1 / skala);
    };
    messen();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    observer?.observe(bildSvg);
    window.addEventListener('resize', messen);
    return () => { observer?.disconnect(); window.removeEventListener('resize', messen); };
  }, [bildSvg, foto?.breitePx, foto?.hoehePx, ansichtZoom]);
  const bildschirmPx = (pixel: number) => pixel * einheitenProPixel;
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
  const [modus, setModus] = useState<Modus>(kompakt ? 'perspektive' : 'first');
  const [unterkanteBestaetigt, setUnterkanteBestaetigt] = useState(false);
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
  const [aussparung, setAussparung] = useState<{ i: number; form: HindernisM } | null>(null);
  const hindernisseRef = useRef(flaeche.hindernisse ?? []);
  hindernisseRef.current = flaeche.hindernisse ?? [];
  // Eine reine Auswahl ist kein Entwurf: Undo/Redo muss sie mit dem Modell mitführen.
  useEffect(() => {
    if (entwurfGeaendert) return;
    setAussparung(aktuell => aktuell && flaeche.hindernisse?.[aktuell.i]
      ? { i: aktuell.i, form: flaeche.hindernisse[aktuell.i]! } : null);
  }, [flaeche.hindernisse, entwurfGeaendert]);
  const gestenBasis = useRef<{ punkte: Punkt[]; firstLinie: [Punkt, Punkt] | null; geaendert: boolean; aussparung: typeof aussparung } | null>(null);
  const gesteGesperrt = useRef(false);
  const praeziserZeiger = useRef<{ x: number; y: number; zeit: number } | null>(null);
  const touchSwipeRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const gesteAbbrechen = () => {
    praeziserZeiger.current = null;
    if (gestenBasis.current) {
      setPunkte(gestenBasis.current.punkte);
      setFirstLinie(gestenBasis.current.firstLinie);
      setEntwurfGeaendert(gestenBasis.current.geaendert);
      setAussparung(gestenBasis.current.aussparung);
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
    wechsleModus(foto?.eckenPx ? initialWerkzeug ?? 'hindernis' : kompakt ? 'perspektive' : 'first');
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
  const inv = foto?.eckenPx ? inverseHomographie(rahmenB, H, foto.eckenPx, quelle) : null;
  const aussparungProblem = aussparung ? aussparungFehler(aussparung.form) : null;
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
  const waehleUnterkante = (index: number) => {
    if (!perspektivVorschau) return;
    setPunkte(perspektivVorschau.map((_, i) => [...perspektivVorschau[(i + index) % 4]!] as Punkt));
    setEckenOrientiert(true); setUnterkanteBestaetigt(true); setEntwurfGeaendert(true); setMarkierungsFehler(null);
  };
  const kanteBeiPunkt = (k: Punkt) => {
    if (!perspektivVorschau) return -1;
    const kanten = perspektivVorschau.map((a, i) => {
      const b = perspektivVorschau[(i+1)%4]!, dx=b[0]-a[0], dy=b[1]-a[1];
      const t = Math.max(0,Math.min(1,((k[0]-a[0])*dx+(k[1]-a[1])*dy)/(dx*dx+dy*dy || 1)));
      return {i, abstand:Math.hypot(k[0]-a[0]-t*dx,k[1]-a[1]-t*dy)};
    }).sort((a,b)=>a.abstand-b.abstand);
    return kanten[0]!.abstand <= bildschirmPx(22) ? kanten[0]!.i : -1;
  };
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
    setAussparung(null);
    setModus(m);
    setUnterkanteBestaetigt(m === 'perspektive' && !!foto?.eckenPx);
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
    if (kompakt && !unterkanteBestaetigt) { setMarkierungsFehler('Wähle im Foto die untere Kante der Fläche, beim Dach die Dachrinne.'); return; }
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
    if (!flaeche.umrissM || flaeche.fotoBezugsrahmen) return;
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
    // Chromium rundet MouseEvent/Click, PointerEvents behalten Bruchteile.
    // Nur die unmittelbar zugehörige Position verwenden; synthetische/Keyboard-Klicks bleiben unabhängig.
    const z = praeziserZeiger.current;
    const praezise = z && Date.now() - z.zeit < 200 && Math.abs(z.x - e.clientX) < 2 && Math.abs(z.y - e.clientY) < 2;
    return [
      (((praezise ? z.x : e.clientX) - rect.left) / rect.width) * foto.breitePx,
      (((praezise ? z.y : e.clientY) - rect.top) / rect.height) * foto.hoehePx,
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
    if (modus === 'hindernis' && aussparung && hom) {
      hindernisUmriss(aussparung.form).forEach((p, ecke) => {
        const [x, y] = projiziere(hom, p as Punkt);
        arr.push({ x, y, z: { art: 'aussparung-ecke', i: aussparung.i, ecke, start: [p[0], p[1]], basis: aussparung.form } });
      });
      const p: Punkt = [aussparung.form.xM + aussparung.form.breiteM / 2, aussparung.form.yM + aussparung.form.hoeheM / 2];
      const [x, y] = projiziere(hom, p);
      arr.push({ x, y, z: { art: 'aussparung', i: aussparung.i, start: p, basis: aussparung.form } });
    }
    if ((modus === 'perspektive' && punkte.length === 4) || (modus === 'umriss' && umrissBearbeiten)) {
      punkte.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'punkt', i } }));
    } else if (modus === 'first') {
      punkte.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'punkt', i } }));
      if (firstLinie) firstLinie.forEach((p, i) => arr.push({ x: p[0], y: p[1], z: { art: 'first', i } }));
    }
    return arr;
  };

  const naheHandle = (k: Punkt) => {
    const schwelle = bildschirmPx(touchGeraet ? 22 : 12);
    const griff = handles().sort((a, b) => Math.hypot(a.x-k[0], a.y-k[1]) - Math.hypot(b.x-k[0], b.y-k[1])).find((h) => Math.hypot(h.x - k[0], h.y - k[1]) <= schwelle);
    if (griff) return griff;
    if (modus !== 'hindernis' || !inv || punkte.length) return;
    const p = projiziere(inv, k);
    const formen = (flaeche.hindernisse ?? []).map((h, i) => aussparung?.i === i ? aussparung.form : h);
    for (let i = formen.length - 1; i >= 0; i--) {
      const form = formen[i]!;
      if (punktInPolygon(p, hindernisUmriss(form))) return { x: k[0], y: k[1], z: { art: 'aussparung', i, start: p, basis: form } as Griff };
    }
  };

  const aussparungWaehlen = (i: number) => {
    if (aussparung?.i === i) return;
    const ausfuehren = () => {
      const form = hindernisseRef.current[i];
      if (!form) return;
      setAussparung({ i, form }); setPunkte([]); setEntwurfGeaendert(false); setTouchGriff(null); setMarkierungsFehler(null);
    };
    if (entwurfGeaendert) navigation.weiter(ausfuehren); else ausfuehren();
  };
  const aussparungUebernehmen = () => {
    if (!aussparung || aussparungProblem) return;
    const hindernisse = hindernisseRef.current.map((h, i) => i === aussparung.i ? aussparung.form : h);
    hindernisseRef.current = hindernisse;
    onPatch({ hindernisse, inaktiv: [] });
    setAussparung(null); setEntwurfGeaendert(false); setTouchGriff(null);
  };

  /** Griff auf neue Position setzen (Ecke im Foto, Trauflinien-Punkt oder Draft-Punkt). */
  const setzeHandle = (z: Griff, k: Punkt) => {
    if (!foto) return;
    if (z.art === 'aussparung' || z.art === 'aussparung-ecke') {
      if (!inv) return;
      const p = projiziere(inv, k);
      const form = z.art === 'aussparung' ? verschiebeAussparung(z.basis, p[0] - z.start[0], p[1] - z.start[1]) : aussparungEcke(z.basis, z.ecke!, p);
      setAussparung({ i: z.i, form }); setEntwurfGeaendert(true);
      return;
    }
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
    if (modus === 'hindernis') {
      const griff = naheHandle(k);
      if (griff && (griff.z.art === 'aussparung' || griff.z.art === 'aussparung-ecke')) { aussparungWaehlen(griff.z.i); return; }
      if (aussparung) return;
    }
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
      if (punkte.length >= 4) {
        if (kompakt) { const i = kanteBeiPunkt(k); if (i >= 0) waehleUnterkante(i); else if (!unterkanteBestaetigt) setMarkierungsFehler('Wähle die untere Kante direkt am Rand der Fläche.'); }
        return;
      }
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
    if (kompakt && modus === 'perspektive' && punkte.length === 4 && !unterkanteBestaetigt) { verarbeitePunkt(touchCursorPx); return; }
    const griff = naheHandle(touchCursorPx);
    if (griff) {
      if (griff.z.art === 'aussparung' || griff.z.art === 'aussparung-ecke') {
        if (aussparung?.i !== griff.z.i && entwurfGeaendert) { aussparungWaehlen(griff.z.i); return; }
        setAussparung({ i: griff.z.i, form: griff.z.basis });
      }
      setTouchGriff(griff.z);
      return;
    }
    verarbeitePunkt(touchCursorPx);
  };

  const zurueckAufAnfang = () => {
    setPunkte([]);
    setEckenOrientiert(false);
    setFirstLinie(null);
    setModus(kompakt ? 'perspektive' : 'first');
    setUnterkanteBestaetigt(false);
    setEntwurfGeaendert(false);
  };

  const entwurfVerwerfen = () => {
    setAussparung(null);
    setFotoEntwurf(null);
    setPunkte([]);
    setFirstLinie(null);
    setTouchGriff(null);
    setMarkierungsFehler(null);
    setEntwurfGeaendert(false);
    setUmrissBearbeiten(false);
    setModus(flaeche.foto?.eckenPx ? 'hindernis' : kompakt ? 'perspektive' : 'first');
    setUnterkanteBestaetigt(!!flaeche.foto?.eckenPx);
  };
  const entwurfGueltig = () => {
    if (modus === 'hindernis' && aussparung) return !aussparungProblem;
    if (modus === 'perspektive' && perspektivVorschau && vorschauCheck?.status !== 'fehler' && (!kompakt || unterkanteBestaetigt)) return true;
    if (modus === 'umriss' && umrissVorschauPruefung?.ok) return true;
    setMarkierungsFehler('Bitte die Markierung abschließen oder den Entwurf verwerfen. Der bisherige Plan bleibt erhalten.');
    return false;
  };
  const entwurfCallbacks = useRef({
    gueltig: entwurfGueltig,
    uebernehmen: () => { if (modus === 'hindernis' && aussparung) aussparungUebernehmen(); else if (modus === 'perspektive') perspektiveAbschliessen(punkte); else if (modus === 'umriss') umrissAbschliessen(punkte); },
    verwerfen: entwurfVerwerfen,
  });
  entwurfCallbacks.current = {
    gueltig: entwurfGueltig,
    uebernehmen: () => { if (modus === 'hindernis' && aussparung) aussparungUebernehmen(); else if (modus === 'perspektive') perspektiveAbschliessen(punkte); else if (modus === 'umriss') umrissAbschliessen(punkte); },
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
  const ohneAussparungen = !(flaeche.hindernisse?.length);
  const ohneAussparungenWeiter = () => {
    if (!belegenFreigegeben || fotoEntwurf || !ohneAussparungen || aussparung) return;
    setPunkte([]);
    setEntwurfGeaendert(false);
    setTouchGriff(null);
    setMarkierungsFehler(null);
    onPatch({ markierungFertig: true });
  };
  const werkzeugWaehlen = (m: Modus) => {
    if (foto?.referenzMessung && (m === 'first' || m === 'perspektive')) { if (onReferenzBearbeiten) navigation.weiter(onReferenzBearbeiten); return; }
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

  // Overlay-Maße in Bildschirmpixeln, unabhängig von Fotoauflösung und Zoom.
  const px = (v: number) => bildschirmPx(v * 1000);
  const eckRadius = bildschirmPx(Math.max(3.5, 5 / Math.pow(Math.max(1, ansichtZoom), .15)));
  const letzter = punkte[punkte.length - 1];
  const kreuzPx = fadenkreuzAktiv ? touchCursorPx : mausPx;
  const griffAmKreuz = touchCursorPx ? naheHandle(touchCursorPx) : undefined;
  const griffAnvisieren = !!aussparung && !touchGriff && !griffAmKreuz;
  const unterkanteOffen = kompakt && modus === 'perspektive' && punkte.length === 4 && !unterkanteBestaetigt;
  const griffAktion = unterkanteOffen ? 'Untere Kante wählen' : touchGriff ? touchGriff.art === 'aussparung' ? 'Aussparung hier ablegen' : 'Ecke hier ablegen' : griffAmKreuz ? griffAmKreuz.z.art === 'aussparung' ? 'Aussparung greifen' : 'Ecke greifen' : griffAnvisieren ? 'Griff anvisieren' : 'Punkt setzen';

  const gesteBeginnen = () => {
    gesteGesperrt.current = false;
    gestenBasis.current = { punkte: punkte.map((p) => [...p] as Punkt), firstLinie: firstLinie ? firstLinie.map((p) => [...p] as Punkt) as [Punkt, Punkt] : null, geaendert: entwurfGeaendert, aussparung };
  };

  const einrichtungsSchritt = !massCheck.belegen ? 1 : modus === 'first' || modus === 'perspektive' ? 2 : 3;
  const zusatzWerkzeug = massCheck.belegen && (modus === 'umriss' || modus === 'ziegel');
  const einrichtungsAufgabe = {
    phase: zusatzWerkzeug ? 'Zusätzliche Bearbeitung' : `Schritt ${einrichtungsSchritt} von 3 · ${flaechenName} einrichten`,
    titel: !massCheck.belegen ? flaechenArt === 'fassade' ? 'Fassadenmaße festlegen' : 'Dachmaße festlegen'
      : modus === 'first' ? istSchraegdach ? 'Dachkante markieren' : `${kantenName} markieren`
      : modus === 'perspektive' ? kompakt && perspektivVorschau?.length === 4 ? unterkanteBestaetigt ? 'Ecken und Kante prüfen' : 'Wo ist die untere Kante?' : flaechenArt === 'fassade' ? 'Fassadenecken markieren' : 'Dachecken markieren' : modus === 'hindernis' ? aussparung ? `Aussparung ${aussparung.i+1} bearbeiten` : 'Aussparungen markieren'
      : modus === 'umriss' ? flaechenArt === 'fassade' ? 'Fassadenumriss nachzeichnen' : 'Dachumriss nachzeichnen' : 'Foto-Maßstab prüfen',
  };
  const zielPunkte = modus === 'perspektive' ? 4 : modus === 'umriss' ? 0 : 2;
  const perspektivFehler = modus === 'perspektive' && vorschauCheck?.status === 'fehler' ? vorschauCheck.meldungen.join(' ') : null;
  const perspektivFehlerText = perspektivFehler?.includes('konvexes') ? 'Die vier Punkte bilden kein Viereck.' : perspektivFehler;
  const punktZurueck = () => { setUnterkanteBestaetigt(false); setEckenOrientiert(false); setPunkte(punkte.slice(0, -1)); setEntwurfGeaendert(true); };
  const anweisung = !massCheck.belegen ? 'Trage die gemessene Breite und Länge der Dachfläche ein.'
    : modus === 'first' ? `Markiere Anfang und Ende der ${istSchraegdach ? 'unteren Dachkante' : kantenName} im Foto${istSchraegdach ? ' (Traufe)' : ''}.`
    : modus === 'perspektive' ? kompakt && perspektivVorschau?.length === 4 ? unterkanteBestaetigt ? 'Prüfe die vier Ecken und die grün markierte untere Kante. Passt alles, übernimm die Markierung.' : 'Klicke die untere Kante direkt im Foto an – beim Dach ist das die Dachrinne.' : flaechenArt === 'fassade' ? 'Markiere die vier äußeren Ecken der Fassade im Foto. Die Reihenfolge ist egal.' : parametrisch ? 'Markiere die vier äußeren Dachecken im Foto. Die Reihenfolge ist egal.'
      : 'Markiere die vier Ecken des umschließenden Dachrechtecks im Foto. Ausschnitte folgen danach.'
    : modus === 'hindernis' ? aussparung ? 'Verschiebe die Aussparung oder ziehe ihre Eckgriffe auf die gewünschte Kontur.' : 'Neue Aussparung: zwei gegenüberliegende Punkte setzen. Bestehende Aussparung: im Foto auswählen.'
    : modus === 'umriss' ? 'Zeichne den tatsächlichen Dachrand im Foto nach. Setze einen Punkt an jeder Ecke.'
    : `Markiere eine Strecke über ${anzahlZiegel} Ziegel mit bekannter Deckbreite.`;
  const naechsteAktion = modus === 'perspektive' ? punkte.length < 4
    ? `Jetzt im Foto: ${punkte.length + 1}. Eckpunkt setzen.` : kompakt && !unterkanteBestaetigt ? 'Jetzt im Foto die untere Kante wählen – beim Dach die Dachrinne.' : 'Untere Kante markiert. Prüfe die Ecken und übernimm die Fläche.'
    : modus === 'hindernis' ? punkte.length ? 'Jetzt im Foto: die gegenüberliegende Ecke setzen.' : flaeche.hindernisse?.length ? 'Fenster oder Hindernis gespeichert. Weitere markieren oder zur Belegung weitergehen.' : 'Keine Fenster oder Hindernisse? Du kannst direkt weiter.'
    : modus === 'first' ? punkte.length ? 'Jetzt im Foto: das andere Ende der Kante setzen.' : 'Jetzt im Foto: den Anfang der Kante setzen.'
    : modus === 'umriss' ? punkte.length < 3 ? 'Mindestens drei Punkte im Foto setzen.' : 'Dachrand prüfen und übernehmen.'
    : 'Anfang und Ende der Ziegelstrecke im Foto setzen.';
  const kurzAnweisung = modus === 'perspektive' ? flaechenArt === 'fassade' ? 'Im Foto die vier Fassadenecken markieren.' : parametrisch ? 'Im Foto die vier äußeren Dachecken markieren.' : 'Im Foto die vier Ecken des Dachrechtecks markieren.'
    : modus === 'first' ? `Im Foto beide Enden der ${istSchraegdach ? 'unteren Dachkante' : kantenName} markieren.`
    : modus === 'hindernis' ? aussparung ? 'Mitte verschieben · Eckgriffe verziehen.' : 'Neu: zwei Punkte. Bearbeiten: Aussparung auswählen.' : anweisung;
  const aussparungListe = modus === 'hindernis' && <div className={styles.aussparungen}>
    {aussparung && <section aria-label={`Aussparung ${aussparung.i + 1} bearbeiten`} className={styles.aussparungEditor}>
      {!kompakt && <h4>Aussparung {aussparung.i + 1} bearbeiten</h4>}
      <p>Mitte ziehen: verschieben. Eckgriffe ziehen: Form ändern.</p>
      <div className={styles.massRaster}>{(['breiteM', 'hoeheM'] as const).map((feld) => <label key={feld}>{feld === 'breiteM' ? 'Breite (m)' : 'Höhe (m)'}<input type="number" min="0.05" step="0.05" value={Number(aussparung.form[feld].toFixed(3))} onChange={(e) => {
        const wert = Number(e.target.value);
        if (!Number.isFinite(wert) || wert <= 0) return;
        setAussparung({ ...aussparung, form: skaliereAussparung(aussparung.form, feld === 'breiteM' ? wert : aussparung.form.breiteM, feld === 'hoeheM' ? wert : aussparung.form.hoeheM) }); setEntwurfGeaendert(true);
      }} /></label>)}</div>
      <div className={styles.nudge} role="group" aria-label="Aussparung um 1 cm verschieben">{([['←', -.01, 0, 'links'], ['↑', 0, -.01, 'oben'], ['↓', 0, .01, 'unten'], ['→', .01, 0, 'rechts']] as const).map(([label, dx, dy, richtung]) => <button key={label} type="button" aria-label={`Aussparung 1 cm nach ${richtung}`} onClick={() => { setAussparung({ ...aussparung, form: verschiebeAussparung(aussparung.form, dx, dy) }); setEntwurfGeaendert(true); }}>{label}</button>)}<span>1 cm</span></div>
      {aussparungProblem && <p role="alert" className="text-red-700">{aussparungProblem}</p>}
      {!kompakt && <button type="button" className={knopfKlasse} disabled={!entwurfGeaendert || !!aussparungProblem} onClick={aussparungUebernehmen}>Änderungen übernehmen</button>}
      {!kompakt && <button type="button" className={knopfKlasse} onClick={entwurfVerwerfen}>{entwurfGeaendert ? 'Änderungen verwerfen' : 'Bearbeitung schließen'}</button>}
    </section>}
    {!aussparung && (flaeche.hindernisse ?? []).length > 0 && <p>Zum Bearbeiten im Foto oder in der Liste auswählen.</p>}
    {(flaeche.hindernisse ?? []).map((h, i) => <div className={styles.aussparungZeile} key={i}>
      <button type="button" aria-label={`Aussparung ${i + 1} bearbeiten`} aria-pressed={aussparung?.i === i} onClick={() => aussparungWaehlen(i)}>Aussparung {i + 1} · {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m <span>Bearbeiten</span></button>
      <button type="button" aria-label={`Aussparung ${i + 1} entfernen`} onClick={() => navigation.weiter(() => { const hindernisse = hindernisseRef.current.filter((_, j) => j !== i); hindernisseRef.current = hindernisse; onPatch({ hindernisse, inaktiv: [] }); setAussparung(null); })}>Entfernen</button>
    </div>)}
  </div>;
  const kompakteSteuerung = <div className={styles.einrichtung} data-foto-einrichtung>
    {!renderArbeitsbereich && <header className={styles.aufgabenKopf}><span>{einrichtungsAufgabe.phase}</span><h3>{einrichtungsAufgabe.titel}</h3></header>}
    {fotoVerwalten && <div className="flex flex-wrap gap-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={dateiLaden} />
      <button type="button" className={knopfKlasse} onClick={() => inputRef.current?.click()}><IconFoto />{foto ? 'Anderes Foto' : 'Foto hinzufügen'}</button>
    </div>}
    {foto && <>
      {!aussparung && <p className={styles.anweisung}><span className={styles.lang}>{anweisung}</span><span className={styles.kurz}>{massCheck.belegen ? kurzAnweisung : anweisung}</span></p>}
      {!massCheck.belegen ? <>
        <EditorAktionen><div data-foto-abschluss>
          <span>Danach richtest du die Dachfläche im Foto aus.</span>
          {onMasseBearbeiten && <button type="button" onClick={onMasseBearbeiten}>Maße & Dachform festlegen</button>}
        </div></EditorAktionen>
      </> : <>
        {!aussparung && <div className={styles.fortschritt} role="status" aria-live="polite" aria-atomic="true" data-testid="markierungs-fortschritt">
          <strong>{modus === 'perspektive' ? `${punkte.length} von 4 Eckpunkten gesetzt` : modus === 'hindernis' ? `${(flaeche.hindernisse ?? []).length} ${(flaeche.hindernisse ?? []).length === 1 ? 'Aussparung markiert' : 'Aussparungen markiert'}` : modus === 'umriss' ? `${punkte.length} Eckpunkte gesetzt` : `${punkte.length} von 2 Punkten gesetzt`}</strong>
          {!!zielPunkte && !aussparung && <ol className={styles.punkte} aria-label="Punkte im Foto">
            {Array.from({ length: zielPunkte }, (_, i) => <li key={i} data-fehler={!!perspektivFehler} data-gesetzt={i < punkte.length} data-aktuell={i === punkte.length} aria-label={`Punkt ${i + 1}: ${perspektivFehler ? 'Markierung ungültig' : i < punkte.length ? 'gesetzt' : i === punkte.length ? 'als Nächstes' : 'offen'}`}>{i < punkte.length && !perspektivFehler ? '✓' : i + 1}</li>)}
          </ol>}
          <p>{aussparung ? 'Aussparung verschieben oder ihre Eckgriffe verziehen.' : perspektivFehler ? 'Eckpunkte im Foto korrigieren oder einen Punkt zurücknehmen.' : naechsteAktion}</p>
        </div>}
        <EditorAktionen><div data-foto-abschluss data-aussparung-edit={!!aussparung}>
          <span role={perspektivFehler || aussparungProblem ? 'alert' : undefined} data-fehler={!!perspektivFehler || !!aussparungProblem}>{aussparung ? aussparungProblem ?? (entwurfGeaendert ? 'Vorschau · bisheriger Plan bleibt bis zur Übernahme erhalten.' : 'Mitte verschieben oder Eckgriffe verziehen.') : modus === 'perspektive' ? punkte.length < 4 ? `Noch ${4 - punkte.length} ${punkte.length === 3 ? 'Eckpunkt' : 'Eckpunkte'} im Foto setzen.` : perspektivFehlerText ?? 'Danach: Aussparungen prüfen.'
            : modus === 'first' ? 'Nach zwei Punkten geht es zu den Dachecken.'
            : modus === 'hindernis' ? ohneAussparungen ? 'Keine Fenster oder Kamine? Direkt weiter zur Modulplatzierung.' : punkte.length ? 'Aussparung mit dem zweiten Punkt abschließen.' : 'Danach platzierst du Module.'
            : modus === 'umriss' ? punkte.length < 3 ? 'Noch mindestens drei Eckpunkte erforderlich.' : 'Dachumriss prüfen und bestätigen.'
            : 'Nach zwei Punkten wird der Foto-Maßstab übernommen.'}</span>
          {modus === 'first' && <button type="button" data-sekundaer onClick={() => { setPunkte([]); setEntwurfGeaendert(false); wechsleModus('perspektive'); }}>Überspringen ({kantenName} unten)</button>}
          {modus === 'perspektive' && (perspektivFehler ? <div data-foto-fehleraktionen><button type="button" onClick={punktZurueck}>Punkt zurück</button><button type="button" disabled>4 Ecken übernehmen</button></div> : <button type="button" disabled={punkte.length !== 4 || (kompakt && !unterkanteBestaetigt)} onClick={() => perspektiveAbschliessen(punkte)}>4 Ecken übernehmen <span aria-hidden="true">→</span></button>)}
          {modus === 'umriss' && <button type="button" disabled={punkte.length < 3 || !!umrissVorschauFehler} onClick={() => umrissAbschliessen(punkte)}>Umriss übernehmen</button>}
          {modus === 'hindernis' && (aussparung ? <><button type="button" data-sekundaer onClick={entwurfVerwerfen}>{entwurfGeaendert ? 'Änderungen verwerfen' : 'Bearbeitung schließen'}</button><button type="button" disabled={!entwurfGeaendert || !!aussparungProblem} onClick={aussparungUebernehmen}>Änderungen übernehmen</button></> : <button type="button" disabled={!belegenFreigegeben || !!fotoEntwurf || (!ohneAussparungen && entwurfGeaendert)} onClick={ohneAussparungen ? ohneAussparungenWeiter : belegen}>{ohneAussparungen ? 'Keine Aussparungen – weiter' : 'Weiter zur Modulplatzierung'} <span aria-hidden="true">→</span></button>)}
        </div></EditorAktionen>
        <div className={styles.korrekturen}>
          {punkte.length > 0 && !perspektivFehler && <button type="button" className={knopfKlasse} onClick={punktZurueck}>Punkt zurück</button>}
          {!aussparung && (entwurfGeaendert || fotoEntwurf) && <button type="button" className={knopfKlasse} onClick={entwurfVerwerfen}>Entwurf verwerfen</button>}
          {!kompakt && modus === 'perspektive' && punkte.length === 4 && <button type="button" className={knopfKlasse} onClick={() => { setPunkte(traufeWechseln((perspektivVorschau ?? punkte) as Ecken)); setEckenOrientiert(true); setUnterkanteBestaetigt(true); setEntwurfGeaendert(true); }}>↻ {kantenName} wechseln</button>}
          {modus === 'perspektive' && !!foto.eckenPx && <button type="button" className={knopfKlasse} onClick={() => { setPunkte([]); setEckenOrientiert(false); setEntwurfGeaendert(true); }}>Ecken neu</button>}
          {modus === 'umriss' && flaeche.fotoBezugsrahmen && onReferenzBearbeiten && <p>Der Rahmen folgt dem Aufmaß. Für eine größere oder anders ausgerichtete Dachfläche <button type="button" onClick={onReferenzBearbeiten}>Referenz und Dachrand neu prüfen</button>.</p>}
          {modus === 'umriss' && !!flaeche.umrissM && !flaeche.fotoBezugsrahmen && <button type="button" className={knopfKlasse} onClick={umrissEntfernen}>Manuellen Umriss entfernen</button>}
        </div>
        {aussparungListe}
        {touchGeraet && !renderArbeitsbereich && <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={fadenkreuzAktiv} className={knopfKlasse} onClick={() => { if (fadenkreuzAktiv) { setFadenkreuzAktiv(false); setTouchGriff(null); } else starteFadenkreuz(); }}>{fadenkreuzAktiv ? 'Fadenkreuz beenden' : 'Fadenkreuz bedienen'}</button>
          {fadenkreuzAktiv && <button type="button" disabled={griffAnvisieren} className={knopfKlasse} onClick={fadenkreuzAktion}>{griffAktion}</button>}
        </div>}
        <details className={styles.zusatz}><summary>Einrichtung korrigieren</summary><div role="toolbar" aria-label="Werkzeuge für die Foto-Markierung" className="flex flex-wrap gap-2">
          {!foto.referenzMessung && <button type="button" className={modusKnopfKlasse(modus === 'first')} aria-pressed={modus === 'first'} onClick={() => werkzeugWaehlen('first')}>{kantenName}</button>}
          {foto.referenzMessung && onReferenzBearbeiten ? <button type="button" className={knopfKlasse} onClick={onReferenzBearbeiten}>Referenz und Dachrand neu prüfen</button> : <button type="button" className={modusKnopfKlasse(modus === 'perspektive')} aria-pressed={modus === 'perspektive'} onClick={() => werkzeugWaehlen('perspektive')}>Dachecken</button>}
          <button type="button" className={modusKnopfKlasse(modus === 'hindernis')} aria-pressed={modus === 'hindernis'} disabled={!foto.eckenPx || !!fotoEntwurf} onClick={() => werkzeugWaehlen('hindernis')}>Aussparungen</button>
          <button type="button" className={modusKnopfKlasse(modus === 'umriss')} aria-pressed={modus === 'umriss'} disabled={!foto.eckenPx || !!fotoEntwurf} onClick={() => werkzeugWaehlen('umriss')}>Dachrand</button>
        </div></details>
        {modus === 'ziegel' && <div className="flex flex-wrap gap-2">
          <label>Ziegelanzahl<input type="number" min={2} max={100} value={anzahlZiegel} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 2) setAnzahlZiegel(n); }} className="block min-h-11 w-24 rounded-lg border border-slate-300 px-2" /></label>
          <label>Deckbreite (cm)<input type="number" min={10} max={80} value={deckCm} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) setDeckbreiteCm(n); }} className="block min-h-11 w-24 rounded-lg border border-slate-300 px-2" /></label>
        </div>}
      </>}
      <details className={styles.zusatz}><summary>Werkzeuge & Prüfungen</summary>
        {istSchraegdach && massCheck.belegen && <button type="button" className={knopfKlasse} onClick={() => werkzeugWaehlen('ziegel')}>Ziegel zählen (Maßstab)</button>}
        <dl className="space-y-2 py-3"><div><dt className="font-semibold">Maße</dt><dd>{massCheck.status === 'bestaetigt' ? 'Von dir bestätigt.' : massCheck.status === 'bestand' ? 'Aus bestehender Belegung übernommen.' : 'Noch nicht bestätigt.'}</dd></div>
          <div><dt className="font-semibold">Perspektive</dt><dd>{!foto.eckenPx || foto.perspektiveBestaetigt === false ? 'Dachecken noch nicht bestätigt.' : perspektivCheck?.status === 'fehler' ? perspektivCheck.meldungen.join(' ') : perspektivCheck?.status === 'warnung' ? perspektivCheck.meldungen.join(' ') : 'Dachecken bestätigt.'}</dd></div>
          <div><dt className="font-semibold">Foto-Plausibilität</dt><dd>{!check || check.status === 'ungeprueft' ? 'Nicht geprüft. Ein unabhängiger Foto-Maßstab fehlt.' : check.meldungen.join(' ')}</dd></div>
        </dl>
        {check?.vorschlag && onMassVorschlag && <button type="button" className={knopfKlasse} onClick={() => onMassVorschlag({ breiteM: check.vorschlag!.breiteM, hoeheM: check.vorschlag!.hoeheM })}>Maße aus Foto prüfen ({fmtDe(check.vorschlag.breiteM, 1)} × {fmtDe(check.vorschlag.hoeheM, 1)} m)</button>}
      </details>
    </>}
    {!perspektivFehler && (markierungsFehler || umrissVorschauFehler) && <p role="alert" className="text-sm text-red-700">{markierungsFehler ?? umrissVorschauFehler}</p>}
  </div>;

  const bild = foto && (inMarkierung || renderArbeitsbereich) ? (
            <svg
              ref={setBildSvg}
              viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
              tabIndex={0}
              role="img"
              aria-label={`${flaechenName} im Foto markieren. Pfeiltasten bewegen das Fadenkreuz, Enter setzt einen Punkt, Escape bricht die laufende Markierung ab.`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
              className={`block h-full w-full focus:outline-none focus:ring-4 focus:ring-akzent/40 ${kompakt && !massCheck.belegen ? 'cursor-default' : greift ? 'cursor-grabbing' : 'cursor-crosshair'}`}
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
                  if (aussparung && !fadenkreuzAktiv) {
                    const schritt = e.shiftKey ? .1 : .01;
                    setAussparung({ ...aussparung, form: verschiebeAussparung(aussparung.form, v[0] * schritt, v[1] * schritt) }); setEntwurfGeaendert(true); return;
                  }
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
                if (unterkanteOffen) { aufHandle.current = false; return; }
                if (kompakt && !massCheck.belegen) return;
                if (e.button !== 0) return;
                if (fadenkreuzAktiv) return;
                gesteBeginnen();
                const k = svgKoord(e);
                const h = k ? naheHandle(k) : undefined;
                aufHandle.current = !!h;
                if (h) {
                  if (h.z.art === 'aussparung' || h.z.art === 'aussparung-ecke') {
                    if (entwurfGeaendert && aussparung?.i !== h.z.i) { aussparungWaehlen(h.z.i); return; }
                    setAussparung({ i: h.z.i, form: h.z.basis });
                  }
                  ziehtRef.current = h.z;
                  setGreift(true);
                  e.preventDefault();
                }
              }}
              onMouseMove={(e) => {
                if (kompakt && !massCheck.belegen) return;
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
                if (e.pointerType === 'mouse') praeziserZeiger.current = { x: e.clientX, y: e.clientY, zeit: Date.now() };
                if (unterkanteOffen && !fadenkreuzAktiv) { aufHandle.current = false; return; }
                if (kompakt && !massCheck.belegen) return;
                if (e.button !== 0) return;
                gesteBeginnen();
                if (e.pointerType === 'mouse') {
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Testpointer. */ }
                  return;
                }
                if (!fadenkreuzAktiv) {
                  const k = svgKoord(e);
                  const h = k ? naheHandle(k) : undefined;
                  aufHandle.current = !!h;
                  if (h) {
                    if (h.z.art === 'aussparung' || h.z.art === 'aussparung-ecke') {
                      if (entwurfGeaendert && aussparung?.i !== h.z.i) { aussparungWaehlen(h.z.i); return; }
                      setAussparung({ i: h.z.i, form: h.z.basis });
                    }
                    ziehtRef.current = h.z; setGreift(true);
                  }
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
                if (e.pointerType === 'mouse') praeziserZeiger.current = { x: e.clientX, y: e.clientY, zeit: Date.now() };
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
                if (e.pointerType === 'mouse') praeziserZeiger.current = { x: e.clientX, y: e.clientY, zeit: Date.now() };
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

              {kompakt && perspektivVorschau && perspektivVorschau.map((a,i) => {
                const b=perspektivVorschau[(i+1)%4]!, gewaehlt=unterkanteBestaetigt && i===0;
                return <g key={`kante-${i}`} role="button" tabIndex={0} aria-label={`Kante ${i+1} als untere Kante wählen`} aria-pressed={gewaehlt}
                  onPointerDown={e=>e.stopPropagation()} onClick={e=>{
                    e.stopPropagation();
                    const r=e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    const k=kanteBeiPunkt([(e.clientX-r.left)/r.width*foto.breitePx,(e.clientY-r.top)/r.height*foto.hoehePx]);
                    if(k>=0) waehleUnterkante(k);
                  }}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();waehleUnterkante(i);}}} style={{cursor:'pointer'}}>
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth={bildschirmPx(44)} />
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={gewaehlt?'#b83d1e':'#0284c7'} strokeWidth={bildschirmPx(gewaehlt?4:2)} pointerEvents="none" />
                  {gewaehlt && <text x={(a[0]+b[0])/2} y={(a[1]+b[1])/2-bildschirmPx(10)} textAnchor="middle" fontSize={bildschirmPx(14)} fill="#263238" stroke="white" strokeWidth={bildschirmPx(3)} paintOrder="stroke" pointerEvents="none">Untere Kante · {fmtDe(B,2)} m</text>}
                </g>;
              })}
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
                (flaeche.hindernisse ?? []).map((gespeichert, i) => {
                  const r = aussparung?.i === i ? aussparung.form : gespeichert;
                  return (
                  <polygon
                    key={i}
                    data-testid="aussparung-kontur"
                    data-ausgewaehlt={aussparung?.i === i}
                    style={{ cursor: modus === 'hindernis' ? 'move' : undefined }}
                    points={hindernisUmriss(r)
                      .map((p) => projiziere(hom, p as Punkt))
                      .map(([qx, qy]) => `${qx.toFixed(1)},${qy.toFixed(1)}`)
                      .join(' ')}
                    fill={aussparung?.i === i ? 'rgba(234,88,12,0.06)' : 'rgba(239,68,68,0.12)'}
                    stroke={aussparung?.i === i ? '#9a3412' : '#ef4444'}
                    strokeWidth={bildschirmPx(aussparung?.i === i ? 1.5 : 1)}
                  />
                ); })}
              {modus === 'hindernis' && aussparung && handles().map((h, i) => <g key={i} data-testid={h.z.art === 'aussparung' ? 'aussparung-mitte' : 'aussparung-griff'} style={{ cursor: h.z.art === 'aussparung' ? 'move' : 'grab' }}>
                <title>{h.z.art === 'aussparung' ? 'Aussparung verschieben' : `Ecke ${i + 1} verschieben`}</title>
                <circle data-griff-ziel cx={h.x} cy={h.y} r={bildschirmPx(22)} fill="transparent" />
                {h.z.art === 'aussparung' ? <g pointerEvents="none" fill="none" strokeLinecap="round">
                  <path d={`M${h.x-bildschirmPx(4)},${h.y}h${bildschirmPx(8)}M${h.x},${h.y-bildschirmPx(4)}v${bildschirmPx(8)}`} stroke="#fff" strokeWidth={bildschirmPx(3)} />
                  <path d={`M${h.x-bildschirmPx(4)},${h.y}h${bildschirmPx(8)}M${h.x},${h.y-bildschirmPx(4)}v${bildschirmPx(8)}`} stroke="#9a3412" strokeWidth={bildschirmPx(1.5)} />
                </g> : <g pointerEvents="none">
                  <circle data-griff-sichtbar cx={h.x} cy={h.y} r={eckRadius} fill="rgba(255,255,255,.2)" stroke="#fff" strokeWidth={bildschirmPx(3)} />
                  <circle cx={h.x} cy={h.y} r={eckRadius} fill="none" stroke="#9a3412" strokeWidth={bildschirmPx(1.5)} />
                </g>}
              </g>)}

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
                  {(modus === 'umriss' || modus === 'perspektive') && (
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
                : perspektivFehler ? `Markierung ungültig: Eckpunkte ${eckeAktionText} oder „Punkt zurück“ wählen.` : kompakt && !unterkanteBestaetigt ? 'Wähle die untere Dachkante im Foto (Dachrinne).' : `Vorschau prüfen, einzelne Punkte bei Bedarf ${eckeAktionText} und dann „4 Ecken übernehmen".`
              : modus === 'umriss'
                ? flaeche.umrissM && punkte.length >= 3
                  ? umrissVorschauFehler
                    ? `Der Entwurf ist ungültig. Rote Ecke ${eckeAktionText}; Speichern bleibt gesperrt.`
                    : `Nummerierte Ecke ${eckeAktionText} und anschließend „Umriss übernehmen" drücken.`
                  : punkte.length < 3
                  ? kompakt ? 'Im Foto entlang des Dachrands Eckpunkte setzen (mindestens 3).' : `Ecke ${punkte.length + 1} ${punktAktionText} (mind. 3) — oder „${flaechenName} belegen“ für ein Rechteck.`
                  : kompakt ? 'Dachrand prüfen und „Umriss übernehmen“ wählen.' : 'Weitere Ecken — oder ersten Punkt / „Umriss fertig" zum Schließen.'
                : modus === 'hindernis'
                  ? aussparung ? 'Aussparung bearbeiten: Mitte verschieben, Eckgriffe verziehen.' : punkte.length === 0
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
              onClick={() => werkzeugWaehlen('first')}
            />
            <SchrittChip
              nr="②"
              label="Perspektivrahmen"
              aktiv={modus === 'perspektive'}
              erledigt={!!foto.eckenPx}
              titel="Vier Ecken legen fest, wie die Dachfläche im Foto liegt"
              onClick={() => werkzeugWaehlen('perspektive')}
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
              onClick={() => werkzeugWaehlen('umriss')}
            />
            <SchrittChip
              nr="④"
              label="Hindernisse"
              aktiv={modus === 'hindernis'}
              erledigt={(flaeche.hindernisse ?? []).length > 0}
              gesperrt={!foto.eckenPx}
              titel={!foto.eckenPx ? 'Erst die 4 Ecken setzen' : 'Kamin/Fenster/SAT einrahmen'}
              onClick={() => werkzeugWaehlen('hindernis')}
            />
            {modus === 'first' && (
              <button type="button" className={knopfKlasse} onClick={() => werkzeugWaehlen('perspektive')}>
                ➡ Überspringen ({kantenName} ist unten)
              </button>
            )}
            {istSchraegdach && (
              <button type="button" className={modusKnopfKlasse(modus === 'ziegel')} onClick={() => werkzeugWaehlen('ziegel')}>
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
                {flaeche.umrissM && !flaeche.fotoBezugsrahmen && (
                  <button
                    type="button"
                    className="touch-target h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:border-red-300"
                    onClick={umrissEntfernen}
                  >
                    Manuellen Umriss entfernen
                  </button>
                )}
                {foto.eckenPx && (
                  <button type="button" className={knopfKlasse} onClick={() => werkzeugWaehlen('perspektive')}>
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
                disabled={!belegenFreigegeben || entwurfGeaendert || !!fotoEntwurf}
                title={massCheck.meldung ?? undefined}
                className="ml-auto h-9 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                onClick={belegen}
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
                disabled={griffAnvisieren}
                onClick={fadenkreuzAktion}
              >
                {griffAktion}
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



          {aussparungListe}


        </div>
      )}
    </div>
  );

  const steuerung = kompakt ? kompakteSteuerung : standardSteuerung;
  if (renderArbeitsbereich) return <>{renderArbeitsbereich({
    bild, steuerung, hinweis, aufgabe: kompakt ? einrichtungsAufgabe : undefined,
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
      aktion: griffAktion,
      deaktiviert: !massCheck.belegen || (unterkanteOffen ? !touchCursorPx || kanteBeiPunkt(touchCursorPx) < 0 : griffAnvisieren || (modus === 'perspektive' && punkte.length >= 4 && !touchGriff && !griffAmKreuz)),
    } : undefined,
  })}</>;
  return <>{steuerung}{bild && foto && <div
    className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
    style={{ aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`, maxHeight: 480, maxWidth: 480 * foto.breitePx / foto.hoehePx }}
  >{bild}</div>}{hinweis}</>;
}
