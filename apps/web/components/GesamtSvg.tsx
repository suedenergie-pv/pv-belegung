'use client';

import { homographie } from '../lib/foto-geometrie';
import {
  modulById,
  perspektiveFirstBreite,
  rasterFuer,
  zonenVon,
  type GesamtFoto,
  type Projekt,
} from '../lib/model';
import { ModulAsset, moduleAufHomographie } from './DachSvg';

/**
 * Reine Darstellung der Gesamtansicht (alle platzierten Flächen auf einem Foto),
 * ohne Bedien-Overlays. Geteilt zwischen dem interaktiven Schritt (SchrittGesamt)
 * und dem PDF-Export (offscreen gerastert) — eine Quelle für die Optik.
 */

export const GESAMT_ASSET_ID = 'gesamt-modul';

/**
 * Die platzierten Flächen (nur die Module) als SVG-Kinder. Kein Umriss-Overlay mehr
 * (die orangen Skizzen-Linien störten in der fertigen Ansicht, Genrih 07.07.). Der
 * A/B/C-Buchstabe ist optional: in der App zur Orientierung an, im PDF aus.
 */
export function gesamtFlaechenInhalt({
  projekt,
  foto,
  ausblendenId,
  beschriftung = true,
}: {
  projekt: Projekt;
  foto: GesamtFoto;
  /** Diese Fläche NICHT rendern (wird gerade neu eingezeichnet). */
  ausblendenId?: string | null;
  /** A/B/C-Buchstabe je Fläche einblenden (App: ja, PDF: nein). */
  beschriftung?: boolean;
}) {
  const modul = modulById(projekt.modulId);
  const px = (v: number) => foto.breitePx * v;
  return projekt.flaechen.map((f, i) => {
    if (!f.gesamtEckenPx || f.id === ausblendenId) return null;
    const h = homographie(f.breiteM, f.hoeheM, f.gesamtEckenPx, perspektiveFirstBreite(f));
    if (!h) return null;
    const raster = rasterFuer(f, modul);
    const mitte = f.gesamtEckenPx.reduce<[number, number]>(
      (a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4],
      [0, 0],
    );
    return (
      <g key={f.id}>
        {moduleAufHomographie({
          h,
          raster,
          flaeche: f,
          assetId: GESAMT_ASSET_ID,
          fotoBreitePx: foto.breitePx,
          druck: true,
        })}
        {beschriftung && (
          <text
            x={mitte[0]}
            y={mitte[1]}
            fontSize={px(0.04)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth={px(0.008)}
            paintOrder="stroke"
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {zonenVon(f, i)}
          </text>
        )}
      </g>
    );
  });
}

/** Vollständiges Gesamt-SVG (für Offscreen-Rasterung im PDF). */
export function GesamtSvg({ projekt, foto }: { projekt: Projekt; foto: GesamtFoto }) {
  const modul = modulById(projekt.modulId);
  return (
    <svg
      viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <ModulAsset id={GESAMT_ASSET_ID} modul={modul} />
      </defs>
      <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
      {gesamtFlaechenInhalt({ projekt, foto, beschriftung: false })}
    </svg>
  );
}
