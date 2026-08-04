'use client';

import { posKey, type BelegungRaster, type ModuleType } from '@pv-belegung/engine';
import React, { useId, type ReactNode } from 'react';
import {
  homographie,
  inverseHomographie,
  projiziere,
  projPfad,
  type Homographie,
  type Punkt,
} from '../lib/foto-geometrie';
import {
  modulAssetInner,
  modulMatrix,
  modulMatrixDreiecke,
  modulMatrixNetz,
} from '../lib/modul-assets';
import {
  DACHFARBEN,
  fmtDe,
  hindernisseVon,
  perspektiveQuelle,
  rahmenBreiteVon,
  umrissVon,
  type Dachfarbe,
  type Flaeche,
  type PunktM,
  type RechteckM,
} from '../lib/model';

/**
 * Zeichenmodus (SPEC §9, 06.07.2026): Klicks werden in Flächen-Koordinaten
 * (Meter) gemeldet — in der Draufsicht direkt über die viewBox, in der
 * Foto-Ansicht über die inverse Homographie. Die Draft-Punkte zeichnet DachSvg
 * in der jeweiligen Projektion mit.
 */
export interface ZeichnenProps {
  aktiv: boolean;
  punkteM: PunktM[];
  onKlickM: (p: PunktM) => void;
  /** Mausposition in Flächen-/Rahmen-Metern melden (für Live-Vorschau); null beim Verlassen. */
  onMoveM?: (p: PunktM | null) => void;
}

/** Auswahl-Umrandung: Modul-Keys (posKey) + optionale Farbe (Default Akzent-Orange). */
export interface Hervorheben {
  keys: string[];
  farbe?: string;
}

/**
 * Belegungsfeld-Umrandung (16.07.2026): das vom Nutzer gezogene Rechteck, das die
 * Module hält. Ausgewählte Felder werden kräftig gezeichnet.
 */
export interface FeldAnzeige {
  rect: RechteckM;
  ausgewaehlt: boolean;
}

/**
 * Live-Vorschau beim Aufziehen eines neuen Felds: blaues Rechteck + Modulzahl,
 * damit man vor dem Loslassen sieht, was hineinpasst.
 */
export interface FeldVorschau {
  rect: RechteckM;
  anzahl: number;
}

/**
 * Abgeschaltetes Modul (Geist): gestrichelter Umriss an der Stelle, wo das Modul
 * läge — damit man es einzeln wieder anschalten kann (Klick → `onToggle(key)`).
 */
export interface GeistPosition {
  key: string;
  xM: number;
  yM: number;
  wM: number;
  hM: number;
}

/**
 * Griff zum Ändern der Feldgröße (16.07.2026, Genrih: „Felder korrigieren können").
 * Die 8 Positionen eines Rechtecks; `nw` = links oben … `e` = rechte Kantenmitte.
 */
export type GriffId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** CSS-Cursor je Griff — zeigt schon vor dem Anfassen, in welche Richtung es geht. */
const GRIFF_CURSOR: Record<GriffId, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

/** Die 8 Griff-Punkte eines Felds in Flächen-Metern (Reihenfolge = Render-Reihenfolge). */
export function griffPunkte(r: RechteckM): { id: GriffId; p: PunktM }[] {
  const { xM: x, yM: y, breiteM: b, hoeheM: h } = r;
  return [
    { id: 'nw', p: [x, y] },
    { id: 'n', p: [x + b / 2, y] },
    { id: 'ne', p: [x + b, y] },
    { id: 'e', p: [x + b, y + h / 2] },
    { id: 'se', p: [x + b, y + h] },
    { id: 's', p: [x + b / 2, y + h] },
    { id: 'sw', p: [x, y + h] },
    { id: 'w', p: [x, y + h / 2] },
  ];
}

/**
 * Zeiger-Gesten für den Felder-Modus (Ziehen = Feld aufziehen/verschieben).
 * Koordinaten in Flächen-/Rahmen-Metern — in der Draufsicht direkt aus der viewBox,
 * im Foto über die inverse Homographie. Pointer-Events (nicht Mouse), damit
 * Touch/Stift auf dem Tablet dieselbe Bahn nehmen.
 */
export interface PointerProps {
  onDownM: (p: PunktM) => void;
  /** null = Zeiger hat die Fläche verlassen / Geste abgebrochen */
  onMoveM: (p: PunktM | null) => void;
  onUpM: (p: PunktM) => void;
}

/**
 * Dach-Texturen als SVG-Pattern in ECHTEN Maßen (Meter, userSpaceOnUse) —
 * Tonziegel ~30×33 cm, Betonziegel ~30×42 cm, Stehfalz ~53 cm Falzabstand.
 * Dachfarbe × Modul-Look ist Teil des Verkaufsmoments (SPEC §11.3).
 */
function DachPattern({ id, farbe }: { id: string; farbe: Dachfarbe }) {
  if (farbe.art === 'ziegel') {
    return (
      <pattern id={id} width={0.3} height={0.33} patternUnits="userSpaceOnUse">
        <rect width={0.3} height={0.33} fill={farbe.fill} />
        <path
          d="M 0 0.30 Q 0.075 0.35 0.15 0.30 Q 0.225 0.35 0.3 0.30"
          fill="none"
          stroke={farbe.dunkel}
          strokeWidth={0.025}
        />
        <line x1={0.15} y1={0.02} x2={0.15} y2={0.3} stroke={farbe.dunkel} strokeWidth={0.01} opacity={0.45} />
      </pattern>
    );
  }
  if (farbe.art === 'blech') {
    return (
      <pattern id={id} width={0.53} height={1} patternUnits="userSpaceOnUse">
        <rect width={0.53} height={1} fill={farbe.fill} />
        <line x1={0.03} y1={0} x2={0.03} y2={1} stroke={farbe.dunkel} strokeWidth={0.025} />
        <line x1={0.06} y1={0} x2={0.06} y2={1} stroke="#ffffff" strokeWidth={0.008} opacity={0.25} />
      </pattern>
    );
  }
  if (farbe.art === 'flach') {
    // Flachdach: Bitumen = Bahnen mit Überlappungsnaht; Kies = feine Sprenkel
    if (farbe.id === 'bitumen') {
      return (
        <pattern id={id} width={1} height={1} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill={farbe.fill} />
          <line x1={0.97} y1={0} x2={0.97} y2={1} stroke={farbe.dunkel} strokeWidth={0.04} />
          <line x1={0.99} y1={0} x2={0.99} y2={1} stroke="#ffffff" strokeWidth={0.006} opacity={0.12} />
        </pattern>
      );
    }
    return (
      <pattern id={id} width={0.4} height={0.4} patternUnits="userSpaceOnUse">
        <rect width={0.4} height={0.4} fill={farbe.fill} />
        <circle cx={0.08} cy={0.1} r={0.015} fill={farbe.dunkel} opacity={0.6} />
        <circle cx={0.25} cy={0.05} r={0.012} fill="#ffffff" opacity={0.35} />
        <circle cx={0.33} cy={0.22} r={0.014} fill={farbe.dunkel} opacity={0.5} />
        <circle cx={0.15} cy={0.3} r={0.012} fill="#ffffff" opacity={0.3} />
        <circle cx={0.36} cy={0.36} r={0.01} fill={farbe.dunkel} opacity={0.45} />
      </pattern>
    );
  }
  if (farbe.art === 'wand') {
    // Fassade: Klinker = Läuferverband; Putz = fast glatt mit leichter Struktur
    if (farbe.id === 'klinker') {
      return (
        <pattern id={id} width={0.48} height={0.14} patternUnits="userSpaceOnUse">
          <rect width={0.48} height={0.14} fill={farbe.fill} />
          <line x1={0} y1={0.07} x2={0.48} y2={0.07} stroke="#d8d2c8" strokeWidth={0.012} />
          <line x1={0} y1={0.14} x2={0.48} y2={0.14} stroke="#d8d2c8" strokeWidth={0.012} />
          <line x1={0.24} y1={0} x2={0.24} y2={0.07} stroke="#d8d2c8" strokeWidth={0.012} />
          <line x1={0} y1={0.07} x2={0} y2={0.14} stroke="#d8d2c8" strokeWidth={0.012} />
          <line x1={0.48} y1={0.07} x2={0.48} y2={0.14} stroke="#d8d2c8" strokeWidth={0.012} />
        </pattern>
      );
    }
    return (
      <pattern id={id} width={0.5} height={0.5} patternUnits="userSpaceOnUse">
        <rect width={0.5} height={0.5} fill={farbe.fill} />
        <circle cx={0.12} cy={0.18} r={0.02} fill={farbe.dunkel} opacity={0.15} />
        <circle cx={0.38} cy={0.4} r={0.025} fill={farbe.dunkel} opacity={0.12} />
        <circle cx={0.3} cy={0.08} r={0.018} fill="#ffffff" opacity={0.2} />
      </pattern>
    );
  }
  // Betonziegel / engobiert: rechteckige Pfannen, halbversetzt
  return (
    <pattern id={id} width={0.6} height={0.84} patternUnits="userSpaceOnUse">
      <rect width={0.6} height={0.84} fill={farbe.fill} />
      {/* Reihe 1 */}
      <line x1={0} y1={0.4} x2={0.6} y2={0.4} stroke={farbe.dunkel} strokeWidth={0.03} />
      <line x1={0.3} y1={0} x2={0.3} y2={0.4} stroke={farbe.dunkel} strokeWidth={0.012} opacity={0.6} />
      {/* Reihe 2, halbversetzt */}
      <line x1={0} y1={0.82} x2={0.6} y2={0.82} stroke={farbe.dunkel} strokeWidth={0.03} />
      <line x1={0} y1={0.42} x2={0} y2={0.82} stroke={farbe.dunkel} strokeWidth={0.012} opacity={0.6} />
      <line x1={0.6} y1={0.42} x2={0.6} y2={0.82} stroke={farbe.dunkel} strokeWidth={0.012} opacity={0.6} />
    </pattern>
  );
}

/**
 * Pointer-Gesten aufs SVG verdrahten: setPointerCapture, damit ein Zieh-Vorgang
 * auch dann sauber endet, wenn der Zeiger die Fläche verlässt. `zuM` bildet den
 * Event auf Flächen-Meter ab (Draufsicht: viewBox, Foto: inverse Homographie).
 */
function pointerHandler(
  p: PointerProps,
  zuM: (e: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) => PunktM | null,
) {
  return {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      const m = zuM(e);
      if (!m) return;
      // Erst die Geste starten, dann Capture versuchen: setPointerCapture wirft
      // NotFoundError, wenn der Pointer nicht (mehr) aktiv ist — das darf das
      // Ziehen nicht verhindern.
      p.onDownM(m);
      try {
        e.currentTarget.setPointerCapture(e.pointerId); // Zeiger darf die Fläche verlassen
      } catch {
        // ohne Capture endet die Geste über pointerup/-cancel — gut genug
      }
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => p.onMoveM(zuM(e)),
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => {
      const m = zuM(e);
      if (m) p.onUpM(m);
      else p.onMoveM(null);
    },
    onPointerCancel: () => p.onMoveM(null),
  };
}

/**
 * Kanonisches Modul-Asset (SPEC §11.2, von Genrih geliefert) als <g> in <defs>.
 * Wird per <use transform="matrix(...)"> je Modul instanziert — in Draufsicht
 * (Meter-Koordinaten) UND Foto (Homographie-projizierte Ecken), damit ein Modul
 * überall wie ein Modul aussieht und nicht wie ein schwarzes Rechteck.
 */
export function ModulAsset({ id, modul }: { id: string; modul: ModuleType }) {
  return <g id={id} dangerouslySetInnerHTML={{ __html: modulAssetInner(modul.renderSymbol) }} />;
}

/**
 * Zeichnet die Module eines Rasters perspektivisch über eine Homographie
 * (Fläche→Foto-Pixel) — jedes Modul als in zwei Dreiecke geteiltes, exakt
 * eingepasstes Asset (kein CSS-3D). Herausgelöst aus dem Einzelfoto-Zweig, damit
 * die Gesamtansicht (mehrere Flächen auf EINEM Foto) exakt dieselbe Darstellung
 * nutzt. Erwartet ein `<ModulAsset id={assetId}>` in den <defs> des umgebenden SVG.
 */
export function moduleAufHomographie({
  h,
  raster,
  flaeche,
  assetId,
  fotoBreitePx,
  druck,
  toggle,
  hervorheben,
  clipIdPrefix,
}: {
  h: Homographie;
  raster: BelegungRaster;
  flaeche: Flaeche;
  assetId: string;
  fotoBreitePx: number;
  druck?: boolean;
  toggle?: (key: string) => void;
  /** Diese Module (keys aus posKey) umranden. */
  hervorheben?: Hervorheben;
  /**
   * Pro SVG-Instanz eindeutig. SVG-IDs gelten dokumentweit; ohne Präfix können
   * Vorschau und Editor gegenseitig ihre Dreiecks-Clips verwenden.
   */
  clipIdPrefix: string;
}) {
  const rechteck = (x: number, y: number, w: number, hh: number): Punkt[] => [
    [x, y],
    [x + w, y],
    [x + w, y + hh],
    [x, y + hh],
  ];
  return raster.positionen.map((p) => {
    const key = posKey(p);
    const aus = flaeche.inaktiv.includes(key);
    if (aus && druck) return null; // deaktivierte Module im Druck weglassen
    // Modulmaße/Ausrichtung je Position (bei gemischten Bändern verschieden).
    const mB = p.wM;
    const mH = p.hM;
    // Sichtbares Modul und Fußabdruck verwenden exakt dieselben homographisch
    // projizierten Ecken. Eine modulweise Parallelogramm-Glättung ist hier
    // absichtlich verboten: Sie verschiebt benachbarte Reihen unterschiedlich,
    // öffnet Fugen und kann Module sogar über den markierten Dachrand schieben.
    const TL = projiziere(h, [p.xM, p.yM]);
    const TR = projiziere(h, [p.xM + mB, p.yM]);
    const BR = projiziere(h, [p.xM + mB, p.yM + mH]);
    const BL = projiziere(h, [p.xM, p.yM + mH]);
    // Gauben sind laut Datenmodell eigenständige Ebenen. Ihre meist stärkere
    // Perspektive wird mit einem feineren Netz gerendert; normale Dachflächen
    // benötigen nur die beiden exakt aneinanderliegenden Dreiecke.
    const dreiecke = flaeche.gaubenTyp
      ? modulMatrixNetz(TL, TR, BR, BL, p.quer)
      : modulMatrixDreiecke(TL, TR, BR, BL, p.quer);
    return (
      <g
        key={key}
        opacity={aus ? 0.3 : 1}
        className={toggle ? 'cursor-pointer' : undefined}
        onClick={toggle ? () => toggle(key) : undefined}
      >
        {flaeche.gaubenTyp && (
          <path
            d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))}
            fill="#08090b"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {dreiecke.map((dr, di) => {
          // ':' aus dem posKey raus — in url(#…)-Referenzen ist es ein Sonderzeichen
          const cid = `clip-${clipIdPrefix}-${flaeche.id}-${key}-${di}`.replace(/[^a-zA-Z0-9_-]/g, '-');
          return (
            <g key={di}>
              <clipPath id={cid} clipPathUnits="userSpaceOnUse">
                <polygon points={dr.clip} />
              </clipPath>
              {/* Clip am transformlosen <g> → in Foto-Pixeln; <use> transformiert innen */}
              <g clipPath={`url(#${cid})`}>
                <use href={`#${assetId}`} transform={dr.matrix} />
              </g>
            </g>
          );
        })}
        {/* Ost-West-Zelt: Westhälfte leicht abschatten, damit man die Kippung sieht */}
        {p.seite === 'west' && (
          <path
            d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))}
            fill="rgba(0,0,0,0.22)"
            style={{ pointerEvents: 'none' }}
          />
        )}
        <path d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))} fill="transparent" />
        {aus && (
          <path
            d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))}
            fill="none"
            stroke="#ffffff"
            strokeWidth={fotoBreitePx * 0.0015}
            strokeDasharray={`${fotoBreitePx * 0.006} ${fotoBreitePx * 0.004}`}
          />
        )}
        {hervorheben?.keys.includes(key) && (
          <path
            d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))}
            fill="none"
            stroke={hervorheben.farbe ?? '#e8603a'}
            strokeWidth={fotoBreitePx * 0.004}
          />
        )}
      </g>
    );
  });
}

export function DachSvg({
  flaeche,
  raster,
  modul,
  onToggle,
  zeichnen,
  druck,
  masse = true,
  hervorheben,
  felderAnzeige,
  feldVorschau,
  geister,
  pointer,
  fotoOverlay,
  maxHoehe,
}: {
  flaeche: Flaeche;
  raster: BelegungRaster;
  modul: ModuleType;
  onToggle?: (key: string) => void;
  zeichnen?: ZeichnenProps;
  /** Druck/PDF: nur Foto + Module, keine Markierungs-Overlays (Umriss/Hindernis/
   *  Randlinie), deaktivierte Module ausblenden — soll realistisch aussehen. */
  druck?: boolean;
  /** Maßketten (Traufe/Sparren/Umriss) einblenden — im Skizzierer umschaltbar,
   *  im Druck ohnehin immer aus. Default an. */
  masse?: boolean;
  /** Module (keys aus posKey) umranden. */
  hervorheben?: Hervorheben;
  /** Belegungsfelder umranden (gestrichelt; ausgewählte kräftig). Nie im Druck. */
  felderAnzeige?: FeldAnzeige[];
  /** Live-Vorschau beim Aufziehen eines Felds. Nie im Druck. */
  feldVorschau?: FeldVorschau | null;
  /** Abgeschaltete Module als klickbare Geister (Modus „Module an/aus"). Nie im Druck. */
  geister?: GeistPosition[];
  /** Zeiger-Gesten (Feld aufziehen/verschieben). Schließt `zeichnen` aus. */
  pointer?: PointerProps;
  /** Weitere Flächen desselben Projektfotos, hinter der aktiven Fläche. */
  fotoOverlay?: (clipIdPrefix: string) => ReactNode;
  /** Maximale Editorhöhe in px; der Belegungsschritt darf den verfügbaren Platz ausnutzen. */
  maxHoehe?: number;
}) {
  // Dasselbe Dach kann gleichzeitig in Foto-Vorschau, Editor und PDF-Vorschau
  // vorkommen. Reacts useId trennt die dokumentweit geltenden SVG-Clip-IDs.
  const svgInstanzId = useId().replace(/[^a-zA-Z0-9_-]/g, '-');
  // B = RAHMENbreite (bei 'schief' > Traufe): viewBox, Klick-Mapping, Homographie-
  // Quelle und Rand-Rechteck rechnen alle im Rahmen, damit die schiefe Fläche passt.
  const B = rahmenBreiteVon(flaeche);
  const H = flaeche.hoeheM;
  const farbe = DACHFARBEN.find((d) => d.id === flaeche.dachfarbe) ?? DACHFARBEN[1];
  const assetId = `modul-${flaeche.id}`;
  const patId = `pat-${flaeche.id}-${farbe.id}`;
  // Während des Zeichnens gehen Klicks an den Zeichenmodus, nicht ans Modul-Toggle
  const toggle = zeichnen?.aktiv ? undefined : onToggle;
  const umrissEff = umrissVon(flaeche);
  const umriss = umrissEff && umrissEff.length >= 3 ? umrissEff : null;
  const hindernisse = hindernisseVon(flaeche) ?? [];
  const draft = zeichnen?.punkteM ?? [];

  /**
   * Maßketten (Genrih 07.07.): Kantenlängen einblenden, damit die digitale Fläche
   * gegen das Aufmaß abgeglichen werden kann — besonders beim Skizzieren mehrerer
   * Flächen. Basis-Maße (Traufe/Sparren) dunkel als Referenz, gezeichnete Umriss-
   * und Draft-Kanten orange (passend zum Umriss-Overlay). `project` bildet Flächen-
   * Koordinaten (Meter) in den Zielraum ab (Draufsicht = identisch, Foto = Homographie);
   * so ist derselbe Code für beide Ansichten nutzbar. Reiner Text, kein Solver.
   */
  const traufeKante: [PunktM, PunktM] = [[0, H], [B, H]];
  const sparrenKante: [PunktM, PunktM] = [[0, 0], [0, H]];
  // Basis-Maße (Traufe/Sparren) nur ohne Umriss — bei gezeichnetem Umriss sprechen
  // dessen Kantenlängen für sich (sonst liegt „6 m" auf „5,02 m").
  const basisKanten: [PunktM, PunktM][] = umriss ? [] : [traufeKante, sparrenKante];
  const umrissKanten: [PunktM, PunktM][] = umriss
    ? umriss.map((p, i) => [p, umriss[(i + 1) % umriss.length]!] as [PunktM, PunktM])
    : [];
  const draftKanten: [PunktM, PunktM][] = draft
    .slice(0, -1)
    .map((p, i) => [p, draft[i + 1]!] as [PunktM, PunktM]);

  // Label leicht von der Kante zur Flächenmitte ziehen (in Meter, VOR der Projektion),
  // damit Basis-Maße nicht am Rahmenrand abgeschnitten werden und sich Basis- und
  // Umriss-Kanten nicht überlagern.
  const insetM = Math.min(0.4, 0.08 * Math.min(B, H));
  const renderMasse = (font: number, project: (p: PunktM) => readonly [number, number]) => {
    const kette = (kanten: [PunktM, PunktM][], farbe: string, pre: string) =>
      kanten.map(([a, b], i) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.05) return null; // zu kurz zum Beschriften
        let ax = (a[0] + b[0]) / 2;
        let ay = (a[1] + b[1]) / 2;
        const dx = B / 2 - ax;
        const dy = H / 2 - ay;
        const d = Math.hypot(dx, dy) || 1;
        ax += (dx / d) * insetM;
        ay += (dy / d) * insetM;
        const [mx, my] = project([ax, ay]);
        return (
          <text
            key={`${pre}${i}`}
            x={mx}
            y={my}
            fontSize={font}
            textAnchor="middle"
            dominantBaseline="central"
            fill={farbe}
            stroke="#ffffff"
            strokeWidth={font * 0.32}
            paintOrder="stroke"
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {fmtDe(len, 2)} m
          </text>
        );
      });
    return (
      <>
        {kette(basisKanten, '#0f172a', 'b')}
        {kette(umrissKanten, '#c2410c', 'u')}
        {kette(draftKanten, '#c2410c', 'd')}
      </>
    );
  };

  /** Overlay in Flächen-Koordinaten (Meter) — gilt für Draufsicht UND Alt-Foto-Ansicht */
  const overlayM = (
    <>
      {umriss && (
        <path
          d={`M${umriss.map(([x, y]) => `${x} ${y}`).join('L')}Z`}
          fill="none"
          stroke="#f97316"
          strokeWidth={0.05}
          strokeDasharray="0.2 0.12"
        />
      )}
      {hindernisse.map((h, i) => (
        <rect
          key={i}
          x={h.xM}
          y={h.yM}
          width={h.breiteM}
          height={h.hoeheM}
          fill="rgba(239,68,68,0.35)"
          stroke="#ef4444"
          strokeWidth={0.03}
        />
      ))}
      {draft.length >= 2 && (
        <polyline
          points={draft.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="#f97316"
          strokeWidth={0.04}
          strokeDasharray="0.12 0.08"
        />
      )}
      {draft.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.12} fill="#f97316" stroke="#fff" strokeWidth={0.03} />
      ))}
    </>
  );

  /**
   * Feld/Griff dürfen den Cursor setzen — die Zeiger-Events bubbeln danach ohnehin
   * zum SVG hoch, wo die Gesten hängen. NUR im Felder-Werkzeug: sonst (z. B.
   * „Module an/aus") würden die Overlays die Modul-Klicks abfangen.
   */
  const overlayZeiger = (cursor: string) =>
    pointer ? { style: { cursor } } : { style: { pointerEvents: 'none' as const } };

  /** Belegungsfeld-Overlay in Flächen-Metern (Draufsicht/Alt-Foto). */
  const felderM = druck ? null : (
    <g>
      {/* Abgeschaltete Module: klickbar, damit man sie EINZELN zurückholen kann */}
      {(geister ?? []).map((g) => (
        <g
          key={g.key}
          className={toggle ? 'cursor-pointer' : undefined}
          onClick={toggle ? () => toggle(g.key) : undefined}
        >
          <rect
            x={g.xM}
            y={g.yM}
            width={g.wM}
            height={g.hM}
            fill="rgba(15,23,42,0.10)"
            stroke="#0f172a"
            strokeWidth={0.03}
            strokeDasharray="0.1 0.08"
            strokeOpacity={0.6}
          />
        </g>
      ))}
      {(felderAnzeige ?? []).map((fa, i) => (
        <g key={i}>
          <rect
            x={fa.rect.xM}
            y={fa.rect.yM}
            width={fa.rect.breiteM}
            height={fa.rect.hoeheM}
            fill="rgba(2,132,199,0.06)"
            stroke="#0284c7"
            strokeWidth={fa.ausgewaehlt ? 0.08 : 0.04}
            strokeDasharray={fa.ausgewaehlt ? undefined : '0.15 0.1'}
            {...overlayZeiger('move')}
          />
          {/* Griffe: nur am ausgewählten Feld — daran zieht man die Größe */}
          {fa.ausgewaehlt &&
            griffPunkte(fa.rect).map(({ id, p }) => (
              <rect
                key={id}
                x={p[0] - 0.11}
                y={p[1] - 0.11}
                width={0.22}
                height={0.22}
                rx={0.04}
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth={0.05}
                {...overlayZeiger(GRIFF_CURSOR[id])}
              />
            ))}
        </g>
      ))}
      {feldVorschau && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={feldVorschau.rect.xM}
            y={feldVorschau.rect.yM}
            width={feldVorschau.rect.breiteM}
            height={feldVorschau.rect.hoeheM}
            fill="rgba(2,132,199,0.15)"
            stroke="#0284c7"
            strokeWidth={0.06}
            strokeDasharray="0.15 0.1"
          />
          <text
            x={feldVorschau.rect.xM + feldVorschau.rect.breiteM / 2}
            y={feldVorschau.rect.yM + feldVorschau.rect.hoeheM / 2}
            fontSize={0.4}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth={0.12}
            paintOrder="stroke"
            fontWeight={700}
          >
            {feldVorschau.anzahl}
          </text>
        </g>
      )}
    </g>
  );

  // Belegung in Flächen-Koordinaten (Meter) — identisch für beide Hintergründe
  const belegung = (
    <>
      {!druck && (
        <rect
          x={raster.randM}
          y={raster.randM}
          width={B - 2 * raster.randM}
          height={H - 2 * raster.randM}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={0.015}
          strokeDasharray="0.12 0.1"
        />
      )}
      {raster.positionen.map((p) => {
        const key = posKey(p);
        const aus = flaeche.inaktiv.includes(key);
        if (aus && druck) return null; // deaktivierte Module im Druck weglassen
        const mB = p.wM; // Modulmaße je Position (je Feld verschieden)
        const mH = p.hM;
        const TL: Punkt = [p.xM, p.yM];
        const TR: Punkt = [p.xM + mB, p.yM];
        const BL: Punkt = [p.xM, p.yM + mH];
        return (
          <g
            key={key}
            opacity={aus ? 0.25 : 1}
            className={toggle ? 'cursor-pointer' : undefined}
            onClick={toggle ? () => toggle(key) : undefined}
          >
            <use href={`#${assetId}`} transform={modulMatrix(TL, TR, BL, p.quer)} />
            {/* Ost-West-Zelt: Westhälfte leicht abschatten (Kippung sichtbar) */}
            {p.seite === 'west' && (
              <rect
                x={p.xM}
                y={p.yM}
                width={mB}
                height={mH}
                fill="rgba(0,0,0,0.22)"
                style={{ pointerEvents: 'none' }}
              />
            )}
            <rect x={p.xM} y={p.yM} width={mB} height={mH} fill="transparent" />
            {aus && (
              <rect
                x={p.xM}
                y={p.yM}
                width={mB}
                height={mH}
                fill="none"
                stroke="#ffffff"
                strokeWidth={0.02}
                strokeDasharray="0.08 0.06"
              />
            )}
            {hervorheben?.keys.includes(key) && (
              <rect x={p.xM} y={p.yM} width={mB} height={mH} fill="none" stroke={hervorheben.farbe ?? '#e8603a'} strokeWidth={0.06} />
            )}
          </g>
        );
      })}
      {!druck && overlayM}
      {felderM}
    </>
  );

  const foto = flaeche.foto;
  if (foto?.eckenPx) {
    // Perspektivischer Modus: 4 markierte Ecken → Homographie Fläche→Foto.
    // Jedes Modul wird als projiziertes Viereck gezeichnet (LoD vereinfacht,
    // SPEC §11.2) — Maße weiterhin aus dem Engine-Raster, nie aus dem Foto.
    const h = homographie(B, H, foto.eckenPx, perspektiveQuelle(flaeche));
    if (h) {
      const rechteck = (x: number, y: number, w: number, hh: number): Punkt[] => [
        [x, y],
        [x + w, y],
        [x + w, y + hh],
        [x, y + hh],
      ];
      const eventZuMRoh = (e: {
        clientX: number;
        clientY: number;
        currentTarget: SVGSVGElement;
      }): PunktM | null => {
        const inv = inverseHomographie(B, H, foto.eckenPx!, perspektiveQuelle(flaeche));
        if (!inv) return null;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const px = ((e.clientX - rect.left) / rect.width) * foto.breitePx;
        const py = ((e.clientY - rect.top) / rect.height) * foto.hoehePx;
        const [xM, yM] = projiziere(inv, [px, py]);
        return [xM, yM];
      };
      // Geklemmt NUR fürs Zeichnen (Umriss-/Hindernis-Punkte gehören auf die Fläche).
      // Zieh-GESTEN brauchen die rohe Position: geklemmt könnte man ein randnahes
      // Feld nie über den Rand ziehen — der Zug „endete" an der Dachkante und das
      // Einrasten der linken/oberen Kante kam nie über einen halben Pitch (Bug 16.07.).
      const eventZuM = (e: Parameters<typeof eventZuMRoh>[0]): PunktM | null => {
        const p = eventZuMRoh(e);
        return p ? [Math.max(0, Math.min(B, p[0])), Math.max(0, Math.min(H, p[1]))] : null;
      };
      const klickM = zeichnen?.aktiv
        ? (e: React.MouseEvent<SVGSVGElement>) => {
            const p = eventZuM(e);
            if (p) zeichnen.onKlickM(p);
          }
        : undefined;
      const moveM = zeichnen?.aktiv && zeichnen.onMoveM
        ? (e: React.MouseEvent<SVGSVGElement>) => zeichnen.onMoveM!(eventZuM(e))
        : undefined;
      const zeiger = pointer ? pointerHandler(pointer, eventZuMRoh) : undefined;
      return (
        <div
          className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
          style={{
            aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`,
            maxHeight: maxHoehe ?? 480,
            maxWidth: ((maxHoehe ?? 480) * foto.breitePx) / foto.hoehePx,
          }}
        >
          <svg
            viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
            className={`block h-full w-full ${zeichnen?.aktiv ? 'cursor-crosshair' : ''}`}
            preserveAspectRatio="xMidYMid meet"
            style={pointer ? { touchAction: 'none' } : undefined}
            onClick={klickM}
            onMouseMove={moveM}
            onMouseLeave={moveM ? () => zeichnen!.onMoveM!(null) : undefined}
            {...zeiger}
          >
            <defs>
              <ModulAsset id={assetId} modul={modul} />
            </defs>
            <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
            {fotoOverlay?.(`${svgInstanzId}-overlay`)}
            {moduleAufHomographie({
              h,
              raster,
              flaeche,
              assetId,
              fotoBreitePx: foto.breitePx,
              druck,
              toggle,
              hervorheben,
              clipIdPrefix: `${svgInstanzId}-aktiv`,
            })}
            {/* Abgeschaltete Module (Geister) — klickbar zum einzelnen Zurückholen */}
            {!druck &&
              (geister ?? []).map((g) => (
                <path
                  key={g.key}
                  d={projPfad(h, rechteck(g.xM, g.yM, g.wM, g.hM))}
                  fill="rgba(15,23,42,0.18)"
                  stroke="#ffffff"
                  strokeWidth={foto.breitePx * 0.002}
                  strokeDasharray={`${foto.breitePx * 0.006} ${foto.breitePx * 0.004}`}
                  className={toggle ? 'cursor-pointer' : undefined}
                  onClick={toggle ? () => toggle(g.key) : undefined}
                />
              ))}
            {/* Belegungsfelder perspektivisch (gleiche Homographie wie die Module) */}
            {!druck && (
              <g>
                {(felderAnzeige ?? []).map((fa, i) => (
                  <g key={i}>
                    <path
                      d={projPfad(
                        h,
                        rechteck(fa.rect.xM, fa.rect.yM, fa.rect.breiteM, fa.rect.hoeheM),
                      )}
                      fill="rgba(2,132,199,0.06)"
                      stroke="#0284c7"
                      strokeWidth={foto.breitePx * (fa.ausgewaehlt ? 0.004 : 0.002)}
                      strokeDasharray={
                        fa.ausgewaehlt
                          ? undefined
                          : `${foto.breitePx * 0.008} ${foto.breitePx * 0.005}`
                      }
                      {...overlayZeiger('move')}
                    />
                    {/* Griffe am ausgewählten Feld — an die projizierten Ecken gesetzt */}
                    {fa.ausgewaehlt &&
                      griffPunkte(fa.rect).map(({ id, p }) => {
                        const [gx, gy] = projiziere(h, [p[0], p[1]]);
                        const r = foto.breitePx * 0.008;
                        return (
                          <rect
                            key={id}
                            x={gx - r}
                            y={gy - r}
                            width={r * 2}
                            height={r * 2}
                            rx={r * 0.3}
                            fill="#ffffff"
                            stroke="#0284c7"
                            strokeWidth={foto.breitePx * 0.002}
                            {...overlayZeiger(GRIFF_CURSOR[id])}
                          />
                        );
                      })}
                  </g>
                ))}
                {feldVorschau && (
                  <g style={{ pointerEvents: 'none' }}>
                    <path
                      d={projPfad(
                        h,
                        rechteck(
                          feldVorschau.rect.xM,
                          feldVorschau.rect.yM,
                          feldVorschau.rect.breiteM,
                          feldVorschau.rect.hoeheM,
                        ),
                      )}
                      fill="rgba(2,132,199,0.15)"
                      stroke="#0284c7"
                      strokeWidth={foto.breitePx * 0.003}
                      strokeDasharray={`${foto.breitePx * 0.008} ${foto.breitePx * 0.005}`}
                    />
                    {(() => {
                      const [mx, my] = projiziere(h, [
                        feldVorschau.rect.xM + feldVorschau.rect.breiteM / 2,
                        feldVorschau.rect.yM + feldVorschau.rect.hoeheM / 2,
                      ]);
                      return (
                        <text
                          x={mx}
                          y={my}
                          fontSize={foto.breitePx * 0.035}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          stroke="#0f172a"
                          strokeWidth={foto.breitePx * 0.008}
                          paintOrder="stroke"
                          fontWeight={700}
                        >
                          {feldVorschau.anzahl}
                        </text>
                      );
                    })()}
                  </g>
                )}
              </g>
            )}
            {/* Markierungs-Overlays (Umriss/Hindernisse/Draft) — im Druck NICHT anzeigen */}
            {!druck && umriss && (
              <path
                d={projPfad(h, umriss.map(([x, y]) => [x, y] as Punkt))}
                fill="none"
                stroke="#f97316"
                strokeWidth={foto.breitePx * 0.002}
                strokeDasharray={`${foto.breitePx * 0.01} ${foto.breitePx * 0.006}`}
              />
            )}
            {!druck &&
              hindernisse.map((hi, i) => (
                <path
                  key={i}
                  d={projPfad(h, rechteck(hi.xM, hi.yM, hi.breiteM, hi.hoeheM))}
                  fill="rgba(239,68,68,0.35)"
                  stroke="#ef4444"
                  strokeWidth={foto.breitePx * 0.0015}
                />
              ))}
            {!druck && draft.length >= 2 && (
              <polyline
                points={draft
                  .map(([x, y]) => projiziere(h, [x, y]).map((n) => n.toFixed(2)).join(','))
                  .join(' ')}
                fill="none"
                stroke="#f97316"
                strokeWidth={foto.breitePx * 0.002}
                strokeDasharray={`${foto.breitePx * 0.008} ${foto.breitePx * 0.005}`}
              />
            )}
            {!druck &&
              draft.map(([x, y], i) => {
                const [px, py] = projiziere(h, [x, y]);
                return (
                  <circle
                    key={i}
                    cx={px}
                    cy={py}
                    r={foto.breitePx * 0.007}
                    fill="#f97316"
                    stroke="#ffffff"
                    strokeWidth={foto.breitePx * 0.002}
                  />
                );
              })}
            {!druck && masse && renderMasse(foto.breitePx * 0.02, (p) => projiziere(h, [p[0], p[1]]))}
          </svg>
        </div>
      );
    }
  }
  if (foto?.traufePx) {
    // Drohnenfoto-Modus: Traufkante im Foto = Referenzstrecke mit wahrem Maß
    // breiteM → Maßstab px/m + Rotation. Sparrenrichtung um cos(Neigung)
    // verkürzt (Draufsicht-Projektion — reine Komposition, kein Solver).
    const [x1, y1, x2, y2] = foto.traufePx;
    const traufePxLaenge = Math.hypot(x2 - x1, y2 - y1);
    // Maßstab: aus Ziegelzählung (falls gesetzt), sonst Trauflänge = breiteM
    const pxProM = foto.pxProM ?? traufePxLaenge / B;
    const winkelDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const cosNeigung = Math.cos((flaeche.neigungDeg * Math.PI) / 180);
    return (
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
          className="block h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <ModulAsset id={assetId} modul={modul} />
          </defs>
          <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
          <g
            transform={`translate(${x1} ${y1}) rotate(${winkelDeg}) scale(${pxProM}) scale(1 ${cosNeigung}) translate(0 ${-H})`}
          >
            {belegung}
          </g>
        </svg>
      </div>
    );
  }

  // Draufsicht: die viewBox IST das Flächen-Koordinatensystem (Meter) — Event-Pixel
  // nur über das Bounding-Rect skalieren, kein Solver (SPEC §3.5).
  const draufsichtZuMRoh = (e: {
    clientX: number;
    clientY: number;
    currentTarget: SVGSVGElement;
  }): PunktM | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null; // 0×0-Viewport (Preview-Falle)
    return [((e.clientX - rect.left) / rect.width) * B, ((e.clientY - rect.top) / rect.height) * H];
  };
  // Geklemmt nur fürs ZEICHNEN; Zieh-Gesten brauchen die rohe Position (sonst kann
  // ein randnahes Feld nie über den Flächenrand gezogen/vergrößert werden, 16.07.).
  const draufsichtZuM = (e: Parameters<typeof draufsichtZuMRoh>[0]): PunktM | null => {
    const p = draufsichtZuMRoh(e);
    return p ? [Math.max(0, Math.min(B, p[0])), Math.max(0, Math.min(H, p[1]))] : null;
  };
  const zeigerDraufsicht = pointer ? pointerHandler(pointer, draufsichtZuMRoh) : undefined;

  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
      style={{
        aspectRatio: `${B} / ${H}`,
        maxHeight: maxHoehe ?? 420,
        maxWidth: ((maxHoehe ?? 420) * B) / H,
      }}
    >
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className={`block h-full w-full ${zeichnen?.aktiv ? 'cursor-crosshair' : ''}`}
        preserveAspectRatio="xMidYMid meet"
        style={pointer ? { touchAction: 'none' } : undefined}
        onClick={
          zeichnen?.aktiv
            ? (e) => {
                const p = draufsichtZuM(e);
                if (p) zeichnen.onKlickM(p);
              }
            : undefined
        }
        onMouseMove={
          zeichnen?.aktiv && zeichnen.onMoveM
            ? (e) => zeichnen.onMoveM!(draufsichtZuM(e))
            : undefined
        }
        onMouseLeave={zeichnen?.aktiv && zeichnen.onMoveM ? () => zeichnen.onMoveM!(null) : undefined}
        {...zeigerDraufsicht}
      >
        <defs>
          <ModulAsset id={assetId} modul={modul} />
          <DachPattern id={patId} farbe={farbe} />
        </defs>
        <rect width={B} height={H} fill={`url(#${patId})`} />
        {belegung}
        {!druck && masse && renderMasse(0.3, (p) => p)}
      </svg>
    </div>
  );
}
