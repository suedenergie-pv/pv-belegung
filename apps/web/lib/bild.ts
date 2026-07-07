/**
 * Gemeinsames Foto-Einlesen: Datei → verkleinertes JPEG (Data-URL) + Pixelmaße.
 * Fotos bleiben lokal im Browser (SPEC §8.1). Genutzt vom Einzelflächen-Foto
 * (FotoHintergrund) und vom Gesamtansicht-Foto (SchrittGesamt) — eine Quelle,
 * damit Verkleinerung/Qualität überall identisch sind.
 */

export const MAX_FOTO_PX = 1600;

export interface FotoBild {
  dataUrl: string;
  breitePx: number;
  hoehePx: number;
}

export async function dateiZuBild(file: File, maxPx = MAX_FOTO_PX): Promise<FotoBild> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const faktor = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const breitePx = Math.round(img.naturalWidth * faktor);
  const hoehePx = Math.round(img.naturalHeight * faktor);
  const canvas = document.createElement('canvas');
  canvas.width = breitePx;
  canvas.height = hoehePx;
  canvas.getContext('2d')!.drawImage(img, 0, 0, breitePx, hoehePx);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), breitePx, hoehePx };
}
