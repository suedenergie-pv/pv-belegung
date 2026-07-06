'use client';

import type { BelegungRaster, ModuleType } from '@pv-belegung/engine';
import { homographie, inverseHomographie, projiziere, projPfad, type Punkt } from '../lib/foto-geometrie';
import { DACHFARBEN, umrissVon, type Dachfarbe, type Flaeche, type PunktM } from '../lib/model';

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
  // Jolywood Niwa Black = Glas-Glas mit sichtbaren silbrigen Zellfugen (KEIN echtes
  // Full-Black wie Aiko ABC). Deshalb hellere, kräftigere Zelllinien; Aiko bleibt schwarz.
  for (let i = 1; i < reihen; i++) {
    const pos = (i * L) / reihen;
    const mitte = reihen % 2 === 0 && i === reihen / 2;
    const stroke = istJolywood ? (mitte ? '#aab3c2' : '#8b95a6') : mitte ? '#15161a' : '#121316';
    const width = istJolywood ? (mitte ? 16 : 7) : mitte ? 5 : 2;
    const opacity = istJolywood ? (mitte ? 0.7 : 0.55) : 0.7;
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
    const stroke = istJolywood ? '#8b95a6' : '#121316';
    const width = istJolywood ? 6 : 2;
    const opacity = istJolywood ? 0.5 : 0.7;
    spaltenLinien.push(
      laengsHorizontal ? (
        <line key={j} x1={inset} y1={pos} x2={wMm - inset} y2={pos} stroke={stroke} strokeWidth={width} opacity={opacity} />
      ) : (
        <line key={j} x1={pos} y1={inset} x2={pos} y2={hMm - inset} stroke={stroke} strokeWidth={width} opacity={opacity} />
      ),
    );
  }

  // Glas: Jolywood dunkelblau-anthrazit (Glas-Optik), Aiko fast schwarz (ABC)
  const glasFill = istJolywood ? '#151a24' : '#08090b';
  return (
    <symbol id={id} viewBox={`0 0 ${wMm} ${hMm}`}>
      {/* Rahmen bewusst sichtbar (heller als Glas), damit jedes Modul einzeln lesbar ist */}
      <rect width={wMm} height={hMm} rx={14} fill="#1c1f24" />
      <rect x={inset} y={inset} width={wMm - 2 * inset} height={hMm - 2 * inset} rx={6} fill={glasFill} />
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
  zeichnen,
}: {
  flaeche: Flaeche;
  raster: BelegungRaster;
  modul: ModuleType;
  onToggle?: (key: string) => void;
  zeichnen?: ZeichnenProps;
}) {
  const B = flaeche.breiteM;
  const H = flaeche.hoeheM;
  const farbe = DACHFARBEN.find((d) => d.id === flaeche.dachfarbe) ?? DACHFARBEN[1];
  const symId = `sym-${flaeche.id}-${flaeche.ausrichtung}-${modul.id}`;
  const patId = `pat-${flaeche.id}-${farbe.id}`;
  const mB = raster.modulBreiteM;
  const mH = raster.modulHoeheM;
  // Während des Zeichnens gehen Klicks an den Zeichenmodus, nicht ans Modul-Toggle
  const toggle = zeichnen?.aktiv ? undefined : onToggle;
  const umrissEff = umrissVon(flaeche);
  const umriss = umrissEff && umrissEff.length >= 3 ? umrissEff : null;
  const hindernisse = flaeche.hindernisse ?? [];
  const draft = zeichnen?.punkteM ?? [];

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
            className={toggle ? 'cursor-pointer' : undefined}
            onClick={toggle ? () => toggle(key) : undefined}
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
      {overlayM}
    </>
  );

  const foto = flaeche.foto;
  if (foto?.eckenPx) {
    // Perspektivischer Modus: 4 markierte Ecken → Homographie Fläche→Foto.
    // Jedes Modul wird als projiziertes Viereck gezeichnet (LoD vereinfacht,
    // SPEC §11.2) — Maße weiterhin aus dem Engine-Raster, nie aus dem Foto.
    const h = homographie(B, H, foto.eckenPx);
    if (h) {
      const inset = 0.022; // Rahmen ~22 mm, wie im Detail-Symbol
      const rechteck = (x: number, y: number, w: number, hh: number): Punkt[] => [
        [x, y],
        [x + w, y],
        [x + w, y + hh],
        [x, y + hh],
      ];
      const klickM = zeichnen?.aktiv
        ? (e: React.MouseEvent<SVGSVGElement>) => {
            const inv = inverseHomographie(B, H, foto.eckenPx!);
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
            <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
            <path
              d={projPfad(h, rechteck(raster.randM, raster.randM, B - 2 * raster.randM, H - 2 * raster.randM))}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={foto.breitePx * 0.0012}
              strokeDasharray={`${foto.breitePx * 0.008} ${foto.breitePx * 0.005}`}
            />
            {raster.positionen.map((p) => {
              const key = `${p.row}-${p.col}`;
              const aus = flaeche.inaktiv.includes(key);
              return (
                <g
                  key={key}
                  opacity={aus ? 0.25 : 1}
                  className={toggle ? 'cursor-pointer' : undefined}
                  onClick={toggle ? () => toggle(key) : undefined}
                >
                  <path d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))} fill="#1c1f24" />
                  <path
                    d={projPfad(
                      h,
                      rechteck(p.xM + inset, p.yM + inset, mB - 2 * inset, mH - 2 * inset),
                    )}
                    fill="#0a0b0e"
                  />
                  {aus && (
                    <path
                      d={projPfad(h, rechteck(p.xM, p.yM, mB, mH))}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={foto.breitePx * 0.0015}
                      strokeDasharray={`${foto.breitePx * 0.006} ${foto.breitePx * 0.004}`}
                    />
                  )}
                </g>
              );
            })}
            {/* Umriss/Hindernisse/Draft in Foto-Projektion */}
            {umriss && (
              <path
                d={projPfad(h, umriss.map(([x, y]) => [x, y] as Punkt))}
                fill="none"
                stroke="#f97316"
                strokeWidth={foto.breitePx * 0.002}
                strokeDasharray={`${foto.breitePx * 0.01} ${foto.breitePx * 0.006}`}
              />
            )}
            {hindernisse.map((hi, i) => (
              <path
                key={i}
                d={projPfad(h, rechteck(hi.xM, hi.yM, hi.breiteM, hi.hoeheM))}
                fill="rgba(239,68,68,0.35)"
                stroke="#ef4444"
                strokeWidth={foto.breitePx * 0.0015}
              />
            ))}
            {draft.length >= 2 && (
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
            {draft.map(([x, y], i) => {
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
            <ModulSymbol id={symId} modul={modul} wMm={mB * 1000} hMm={mH * 1000} />
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
          <ModulSymbol id={symId} modul={modul} wMm={mB * 1000} hMm={mH * 1000} />
          <DachPattern id={patId} farbe={farbe} />
        </defs>
        <rect width={B} height={H} fill={`url(#${patId})`} />
        {belegung}
      </svg>
    </div>
  );
}
