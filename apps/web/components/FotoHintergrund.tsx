'use client';

import { useRef, useState } from 'react';
import { DACHFARBEN, fmtDe, type DachFoto, type Flaeche } from '../lib/model';

/**
 * Drohnenfoto-Hintergrund je Dachfläche: eigenes Foto hochladen (bleibt lokal
 * im Browser), Traufkante als Referenzstrecke anklicken — ihr wahres Maß ist
 * breiteM aus dem Aufmaß, daraus Maßstab + Rotation. Google-Maps-Screenshots
 * bleiben verboten (SPEC §8.1).
 *
 * Notnagel „Ziegel zählen": ist die Traufkante nicht frei sichtbar/bekannt,
 * liefert eine Strecke über n Ziegel × Deckbreite den Maßstab (Deckbreite ist
 * quer zur Falllinie, also nicht neigungsverzerrt). Die Traufklicks brauchen
 * dann nur noch Richtung + linken Ankerpunkt — die Endpunkte müssen nicht
 * exakt sitzen.
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

/** Übliche Deckbreite je Eindeckung (nur Vorbelegung, Feld bleibt editierbar). */
function deckbreiteDefaultCm(f: Flaeche): number {
  const art = DACHFARBEN.find((d) => d.id === f.dachfarbe)?.art;
  return art === 'blech' ? 53 : 30; // Blech: Scharen-/Falzabstand; Beton/Ton: 30 cm
}

const knopfKlasse =
  'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

export function FotoHintergrund({
  flaeche,
  onFoto,
}: {
  flaeche: Flaeche;
  onFoto: (foto: DachFoto | undefined) => void;
}) {
  const foto = flaeche.foto;
  const [erster, setErster] = useState<[number, number] | null>(null);
  const [modus, setModus] = useState<'traufe' | 'ziegel'>('traufe');
  const [anzahlZiegel, setAnzahlZiegel] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState<number | null>(null); // null = Default je Eindeckung
  const inputRef = useRef<HTMLInputElement>(null);

  const deckCm = deckbreiteCm ?? deckbreiteDefaultCm(flaeche);

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!foto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * foto.breitePx;
    const y = ((e.clientY - rect.top) / rect.height) * foto.hoehePx;
    if (!erster) {
      setErster([x, y]);
      return;
    }
    if (modus === 'ziegel') {
      const distPx = Math.hypot(x - erster[0], y - erster[1]);
      const streckeM = (anzahlZiegel * deckCm) / 100;
      if (distPx > 0 && streckeM > 0) {
        onFoto({ ...foto, pxProM: distPx / streckeM });
      }
      setModus('traufe');
    } else {
      onFoto({ ...foto, traufePx: [erster[0], erster[1], x, y] });
    }
    setErster(null);
  };

  const zurueckAufNull = () => {
    setErster(null);
    setModus('traufe');
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
          zurueckAufNull();
          onFoto(await dateiZuFoto(file));
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={knopfKlasse} onClick={() => inputRef.current?.click()}>
          📷 {foto ? 'Anderes Foto' : 'Drohnenfoto als Hintergrund'}
        </button>
        {foto && (
          <>
            {foto.traufePx && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => {
                  zurueckAufNull();
                  onFoto({ ...foto, traufePx: null });
                }}
              >
                Traufkante neu setzen
              </button>
            )}
            {foto.pxProM !== undefined && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => {
                  const { pxProM: _weg, ...rest } = foto;
                  zurueckAufNull();
                  onFoto(rest);
                }}
              >
                Ziegel-Maßstab löschen ({fmtDe(foto.pxProM, 1)} px/m)
              </button>
            )}
            <button
              type="button"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-500 hover:border-red-300"
              onClick={() => {
                zurueckAufNull();
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
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`h-9 rounded-lg border px-3 text-sm font-medium ${
                modus === 'traufe'
                  ? 'border-akzent bg-akzent text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => {
                setModus('traufe');
                setErster(null);
              }}
            >
              Traufkante klicken
            </button>
            <button
              type="button"
              className={`h-9 rounded-lg border px-3 text-sm font-medium ${
                modus === 'ziegel'
                  ? 'border-akzent bg-akzent text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => {
                setModus('ziegel');
                setErster(null);
              }}
            >
              Ziegel zählen (Notnagel)
            </button>
            {modus === 'ziegel' && (
              <>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={100}
                    value={anzahlZiegel}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n >= 1) setAnzahlZiegel(n);
                    }}
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                  />
                  Ziegel à
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={80}
                    value={deckCm}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n > 0) setDeckbreiteCm(n);
                    }}
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-base"
                  />
                  cm Deckbreite
                </label>
              </>
            )}
          </div>

          {modus === 'traufe' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {foto.pxProM !== undefined ? (
                <>
                  <strong>Traufe anklicken:</strong> zwei Punkte AUF der Traufkante — erst links,
                  dann rechts (First oberhalb). Die Endpunkte müssen nicht exakt sitzen, der
                  Maßstab kommt aus der Ziegelzählung ({fmtDe(foto.pxProM, 1)} px/m).
                </>
              ) : (
                <>
                  <strong>Maßstab kalibrieren:</strong> Traufkante dieser Dachfläche im Foto
                  anklicken — erst das <strong>linke</strong>, dann das <strong>rechte</strong> Ende
                  (First oberhalb). Referenzstrecke = Traufe {fmtDe(flaeche.breiteM, 2)} m (Aufmaß
                  aus Schritt Dachflächen).
                </>
              )}
            </p>
          ) : (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Ziegel zählen:</strong> Anfang und Ende einer Strecke über{' '}
              {anzahlZiegel} Ziegelbreiten <strong>entlang einer Reihe</strong> anklicken (quer zur
              Falllinie — nur die Deckbreite ist nicht neigungsverzerrt). Beton: 30 cm ist
              Standard; Ton je Modell 18–30 cm — im Zweifel einen Ziegel vor Ort messen.
            </p>
          )}

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
                  fill={modus === 'ziegel' ? '#0ea5e9' : '#f97316'}
                  stroke="#ffffff"
                  strokeWidth={foto.breitePx * 0.002}
                />
              )}
            </svg>
          </div>
          {erster && (
            <p className="mt-1 text-xs text-slate-500">
              Punkt 1 gesetzt — jetzt{' '}
              {modus === 'ziegel'
                ? `das Ende der ${anzahlZiegel}-Ziegel-Strecke`
                : 'das rechte Ende der Traufkante'}{' '}
              anklicken.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
