'use client';

import { useRef, useState } from 'react';
import {
  belegungsCheck,
  sortiereEcken,
  traufeWechseln,
  type Punkt,
} from '../lib/foto-geometrie';
import { DACHFARBEN, fmtDe, type DachFoto, type Flaeche } from '../lib/model';

/**
 * Drohnenfoto-Hintergrund je Dachfläche (Foto bleibt lokal im Browser;
 * Google-Maps-Screenshots bleiben verboten, SPEC §8.1).
 *
 * Markierung: alle 4 Ecken der Dachfläche anklicken (Traufe links → Traufe
 * rechts → First rechts → First links). Die Platzierung ist damit auch bei
 * schräg aufgenommenen Fotos perspektivisch exakt (Homographie). Nach dem
 * Markieren läuft automatisch der Belegungs-Check: passt die markierte
 * Fläche zu den eingegebenen Maßen? (Braucht den Ziegel-Maßstab.)
 *
 * „Ziegel zählen": Strecke über n Ziegelbreiten entlang einer Reihe ×
 * Deckbreite = Maßstab px/m — Grundlage für Check und Maß-Übernahme.
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

type Modus = 'ecken' | 'ziegel';

const ECKEN_LABELS = ['Traufe links', 'Traufe rechts', 'First rechts', 'First links'] as const;

const knopfKlasse =
  'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

function modusKnopfKlasse(aktiv: boolean): string {
  return `h-9 rounded-lg border px-3 text-sm font-medium ${
    aktiv ? 'border-akzent bg-akzent text-white' : 'border-slate-300 bg-white text-slate-700'
  }`;
}

export function FotoHintergrund({
  flaeche,
  onPatch,
}: {
  flaeche: Flaeche;
  /** Ein Patch pro Aktion — Foto und ggf. Maße in EINEM Update (kein Stale-State) */
  onPatch: (patch: Partial<Flaeche>) => void;
}) {
  const foto = flaeche.foto;
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [modus, setModus] = useState<Modus>('ecken');
  const [anzahlZiegel, setAnzahlZiegel] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState<number | null>(null); // null = Default je Eindeckung
  const inputRef = useRef<HTMLInputElement>(null);

  const deckCm = deckbreiteCm ?? deckbreiteDefaultCm(flaeche);
  const onFoto = (f: DachFoto | undefined) => onPatch({ foto: f });

  const markiert = !!(foto && (foto.eckenPx || foto.traufePx));
  const check =
    foto?.eckenPx != null
      ? belegungsCheck(foto.eckenPx, flaeche.breiteM, flaeche.hoeheM, flaeche.neigungDeg, foto.pxProM)
      : null;

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
    const noetig = modus === 'ziegel' ? 2 : 4;
    if (neu.length < noetig) {
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
      setModus('ecken');
    } else {
      onFoto({
        ...foto,
        eckenPx: sortiereEcken(neu as [Punkt, Punkt, Punkt, Punkt]),
        traufePx: null,
      });
    }
    setPunkte([]);
  };

  const zurueckAufNull = () => {
    setPunkte([]);
    setModus('ecken');
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
            {markiert && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() => {
                  zurueckAufNull();
                  const { eckenPx: _e, ...rest } = foto;
                  onFoto({ ...rest, traufePx: null });
                }}
              >
                Dachfläche neu markieren
              </button>
            )}
            {foto.eckenPx && (
              <button
                type="button"
                className={knopfKlasse}
                title="Falls die falsche Kante als Traufe angenommen wurde: Zuordnung weiterdrehen"
                onClick={() => onFoto({ ...foto, eckenPx: traufeWechseln(foto.eckenPx!) })}
              >
                ↻ Traufe wechseln
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
            {check?.vorschlag && (
              <button
                type="button"
                className={knopfKlasse}
                onClick={() =>
                  onPatch({
                    breiteM: check.vorschlag!.breiteM,
                    hoeheM: check.vorschlag!.hoeheM,
                    inaktiv: [],
                  })
                }
              >
                Maße aus Foto übernehmen ({fmtDe(check.vorschlag.breiteM, 1)} ×{' '}
                {fmtDe(check.vorschlag.hoeheM, 1)} m)
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

      {check && (
        <div
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${
            check.status === 'ok'
              ? 'bg-emerald-50 text-emerald-800'
              : check.status === 'warnung'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-700'
          }`}
        >
          <strong>Belegungs-Check:</strong>{' '}
          {check.meldungen.map((m, i) => (
            <span key={i}>
              {m}{' '}
            </span>
          ))}
        </div>
      )}

      {foto && !markiert && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={modusKnopfKlasse(modus === 'ecken')}
              onClick={() => wechsleModus('ecken')}
            >
              Dachfläche markieren (4 Ecken)
            </button>
            <button
              type="button"
              className={modusKnopfKlasse(modus === 'ziegel')}
              onClick={() => wechsleModus('ziegel')}
            >
              Ziegel zählen (Maßstab)
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

          {modus === 'ecken' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Dachfläche markieren:</strong> die 4 Ecken der Fläche anklicken —{' '}
              <strong>Reihenfolge egal</strong>, die unterste Kante wird als Traufe angenommen
              (danach ggf. „↻ Traufe wechseln"). Die Module werden perspektivisch exakt
              eingepasst (auch bei schräg aufgenommenem Foto). Danach läuft der Belegungs-Check
              gegen die eingegebenen Maße
              {foto.pxProM === undefined ? ' — dafür vorher „Ziegel zählen"' : ''}.
            </p>
          ) : (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Ziegel zählen:</strong> Anfang und Ende einer Strecke über {anzahlZiegel}{' '}
              Ziegelbreiten <strong>entlang einer Reihe</strong> anklicken (quer zur Falllinie —
              nur die Deckbreite ist nicht neigungsverzerrt). Beton: 30 cm ist Standard; Ton je
              Modell 18–30 cm — im Zweifel einen Ziegel vor Ort messen.
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
              {punkte.length >= 2 && (
                <polyline
                  points={punkte.map(([px, py]) => `${px},${py}`).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={foto.breitePx * 0.0025}
                  strokeDasharray={`${foto.breitePx * 0.008} ${foto.breitePx * 0.005}`}
                />
              )}
              {punkte.map(([px, py], i) => (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={foto.breitePx * 0.007}
                  fill={modus === 'ziegel' ? '#0ea5e9' : '#f97316'}
                  stroke="#ffffff"
                  strokeWidth={foto.breitePx * 0.002}
                />
              ))}
            </svg>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {modus === 'ziegel'
              ? punkte.length === 0
                ? 'Anfang der Ziegel-Strecke anklicken.'
                : `Punkt 1 gesetzt — jetzt das Ende der ${anzahlZiegel}-Ziegel-Strecke anklicken.`
              : `Als Nächstes anklicken: ${ECKEN_LABELS[punkte.length] ?? ''} (${punkte.length + 1}/4)`}
          </p>
        </div>
      )}
    </div>
  );
}
