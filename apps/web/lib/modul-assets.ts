/**
 * Kanonische Modul-Render-Assets (SPEC §11.2), von Genrih geliefert
 * (Module Rendered.zip, 07.07.2026). ViewBox 260×404 (Hochformat, echte
 * Seitenverhältnisse 1134:1762). Jolywood: silberne Verbinderlinien; Aiko ABC:
 * homogen tiefschwarz. Werden in DachSvg als <g> in <defs> definiert und per
 * <use transform="matrix(...)"> je Modul instanziert — Größe/Perspektive aus den
 * Modul-Eckpunkten (mm × Maßstab bzw. Homographie), nie aus CSS.
 */

export const MODUL_ASSET_W = 260;
export const MODUL_ASSET_H = 404;

const JOLYWOOD_NIWA_BLACK = `
<rect x="2" y="2" width="256" height="400" rx="5" fill="#0e0e10"/>
<rect x="4" y="4" width="252" height="396" rx="4" fill="#141416"/>
<rect x="9" y="9" width="242" height="386" rx="2" fill="#08090b"/>
<g stroke="#5a5e66" stroke-width="0.7" opacity="0.85">
<line x1="11" y1="33.1" x2="249" y2="33.1"/>
<line x1="11" y1="57.3" x2="249" y2="57.3"/>
<line x1="11" y1="81.4" x2="249" y2="81.4"/>
<line x1="11" y1="105.5" x2="249" y2="105.5"/>
<line x1="11" y1="129.6" x2="249" y2="129.6"/>
<line x1="11" y1="153.8" x2="249" y2="153.8"/>
<line x1="11" y1="177.9" x2="249" y2="177.9"/>
<line x1="11" y1="226.1" x2="249" y2="226.1"/>
<line x1="11" y1="250.3" x2="249" y2="250.3"/>
<line x1="11" y1="274.4" x2="249" y2="274.4"/>
<line x1="11" y1="298.5" x2="249" y2="298.5"/>
<line x1="11" y1="322.6" x2="249" y2="322.6"/>
<line x1="11" y1="346.8" x2="249" y2="346.8"/>
<line x1="11" y1="370.9" x2="249" y2="370.9"/>
</g>
<rect x="11" y="200" width="238" height="4" fill="#54585f" opacity="0.9"/>
<g stroke="#101114" stroke-width="0.6">
<line x1="49.3" y1="11" x2="49.3" y2="393"/>
<line x1="89.7" y1="11" x2="89.7" y2="393"/>
<line x1="130" y1="11" x2="130" y2="393"/>
<line x1="170.3" y1="11" x2="170.3" y2="393"/>
<line x1="210.7" y1="11" x2="210.7" y2="393"/>
</g>
<g stroke="#3f424a" stroke-width="0.3" opacity="0.55">
<line x1="15.7" y1="11" x2="15.7" y2="393"/><line x1="22.4" y1="11" x2="22.4" y2="393"/><line x1="29.2" y1="11" x2="29.2" y2="393"/><line x1="35.9" y1="11" x2="35.9" y2="393"/><line x1="42.6" y1="11" x2="42.6" y2="393"/>
<line x1="56" y1="11" x2="56" y2="393"/><line x1="62.7" y1="11" x2="62.7" y2="393"/><line x1="69.5" y1="11" x2="69.5" y2="393"/><line x1="76.2" y1="11" x2="76.2" y2="393"/><line x1="82.9" y1="11" x2="82.9" y2="393"/>
<line x1="96.4" y1="11" x2="96.4" y2="393"/><line x1="103.1" y1="11" x2="103.1" y2="393"/><line x1="109.8" y1="11" x2="109.8" y2="393"/><line x1="116.5" y1="11" x2="116.5" y2="393"/><line x1="123.3" y1="11" x2="123.3" y2="393"/>
<line x1="136.7" y1="11" x2="136.7" y2="393"/><line x1="143.4" y1="11" x2="143.4" y2="393"/><line x1="150.2" y1="11" x2="150.2" y2="393"/><line x1="156.9" y1="11" x2="156.9" y2="393"/><line x1="163.6" y1="11" x2="163.6" y2="393"/>
<line x1="177.1" y1="11" x2="177.1" y2="393"/><line x1="183.8" y1="11" x2="183.8" y2="393"/><line x1="190.5" y1="11" x2="190.5" y2="393"/><line x1="197.2" y1="11" x2="197.2" y2="393"/><line x1="204" y1="11" x2="204" y2="393"/>
<line x1="217.4" y1="11" x2="217.4" y2="393"/><line x1="224.1" y1="11" x2="224.1" y2="393"/><line x1="230.9" y1="11" x2="230.9" y2="393"/><line x1="237.6" y1="11" x2="237.6" y2="393"/><line x1="244.3" y1="11" x2="244.3" y2="393"/>
</g>
<polygon points="9,9 115,9 9,140" fill="#ffffff" opacity="0.025"/>
<rect x="9" y="9" width="242" height="386" rx="2" fill="none" stroke="#2b2c30" stroke-width="1"/>
`;

const AIKO_ABC = `
<rect x="2" y="2" width="256" height="400" rx="5" fill="#0b0b0d"/>
<rect x="4" y="4" width="252" height="396" rx="4" fill="#101012"/>
<rect x="9" y="9" width="242" height="386" rx="2" fill="#08090b"/>
<g stroke="#121316" stroke-width="0.5">
<line x1="11" y1="52.5" x2="249" y2="52.5"/>
<line x1="11" y1="95" x2="249" y2="95"/>
<line x1="11" y1="137.5" x2="249" y2="137.5"/>
<line x1="11" y1="180" x2="249" y2="180"/>
<line x1="11" y1="224" x2="249" y2="224"/>
<line x1="11" y1="266.5" x2="249" y2="266.5"/>
<line x1="11" y1="309" x2="249" y2="309"/>
<line x1="11" y1="351.5" x2="249" y2="351.5"/>
<line x1="50" y1="11" x2="50" y2="393"/>
<line x1="90" y1="11" x2="90" y2="393"/>
<line x1="130" y1="11" x2="130" y2="393"/>
<line x1="170" y1="11" x2="170" y2="393"/>
<line x1="210" y1="11" x2="210" y2="393"/>
<line x1="11" y1="202" x2="249" y2="202" stroke="#15161a" stroke-width="0.8"/>
</g>
<polygon points="9,9 115,9 9,140" fill="#ffffff" opacity="0.028"/>
<rect x="9" y="9" width="242" height="386" rx="2" fill="none" stroke="#232428" stroke-width="1"/>
`;

const ASSETS: Record<string, string> = {
  jolywood_niwa_black: JOLYWOOD_NIWA_BLACK,
  aiko_abc: AIKO_ABC,
};

export function modulAssetInner(renderSymbol: string): string {
  return ASSETS[renderSymbol] ?? AIKO_ABC;
}

/**
 * Affine Matrix, die das Asset (260×404) in das Modul-Viereck legt, definiert
 * durch die drei projizierten Ecken TL, TR (Traufrichtung +Breite), BL
 * (Sparrenrichtung +Höhe). 'quer' dreht das Hochformat-Asset um 90°.
 * (Die 4. Ecke ergibt sich als Parallelogramm — bei kleinen Modulen und
 * mäßiger Perspektive vernachlässigbar.)
 */
export function modulMatrix(
  TL: readonly [number, number],
  TR: readonly [number, number],
  BL: readonly [number, number],
  quer: boolean,
): string {
  let ux: number;
  let uy: number;
  let vx: number;
  let vy: number;
  if (quer) {
    // Asset-x (kurze Seite) → vertikal (BL−TL); Asset-y (lange Seite) → horizontal (TR−TL)
    ux = (BL[0] - TL[0]) / MODUL_ASSET_W;
    uy = (BL[1] - TL[1]) / MODUL_ASSET_W;
    vx = (TR[0] - TL[0]) / MODUL_ASSET_H;
    vy = (TR[1] - TL[1]) / MODUL_ASSET_H;
  } else {
    // Hochkant: Asset-x → horizontal (TR−TL); Asset-y → vertikal (BL−TL)
    ux = (TR[0] - TL[0]) / MODUL_ASSET_W;
    uy = (TR[1] - TL[1]) / MODUL_ASSET_W;
    vx = (BL[0] - TL[0]) / MODUL_ASSET_H;
    vy = (BL[1] - TL[1]) / MODUL_ASSET_H;
  }
  return `matrix(${ux} ${uy} ${vx} ${vy} ${TL[0]} ${TL[1]})`;
}
