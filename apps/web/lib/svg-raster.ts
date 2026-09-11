const BINAER_BLOCK = 0x8000;

/** Baut eine selbstenthaltene SVG-Data-URL ohne Blob-URL-Abhängigkeit. */
export function svgMarkupAlsDataUrl(markup: string): string {
  const bytes = new TextEncoder().encode(markup);
  let binaer = '';
  for (let start = 0; start < bytes.length; start += BINAER_BLOCK) {
    binaer += String.fromCharCode(...bytes.subarray(start, start + BINAER_BLOCK));
  }
  return `data:image/svg+xml;base64,${btoa(binaer)}`;
}

/** Lädt ein Rasterbild mit festem Ende, damit der Exportknopf nie endlos wartet. */
export function ladeBildMitTimeout(
  src: string,
  fehlermeldung: string,
  timeoutMs = 8_000,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const bild = new Image();
    let erledigt = false;
    const fertig = (aktion: () => void, quelleLeeren = false) => {
      if (erledigt) return;
      erledigt = true;
      window.clearTimeout(timeout);
      bild.onload = null;
      bild.onerror = null;
      if (quelleLeeren) bild.src = '';
      aktion();
    };
    const timeout = window.setTimeout(
      () => fertig(() => reject(new Error(`${fehlermeldung} (Zeitüberschreitung)`)), true),
      timeoutMs,
    );
    bild.onload = () => fertig(() => resolve(bild));
    bild.onerror = () => fertig(() => reject(new Error(fehlermeldung)), true);
    bild.src = src;
  });
}
