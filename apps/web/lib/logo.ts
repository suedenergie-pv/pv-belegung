/**
 * SüdEnergie-Logo für den PDF-Export (06.07.2026). Quelle:
 * SuedEnergie-Logos-Final/01_Standard/SuedEnergie-Logo-Farbe.svg.
 * Die Icon-Pfade sind unverändert übernommen; neu ist NUR die Skalierung:
 * das Icon wird auf die Versalhöhe der Schrift gesetzt (Genrih 06.07.:
 * „Icon so hoch wie die Schrift"). Original-Icon war deutlich höher als die Wortmarke.
 * Gerastert (client-seitig, transparenter Hintergrund) und für jsPDF zugeschnitten.
 */

const ICON_PFADE = [
  '<path d="M593.994 0H508.534L729.307 272.793H814.768L593.994 0Z" fill="#FFA9A9"/>',
  '<path d="M475.351 40.2969L434.274 91.4456L583.953 272.791H669.414L475.351 40.2969Z" fill="#FFA9A9"/>',
  '<path d="M407.416 123.996L386.877 150.345L364.759 176.695L448.082 272.792H533.543L407.416 123.996Z" fill="#FFA9A9"/>',
  '<path d="M227.895 0H313.356L85.4607 272.793H0L227.895 0Z" fill="#EF4C29"/>',
  '<path d="M363.205 0H448.666L227.892 272.793H142.432L363.205 0Z" fill="#EF4C29"/>',
  '<path d="M504.951 0H590.412L369.638 272.793H284.178L504.951 0Z" fill="#EF4C29"/>',
].join('');

const ICON_W = 814.768;
const ICON_H = 272.793;

/** Baut das Logo-SVG: Icon auf Versalhöhe der Wortmarke, links davor. */
export function logoSvg(): string {
  const fontSize = 84;
  const baseline = 84.9;
  const capHeight = fontSize * 0.717; // Versalhöhe Helvetica/Arial
  const capTop = baseline - capHeight;
  const iconScale = capHeight / ICON_H; // Icon exakt so hoch wie die Versalien
  const iconW = ICON_W * iconScale;
  const iconX = 4;
  const textX = iconX + iconW + 22; // Abstand Icon → Wortmarke
  const vbW = 920; // großzügig; transparente Ränder werden nach dem Rastern getrimmt
  const vbH = 110;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">` +
    `<g transform="translate(${iconX}, ${capTop.toFixed(2)}) scale(${iconScale.toFixed(4)})">${ICON_PFADE}</g>` +
    `<text x="${textX.toFixed(1)}" y="${baseline}" font-family="Helvetica, Arial, sans-serif" ` +
    `font-weight="700" font-size="${fontSize}" letter-spacing="-1" fill="#111111">SüdEnergie</text>` +
    `</svg>`
  );
}

/** Rastert das Logo zu PNG (transparent) und schneidet leere Ränder weg. */
export async function logoPng(): Promise<{ dataUrl: string; w: number; h: number }> {
  const skala = 3;
  const vbW = 920;
  const vbH = 110;
  const url = URL.createObjectURL(new Blob([logoSvg()], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Logo-Rasterung fehlgeschlagen'));
      el.src = url;
    });
    const cw = vbW * skala;
    const ch = vbH * skala;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar');
    ctx.drawImage(img, 0, 0, cw, ch);

    // Bounding-Box der nicht-transparenten Pixel → enger Zuschnitt
    const { data } = ctx.getImageData(0, 0, cw, ch);
    let minX = cw;
    let minY = ch;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (data[(y * cw + x) * 4 + 3]! > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return { dataUrl: canvas.toDataURL('image/png'), w: cw, h: ch };
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    return { dataUrl: out.toDataURL('image/png'), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
