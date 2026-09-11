/**
 * Gemeinsames Foto-Einlesen: Datei → verkleinertes JPEG (Data-URL) + Pixelmaße.
 * Fotos bleiben lokal im Browser (SPEC §8.1). Genutzt vom Einzelflächen-Foto
 * (FotoHintergrund) und von projektweiten Belegungsfotos — eine Quelle,
 * damit Verkleinerung/Qualität überall identisch sind.
 */

export const MAX_FOTO_PX = 1600;
export const MAX_FOTO_BYTES = 20 * 1024 * 1024;
export const FOTO_SCHRITT_TIMEOUT_MS = 15_000;
const ERLAUBTE_BILDTYPEN = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface FotoBild {
  dataUrl: string;
  breitePx: number;
  hoehePx: number;
}

export async function dateiZuBild(file: File, maxPx = MAX_FOTO_PX): Promise<FotoBild> {
  if (!ERLAUBTE_BILDTYPEN.has(file.type)) {
    throw new Error('Nicht unterstützter Bildtyp. Bitte JPG, PNG oder WebP verwenden.');
  }
  if (file.size <= 0) throw new Error('Die Bilddatei ist leer.');
  if (file.size > MAX_FOTO_BYTES) {
    throw new Error('Das Foto ist größer als 20 MB. Bitte vorher verkleinern oder neu exportieren.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    let erledigt = false;
    const fertig = (aktion: () => void) => {
      if (erledigt) return;
      erledigt = true;
      window.clearTimeout(timeout);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      aktion();
    };
    const timeout = window.setTimeout(() => {
      fertig(() => {
        try {
          reader.abort();
        } catch {
          // Der Fehlerzustand unten bleibt die verlässliche Rückmeldung.
        }
        reject(new Error('Das Einlesen des Fotos dauert zu lange. Bitte erneut versuchen.'));
      });
    }, FOTO_SCHRITT_TIMEOUT_MS);
    reader.onload = () => fertig(() => resolve(reader.result as string));
    reader.onerror = () =>
      fertig(() => reject(reader.error ?? new Error('Die Bilddatei konnte nicht gelesen werden.')));
    reader.onabort = () => fertig(() => reject(new Error('Das Einlesen des Fotos wurde abgebrochen.')));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    let erledigt = false;
    const fertig = (aktion: () => void, quelleLeeren = false) => {
      if (erledigt) return;
      erledigt = true;
      window.clearTimeout(timeout);
      i.onload = null;
      i.onerror = null;
      if (quelleLeeren) i.src = '';
      aktion();
    };
    const timeout = window.setTimeout(
      () =>
        fertig(
          () => reject(new Error('Das Dekodieren des Fotos dauert zu lange. Bitte erneut versuchen.')),
          true,
        ),
      FOTO_SCHRITT_TIMEOUT_MS,
    );
    i.onload = () => fertig(() => resolve(i));
    i.onerror = () =>
      fertig(() => reject(new Error('Das Bildformat konnte nicht dekodiert werden.')), true);
    i.src = dataUrl;
  });
  const faktor = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const breitePx = Math.round(img.naturalWidth * faktor);
  const hoehePx = Math.round(img.naturalHeight * faktor);
  const canvas = document.createElement('canvas');
  canvas.width = breitePx;
  canvas.height = hoehePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Das Foto konnte im Browser nicht verarbeitet werden.');
  ctx.drawImage(img, 0, 0, breitePx, hoehePx);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), breitePx, hoehePx };
}
