'use client';

import { useRef, useState } from 'react';
import {
  belegungsCheck,
  inverseHomographie,
  projiziere,
  sortiereEcken,
  traufeWechseln,
  vierEckenFuerHomographie,
  type Punkt,
} from '../lib/foto-geometrie';
import { DACHFARBEN, fmtDe, type DachFoto, type Flaeche, type PunktM } from '../lib/model';

/**
 * Drohnenfoto-Hintergrund je Dachfläche (Foto bleibt lokal im Browser;
 * Google-Maps-Screenshots bleiben verboten, SPEC §8.1).
 *
 * Markierung (06.07.2026 vereinfacht): den Umriss der Dachfläche direkt
 * einzeichnen — Ecken der Reihe nach anklicken (mind. 4, beliebig mehr für
 * Walm/L-Form), zum Schließen den ersten Punkt oder „Fertig". Die 4 Perspektiv-
 * Ecken für die Homographie werden intern aus dem Umriss bestimmt
 * (vierEckenFuerHomographie); zusätzliche Ecken maskieren die Belegung
 * (umrissM). Kein getrennter „erst 4 Ecken, dann Umriss"-Schritt mehr.
 * Danach läuft der Belegungs-Check gegen die eingegebenen Maße (Ziegel-Maßstab).
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

type Modus = 'umriss' | 'ziegel';

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
  const [modus, setModus] = useState<Modus>('umriss');
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

  /** Umriss abschließen: 4 Perspektiv-Ecken aus den Umrisspunkten, Rest maskiert. */
  const umrissAbschliessen = (pts: Punkt[]) => {
    if (!foto || pts.length < 4) return;
    const ecken = sortiereEcken(vierEckenFuerHomographie(pts));
    const hinv = inverseHomographie(flaeche.breiteM, flaeche.hoeheM, ecken);
    // > 4 Ecken → echter Umriss maskiert die Belegung (in Flächen-Koordinaten)
    let umrissM: PunktM[] | undefined;
    if (pts.length > 4 && hinv) {
      const B = flaeche.breiteM;
      const H = flaeche.hoeheM;
      umrissM = pts.map((p) => {
        const [x, y] = projiziere(hinv, p);
        return [Math.max(0, Math.min(B, x)), Math.max(0, Math.min(H, y))] as PunktM;
      });
    }
    onPatch({ foto: { ...foto, eckenPx: ecken, traufePx: null }, umrissM, inaktiv: [] });
    setPunkte([]);
  };

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!foto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * foto.breitePx;
    const y = ((e.clientY - rect.top) / rect.height) * foto.hoehePx;

    if (modus === 'ziegel') {
      const neu: Punkt[] = [...punkte, [x, y]];
      if (neu.length < 2) {
        setPunkte(neu);
        return;
      }
      const [[x1, y1], [x2, y2]] = neu as [Punkt, Punkt];
      const distPx = Math.hypot(x2 - x1, y2 - y1);
      const streckeM = (anzahlZiegel * deckCm) / 100;
      if (distPx > 0 && streckeM > 0) onFoto({ ...foto, pxProM: distPx / streckeM });
      setPunkte([]);
      setModus('umriss');
      return;
    }

    // Umriss: Klick nahe am ersten Punkt schließt das Polygon (ab 4 Ecken)
    if (punkte.length >= 4) {
      const [fx, fy] = punkte[0]!;
      if (Math.hypot(x - fx, y - fy) <= foto.breitePx * 0.025) {
        umrissAbschliessen(punkte);
        return;
      }
    }
    setPunkte([...punkte, [x, y]]);
  };

  const zurueckAufNull = () => {
    setPunkte([]);
    setModus('umriss');
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
                  onPatch({ foto: { ...rest, traufePx: null }, umrissM: undefined, inaktiv: [] });
                }}
              >
                Umriss neu zeichnen
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
              className={modusKnopfKlasse(modus === 'umriss')}
              onClick={() => wechsleModus('umriss')}
            >
              Umriss zeichnen
            </button>
            <button
              type="button"
              className={modusKnopfKlasse(modus === 'ziegel')}
              onClick={() => wechsleModus('ziegel')}
            >
              Ziegel zählen (Maßstab)
            </button>
            {modus === 'umriss' && (
              <>
                <button
                  type="button"
                  disabled={punkte.length < 4}
                  className="h-9 rounded-lg bg-akzent px-3 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={() => umrissAbschliessen(punkte)}
                >
                  ✓ Fertig ({punkte.length} Ecken)
                </button>
                <button
                  type="button"
                  disabled={punkte.length === 0}
                  className={`${knopfKlasse} disabled:opacity-40`}
                  onClick={() => setPunkte(punkte.slice(0, -1))}
                >
                  ↶ Punkt zurück
                </button>
              </>
            )}
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

          {modus === 'umriss' ? (
            <p className="mb-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong>Umriss zeichnen:</strong> die Ecken der Dachfläche der Reihe nach anklicken
              — <strong>mindestens 4</strong>, für Walm/L-Form beliebig mehr. Schließen: auf den
              ersten Punkt klicken oder „Fertig". Die Module werden perspektivisch exakt
              eingepasst (auch bei schrägem Foto), die unterste Kante gilt als Traufe (danach
              ggf. „↻ Traufe wechseln").
              {foto.pxProM === undefined ? ' Für den Maß-Check vorher „Ziegel zählen".' : ''}
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
              {/* Schließ-Hinweis: gestrichelte Linie zurück zum ersten Punkt (ab 4 Ecken) */}
              {modus === 'umriss' && punkte.length >= 4 && (
                <line
                  x1={punkte[punkte.length - 1]![0]}
                  y1={punkte[punkte.length - 1]![1]}
                  x2={punkte[0]![0]}
                  y2={punkte[0]![1]}
                  stroke="#f97316"
                  strokeOpacity={0.5}
                  strokeWidth={foto.breitePx * 0.0018}
                  strokeDasharray={`${foto.breitePx * 0.004} ${foto.breitePx * 0.004}`}
                />
              )}
              {punkte.map(([px, py], i) => (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={foto.breitePx * (i === 0 && modus === 'umriss' && punkte.length >= 4 ? 0.011 : 0.007)}
                  fill={modus === 'ziegel' ? '#0ea5e9' : i === 0 && modus === 'umriss' ? '#ea580c' : '#f97316'}
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
              : punkte.length < 4
                ? `Ecke ${punkte.length + 1} anklicken (mindestens 4 Ecken).`
                : 'Weitere Ecken möglich — oder ersten Punkt anklicken / „Fertig" zum Schließen.'}
          </p>
        </div>
      )}
    </div>
  );
}
