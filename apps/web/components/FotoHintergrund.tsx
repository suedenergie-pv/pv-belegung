'use client';

import { useRef, useState } from 'react';
import { fmtDe, type DachFoto, type Flaeche } from '../lib/model';

/**
 * Drohnenfoto-Hintergrund je Dachfläche: eigenes Foto hochladen (bleibt lokal
 * im Browser), Traufkante als Referenzstrecke anklicken — ihr wahres Maß ist
 * breiteM aus dem Aufmaß, daraus Maßstab + Rotation. Google-Maps-Screenshots
 * bleiben verboten (SPEC §8.1).
 */

const MAX_PX = 1600;

async function dateiZuFoto(file: File): Promise<DachFoto> {
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
  // verkleinern: hält localStorage-Persistenz und SVG-Rendering schlank
  const faktor = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const breitePx = Math.round(img.naturalWidth * faktor);
  const hoehePx = Math.round(img.naturalHeight * faktor);
  const canvas = document.createElement('canvas');
  canvas.width = breitePx;
  canvas.height = hoehePx;
  canvas.getContext('2d')!.drawImage(img, 0, 0, breitePx, hoehePx);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), breitePx, hoehePx, traufePx: null };
}

export function FotoHintergrund({
  flaeche,
  onFoto,
}: {
  flaeche: Flaeche;
  onFoto: (foto: DachFoto | undefined) => void;
}) {
  const foto = flaeche.foto;
  const [erster, setErster] = useState<[number, number] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!foto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * foto.breitePx;
    const y = ((e.clientY - rect.top) / rect.height) * foto.hoehePx;
    if (!erster) {
      setErster([x, y]);
      return;
    }
    onFoto({ ...foto, traufePx: [erster[0], erster[1], x, y] });
    setErster(null);
  };

  return (
    <div className="mb-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setErster(null);
          onFoto(await dateiZuFoto(file));
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
          onClick={() => inputRef.current?.click()}
        >
          📷 {foto ? 'Anderes Foto' : 'Drohnenfoto als Hintergrund'}
        </button>
        {foto && (
          <>
            {foto.traufePx && (
              <button
                type="button"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
                onClick={() => {
                  setErster(null);
                  onFoto({ ...foto, traufePx: null });
                }}
              >
                Traufkante neu setzen
              </button>
            )}
            <button
              type="button"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-500 hover:border-red-300"
              onClick={() => {
                setErster(null);
                onFoto(undefined);
              }}
            >
              Foto entfernen
            </button>
          </>
        )}
      </div>

      {foto && !foto.traufePx && (
        <div className="mt-3">
          <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <strong>Maßstab kalibrieren:</strong> Traufkante dieser Dachfläche im Foto anklicken —
            erst das <strong>linke</strong>, dann das <strong>rechte</strong> Ende (First oberhalb).
            Referenzstrecke = Traufe {fmtDe(flaeche.breiteM, 2)} m (Aufmaß aus Schritt Dachflächen).
          </p>
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
              className="block h-full w-full cursor-crosshair"
              preserveAspectRatio="xMidYMid meet"
              onClick={klick}
            >
              <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
              {erster && (
                <circle
                  cx={erster[0]}
                  cy={erster[1]}
                  r={foto.breitePx * 0.008}
                  fill="#f97316"
                  stroke="#ffffff"
                  strokeWidth={foto.breitePx * 0.002}
                />
              )}
            </svg>
          </div>
          {erster && (
            <p className="mt-1 text-xs text-slate-500">
              Punkt 1 gesetzt — jetzt das rechte Ende der Traufkante anklicken.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
