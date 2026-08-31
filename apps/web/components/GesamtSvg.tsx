'use client';

import { memo, useId } from 'react';
import { homographie } from '../lib/foto-geometrie';
import {
  modulById,
  fotoZuordnungVon,
  perspektiveQuelle,
  rahmenBreiteVon,
  rasterFuer,
  zonenVon,
  type ProjektFoto,
  type Projekt,
} from '../lib/model';
import {
  ModulAsset,
  moduleAufHomographie,
  type FotoModulDarstellung,
} from './DachSvg';

/**
 * Reine Darstellung aller zugeordneten Flächen auf einem Projektfoto, ohne
 * Bedien-Overlays. Fotoübersicht und PDF-Export verwenden dieselbe Optik.
 */

export const FOTO_ASSET_ID = 'foto-gruppe-modul';

/**
 * Alle belegten Flächen, die dem angegebenen Projektfoto zugeordnet sind.
 * Wird im aktiven Belegungseditor (andere Flächen im Hintergrund) und im
 * PDF-Export verwendet. Die aktive Fläche kann ausgeblendet werden, weil
 * DachSvg sie mit ihren interaktiven Overlays selbst rendert.
 */
export function fotoFlaechenInhalt({
  projekt,
  foto,
  ausblendenId,
  beschriftung = true,
  assetId = FOTO_ASSET_ID,
  nurFertige = false,
  clipIdPrefix,
  modulDarstellung = 'detail',
}: {
  projekt: Projekt;
  foto: ProjektFoto;
  ausblendenId?: string | null;
  beschriftung?: boolean;
  assetId?: string;
  /** PDF: nur vollständig abgeschlossene Foto-Markierungen ausgeben. */
  nurFertige?: boolean;
  /** Pro umgebender SVG-Instanz eindeutig (SVG-Clip-IDs gelten dokumentweit). */
  clipIdPrefix: string;
  /** Leichtere Darstellung ausschliesslich fuer interaktive Foto-Vorschauen. */
  modulDarstellung?: FotoModulDarstellung;
}) {
  const modul = modulById(projekt.modulId);
  const px = (v: number) => foto.breitePx * v;
  return projekt.flaechen.map((f, i) => {
    const z = fotoZuordnungVon(f, foto.id);
    if (
      !z?.eckenPx ||
      z.fotoId !== foto.id ||
      f.id === ausblendenId ||
      (nurFertige && !z.markierungFertig)
    ) return null;
    const h = homographie(rahmenBreiteVon(f), f.hoeheM, z.eckenPx, perspektiveQuelle(f));
    if (!h) return null;
    const raster = rasterFuer(f, modul);
    const mitte = z.eckenPx.reduce<[number, number]>(
      (a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4],
      [0, 0],
    );
    return (
      <g key={f.id} opacity={ausblendenId ? 0.72 : 1}>
        {beschriftung && (
          <polygon
            points={z.eckenPx.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="rgba(249,115,22,0.025)"
            stroke="#fb923c"
            strokeWidth={px(0.003)}
            strokeLinejoin="round"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {moduleAufHomographie({
          h,
          raster,
          flaeche: f,
          assetId,
          fotoBreitePx: foto.breitePx,
          druck: true,
          clipIdPrefix: `${clipIdPrefix}-${f.id}`,
          darstellung: modulDarstellung,
        })}
        {beschriftung && (
          <g style={{ pointerEvents: 'none' }}>
            <circle
              cx={mitte[0]}
              cy={mitte[1]}
              r={px(0.024)}
              fill="#f97316"
              stroke="#ffffff"
              strokeWidth={px(0.003)}
            />
            <text
              x={mitte[0]}
              y={mitte[1]}
              fontSize={px(0.027)}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontWeight={700}
            >
              {zonenVon(f, i)}
            </text>
          </g>
        )}
      </g>
    );
  });
}

/** Vollständiges SVG genau einer Foto-Gruppe für PDF und Vorschau. */
export const ProjektFotoSvg = memo(function ProjektFotoSvg({
  projekt,
  foto,
  beschriftung = false,
  nurFertige = false,
}: {
  projekt: Projekt;
  foto: ProjektFoto;
  /** Für die Belegungsverwaltung: Flächenrahmen und A/B/C einblenden. */
  beschriftung?: boolean;
  /** Für den PDF-Export: keine noch laufenden Markierungen rendern. */
  nurFertige?: boolean;
}) {
  const modul = modulById(projekt.modulId);
  const svgInstanzId = useId().replace(/[^a-zA-Z0-9_-]/g, '-');
  return (
    <svg
      viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
    >
      <defs>
        <ModulAsset id={FOTO_ASSET_ID} modul={modul} />
      </defs>
      <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
      {fotoFlaechenInhalt({
        projekt,
        foto,
        beschriftung,
        nurFertige,
        clipIdPrefix: `${svgInstanzId}-foto`,
      })}
    </svg>
  );
});
