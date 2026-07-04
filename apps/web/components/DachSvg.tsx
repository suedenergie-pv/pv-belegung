'use client';

import type { BelegungRaster, ModuleType } from '@pv-belegung/engine';
import { DACHFARBEN, type Flaeche } from '../lib/model';

/**
 * Draufsicht einer Dachfläche (SPEC §11.1). Koordinatensystem = Meter
 * (viewBox aus Flächenmaßen), Module als <symbol>/<use> aus Katalog-mm —
 * niemals aus CSS-Layout (SPEC §3.5, §11.2). Vereinfachte LoD-Symbole.
 */

function ModulSymbol({ id, modul, wMm, hMm }: { id: string; modul: ModuleType; wMm: number; hMm: number }) {
  const laengsHorizontal = wMm > hMm; // quer verlegt → Längsachse horizontal
  const L = Math.max(wMm, hMm);
  const Q = Math.min(wMm, hMm);
  const reihen = modul.cells / 6; // Zellreihen entlang der Längsachse (16 bzw. 18)
  const inset = 22;

  const laengsLinien: JSX.Element[] = [];
  const istJolywood = modul.renderSymbol === 'jolywood_niwa_black';
  for (let i = 1; i < reihen; i++) {
    const pos = (i * L) / reihen;
    const mitte = reihen % 2 === 0 && i === reihen / 2;
    const stroke = istJolywood ? (mitte ? '#54585f' : '#5a5e66') : mitte ? '#15161a' : '#121316';
    const width = istJolywood ? (mitte ? 16 : 3) : mitte ? 5 : 2;
    const opacity = istJolywood ? (mitte ? 0.9 : 0.85) : 0.8;
    laengsLinien.push(
      laengsHorizontal ? (
        <line key={i} x1={pos} y1={inset} x2={pos} y2={hMm - inset} stroke={stroke} strokeWidth={width} opacity={opacity} />
      ) : (
        <line key={i} x1={inset} y1={pos} x2={wMm - inset} y2={pos} stroke={stroke} strokeWidth={width} opacity={opacity} />
      ),
    );
  }

  const spaltenLinien: JSX.Element[] = [];
  for (let j = 1; j < 6; j++) {
    const pos = (j * Q) / 6;
    const stroke = istJolywood ? '#101114' : '#121316';
    spaltenLinien.push(
      laengsHorizontal ? (
        <line key={j} x1={inset} y1={pos} x2={wMm - inset} y2={pos} stroke={stroke} strokeWidth={2} opacity={0.7} />
      ) : (
        <line key={j} x1={pos} y1={inset} x2={pos} y2={hMm - inset} stroke={stroke} strokeWidth={2} opacity={0.7} />
      ),
    );
  }

  return (
    <symbol id={id} viewBox={`0 0 ${wMm} ${hMm}`}>
      <rect width={wMm} height={hMm} rx={14} fill="#0e0e10" />
      <rect x={inset} y={inset} width={wMm - 2 * inset} height={hMm - 2 * inset} rx={6} fill="#08090b" />
      {laengsLinien}
      {spaltenLinien}
    </symbol>
  );
}

export function DachSvg({
  flaeche,
  raster,
  modul,
  onToggle,
}: {
  flaeche: Flaeche;
  raster: BelegungRaster;
  modul: ModuleType;
  onToggle?: (key: string) => void;
}) {
  const B = flaeche.breiteM;
  const H = flaeche.hoeheM;
  const farbe = DACHFARBEN.find((d) => d.id === flaeche.dachfarbe) ?? DACHFARBEN[1];
  const symId = `sym-${flaeche.id}-${flaeche.ausrichtung}-${modul.id}`;
  const mB = raster.modulBreiteM;
  const mH = raster.modulHoeheM;

  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-xl border border-slate-200"
      style={{ aspectRatio: `${B} / ${H}`, maxHeight: 420, maxWidth: (420 * B) / H }}
    >
      <svg viewBox={`0 0 ${B} ${H}`} className="block h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <ModulSymbol id={symId} modul={modul} wMm={mB * 1000} hMm={mH * 1000} />
        </defs>
        <rect width={B} height={H} fill={farbe.fill} />
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
        {raster.positionen.map((p) => {
          const key = `${p.row}-${p.col}`;
          const aus = flaeche.inaktiv.includes(key);
          return (
            <g
              key={key}
              opacity={aus ? 0.22 : 1}
              className={onToggle ? 'cursor-pointer' : undefined}
              onClick={onToggle ? () => onToggle(key) : undefined}
            >
              <use href={`#${symId}`} x={p.xM} y={p.yM} width={mB} height={mH} />
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}
