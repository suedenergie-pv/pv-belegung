'use client';

import type { BelegungRaster, ModuleType } from '@pv-belegung/engine';
import {
  homographie,
  inverseHomographie,
  projiziere,
  projPfad,
  type Homographie,
  type Punkt,
} from '../lib/foto-geometrie';
import { modulAssetInner, modulMatrix, modulMatrixDreiecke } from '../lib/modul-assets';
import {
  DACHFARBEN,
  fmtDe,
  perspektiveFirstBreite,
  umrissVon,
  type Dachfarbe,
  type Flaeche,
  type PunktM,
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
  hervorhebenKey,
}: {
  h: Homographie;
  raster: BelegungRaster;
  flaeche: Flaeche;
  assetId: string;
  fotoBreitePx: number;
  druck?: boolean;
  toggle?: (key: string) => void;
  /** Dieses Modul (key "row-col") hervorheben (z. B. ausgewähltes Zusatzmodul). */
  hervorhebenKey?: string;
}) {
  const rechteck = (x: number, y: number, w: number, hh: number): Punkt[] => [
    [x, y],
    [x + w, y],
    [x + w, y + hh],
    [x, y + hh],
  ];
  return raster.positionen.map((p) => {
    const key = `${p.row}-${p.col}`;
    const aus = flaeche.inaktiv.includes(key);
    if (aus && druck) return null; // deaktivierte Module im Druck weglassen
    // Modulmaße/Ausrichtung je Position (bei gemischten Bändern verschieden).
    const mB = p.wM;
    const mH = p.hM;
    // Vier Modul-Ecken exakt homographisch projiziert; Asset in ZWEI Dreiecke
    // geteilt und exakt eingepasst → perspektivisch gerade.
    const TL = projiziere(h, [p.xM, p.yM]);
    const TR = projiziere(h, [p.xM + mB, p.yM]);
    const BR = projiziere(h, [p.xM + mB, p.yM + mH]);
    const BL = projiziere(h, [p.xM, p.yM + mH]);
    const dreiecke = modulMatrixDreiecke(TL, TR, BR, BL, p.quer);
    return (
      <g
        key={key}
        opacity={aus ? 0.3 : 1}
        className={toggle ? 'cursor-pointer' : undefined}
        onClick={toggle ? () => toggle(key) : undefined}
      >
        {dreiecke.map((dr, di) => {
          const cid = `clip-${flaeche.id}-${key}-${di}`;
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
        {key === hervorhebenKey && (
          <path
            d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))}
            fill="none"
            stroke="#e8603a"
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
  hervorhebenKey,
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
  /** Modul (key "row-col") hervorheben (z. B. gewähltes Zusatzmodul beim Verschieben). */
  hervorhebenKey?: string;
}) {
  const B = flaeche.breiteM;
  const H = flaeche.hoeheM;
  const farbe = DACHFARBEN.find((d) => d.id === flaeche.dachfarbe) ?? DACHFARBEN[1];
  const assetId = `modul-${flaeche.id}`;
  const patId = `pat-${flaeche.id}-${farbe.id}`;
  // Während des Zeichnens gehen Klicks an den Zeichenmodus, nicht ans Modul-Toggle
  const toggle = zeichnen?.aktiv ? undefined : onToggle;
  const umrissEff = umrissVon(flaeche);
  const umriss = umrissEff && umrissEff.length >= 3 ? umrissEff : null;
  const hindernisse = flaeche.hindernisse ?? [];
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
        const key = `${p.row}-${p.col}`;
        const aus = flaeche.inaktiv.includes(key);
        if (aus && druck) return null; // deaktivierte Module im Druck weglassen
        const mB = p.wM; // Modulmaße je Position (gemischte Bänder)
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
            {key === hervorhebenKey && (
              <rect x={p.xM} y={p.yM} width={mB} height={mH} fill="none" stroke="#e8603a" strokeWidth={0.06} />
            )}
          </g>
        );
      })}
      {!druck && overlayM}
    </>
  );

  const foto = flaeche.foto;
  if (foto?.eckenPx) {
    // Perspektivischer Modus: 4 markierte Ecken → Homographie Fläche→Foto.
    // Jedes Modul wird als projiziertes Viereck gezeichnet (LoD vereinfacht,
    // SPEC §11.2) — Maße weiterhin aus dem Engine-Raster, nie aus dem Foto.
    const h = homographie(B, H, foto.eckenPx, perspektiveFirstBreite(flaeche));
    if (h) {
      const rechteck = (x: number, y: number, w: number, hh: number): Punkt[] => [
        [x, y],
        [x + w, y],
        [x + w, y + hh],
        [x, y + hh],
      ];
      const klickM = zeichnen?.aktiv
        ? (e: React.MouseEvent<SVGSVGElement>) => {
            const inv = inverseHomographie(B, H, foto.eckenPx!, perspektiveFirstBreite(flaeche));
            if (!inv) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const px = ((e.clientX - rect.left) / rect.width) * foto.breitePx;
            const py = ((e.clientY - rect.top) / rect.height) * foto.hoehePx;
            const [xM, yM] = projiziere(inv, [px, py]);
            zeichnen.onKlickM([Math.max(0, Math.min(B, xM)), Math.max(0, Math.min(H, yM))]);
          }
        : undefined;
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
            className={`block h-full w-full ${zeichnen?.aktiv ? 'cursor-crosshair' : ''}`}
            preserveAspectRatio="xMidYMid meet"
            onClick={klickM}
          >
            <defs>
              <ModulAsset id={assetId} modul={modul} />
            </defs>
            <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
            {moduleAufHomographie({
              h,
              raster,
              flaeche,
              assetId,
              fotoBreitePx: foto.breitePx,
              druck,
              toggle,
              hervorhebenKey,
            })}
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

  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
      style={{ aspectRatio: `${B} / ${H}`, maxHeight: 420, maxWidth: (420 * B) / H }}
    >
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className={`block h-full w-full ${zeichnen?.aktiv ? 'cursor-crosshair' : ''}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={
          zeichnen?.aktiv
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                const xM = ((e.clientX - rect.left) / rect.width) * B;
                const yM = ((e.clientY - rect.top) / rect.height) * H;
                zeichnen.onKlickM([Math.max(0, Math.min(B, xM)), Math.max(0, Math.min(H, yM))]);
              }
            : undefined
        }
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
