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
 * dann nur noch Richtung + linken Ankerpunkt.
 *
 * „Maße aus Foto messen" (braucht den Ziegel-Maßstab): 3 Klicks — Traufe
 * links, Traufe rechts, Punkt auf dem First — übernehmen Traufbreite und
 * Sparrenlänge in die Fläche. Sparrenlänge = Foto-Abstand ÷ cos(Neigung)
 * (Rückrechnung der Draufsicht-Verkürzung; die Neigung aus Schritt 2 muss
 * dafür stimmen). Schätzwerte, auf 0,1 m gerundet — echtes Aufmaß geht vor.
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

type Punkt = [number, number];
type Modus = 'traufe' | 'ziegel' | 'masse';

/** Wie viele Klicks der Modus braucht. */
const KLICKS: Record<Modus, number> = { traufe: 2, ziegel: 2, masse: 3 };

const knopfKlasse =
  'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

function modusKnopfKlasse(aktiv: boolean): string {
  return `h-9 rounded-lg border px-3 text-sm font-medium ${
    aktiv ? 'border-akzent bg-akzent text-white' : 'border-slate-300 bg-white text-slate-700'
  } disabled:opacity-40`;
}

export function FotoHintergrund({
  flaeche,
  onPatch,
}: {
  flaeche: Flaeche;
  /** Ein Patch pro Aktion — Foto und ggf. gemessene Maße in EINEM Update (kein Stale-State) */
  onPatch: (patch: Partial<Flaeche>) => void;
}) {
  const foto = flaeche.foto;
  const onFoto = (f: DachFoto | undefined) => onPatch({ foto: f });
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [modus, setModus] = useState<Modus>('traufe');
  const [anzahlZiegel, setAnzahlZiegel] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState<number | null>(null); // null = Default je Eindeckung
  const inputRef = useRef<HTMLInputElement>(null);

  const deckCm = deckbreiteCm ?? deckbreiteDefaultCm(flaeche);

  const wechsleModus = (m: Modus) => {
    setModus(m);
    setPunkte([]);
  };

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!foto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * foto.breitePx;
    const y = ((e.clientY - rect.top) / rect.height) * foto.hoehePx;
    const neu: Punkt[] = [...punkte, [x, y]];
    if (neu.length < KLICKS[modus]) {
      setPunkte(neu);
      return;
    }

    if (modus === 'ziegel') {
      const [[x1, y1], [x2, y2]] = neu as [Punkt, Punkt];
      const distPx = Math.hypot(x2 - x1, y2 - y1);
      const streckeM = (anzahlZiegel * deckCm) / 100;
      if (distPx > 0 && streckeM > 0) {
        onFoto({ ...foto, pxProM: distPx / streckeM });
      }
      setModus('traufe');
    } else if (modus === 'masse' && foto.pxProM !== undefined) {
      const [[x1, y1], [x2, y2], [fx, fy]] = neu as [Punkt, Punkt, Punkt];
      const traufePxLaenge = Math.hypot(x2 - x1, y2 - y1);
      // senkrechter Abstand First → Traufkante (|Kreuzprodukt| / Länge)
      const dPx =
        Math.abs((x2 - x1) * (y1 - fy) - (x1 - fx) * (y2 - y1)) / (traufePxLaenge || 1);
      const cosN = Math.cos((flaeche.neigungDeg * Math.PI) / 180);
      const breiteM = Math.round((traufePxLaenge / foto.pxProM) * 10) / 10;
      const hoeheM = Math.round((dPx / foto.pxProM / cosN) * 10) / 10;
      if (breiteM > 0 && hoeheM > 0 && Number.isFinite(hoeheM)) {
        onPatch({
          breiteM,
          hoeheM,
          inaktiv: [],
          foto: { ...foto, traufePx: [x1, y1, x2, y2] },
        });
      }
      setModus('traufe');
    } else {
      const [[x1, y1]] = neu as [Punkt];
      onFoto({ ...foto, traufePx: [x1, y1, x, y] });
    }
    setPunkte([]);
  };

  const zurueckAufNull = () => {
    setPunkte([]);
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
              className={modusKnopfKlasse(modus === 'traufe')}
              onClick={() => wechsleModus('traufe')}
            >
              Traufkante klicken
            </button>
            <button
              type="button"
              className={modusKnopfKlasse(modus === 'ziegel')}
              onClick={() => wechsleModus('ziegel')}
            >
              Ziegel zählen (Notnagel)
            </button>
            <button
              type="button"
              className={modusKnopfKlasse(modus === 'masse')}
              disabled={foto.pxProM === undefined}
              title={
                foto.pxProM === undefined
                  ? 'Braucht den Ziegel-Maßstab (erst „Ziegel zählen")'
                  : undefined
              }
              onClick={() => wechsleModus('masse')}
            >
              Maße aus Foto messen
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

          {modus === 'traufe' && (
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
          )}
          {modus === 'ziegel' && (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Ziegel zählen:</strong> Anfang und Ende einer Strecke über {anzahlZiegel}{' '}
              Ziegelbreiten <strong>entlang einer Reihe</strong> anklicken (quer zur Falllinie —
              nur die Deckbreite ist nicht neigungsverzerrt). Beton: 30 cm ist Standard; Ton je
              Modell 18–30 cm — im Zweifel einen Ziegel vor Ort messen.
            </p>
          )}
          {modus === 'masse' && (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Maße aus Foto messen (3 Klicks):</strong> 1. Traufe links, 2. Traufe rechts
              (First oberhalb), 3. Punkt auf dem <strong>First</strong>. Traufbreite und
              Sparrenlänge (÷ cos {fmtDe(flaeche.neigungDeg, 0)}° Neigung) werden in die Fläche
              übernommen — Schätzwerte auf 0,1 m gerundet, die Neigung aus Schritt 2 muss stimmen.
              Echtes Aufmaß geht vor.
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
              {punkte.length === 2 && (
                <line
                  x1={punkte[0]![0]}
                  y1={punkte[0]![1]}
                  x2={punkte[1]![0]}
                  y2={punkte[1]![1]}
                  stroke="#f97316"
                  strokeWidth={foto.breitePx * 0.003}
                  strokeDasharray={`${foto.breitePx * 0.01} ${foto.breitePx * 0.006}`}
                />
              )}
              {punkte.map(([px, py], i) => (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={foto.breitePx * 0.008}
                  fill={modus === 'ziegel' ? '#0ea5e9' : '#f97316'}
                  stroke="#ffffff"
                  strokeWidth={foto.breitePx * 0.002}
                />
              ))}
            </svg>
          </div>
          {punkte.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {modus === 'ziegel' &&
                `Punkt 1 gesetzt — jetzt das Ende der ${anzahlZiegel}-Ziegel-Strecke anklicken.`}
              {modus === 'traufe' && 'Punkt 1 gesetzt — jetzt das rechte Ende der Traufkante anklicken.'}
              {modus === 'masse' &&
                (punkte.length === 1
                  ? 'Traufe links gesetzt — jetzt Traufe rechts anklicken.'
                  : 'Traufe gesetzt — jetzt einen Punkt auf dem First anklicken.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
