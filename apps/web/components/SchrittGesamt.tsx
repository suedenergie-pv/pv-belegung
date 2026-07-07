'use client';

import { useRef, useState } from 'react';
import { dateiZuBild } from '../lib/bild';
import { orientiereEcken, sortiereEcken, traufeWechseln, type Punkt } from '../lib/foto-geometrie';
import { modulById, zonenLabel, type Flaeche, type Projekt } from '../lib/model';
import { ModulAsset } from './DachSvg';
import { GESAMT_ASSET_ID, gesamtFlaechenInhalt } from './GesamtSvg';
import { Karte, KartenTitel } from './ui';

/**
 * Gesamtansicht (07.07.2026): EIN Drohnenfoto vom ganzen Dach; jede Dachfläche
 * (A/B/C/…) wird über 4 Anker-Ecken perspektivisch daraufgelegt und mit ihrer
 * Belegung gerendert → Vorschau des komplett belegten Dachs. Reiner Kompositor
 * (SPEC §3): die Module kommen aus dem Engine-Raster (mm × Maßstab), die
 * Homographie streckt sie nur ins markierte Viereck.
 */
export function SchrittGesamt({
  projekt,
  onChange,
}: {
  projekt: Projekt;
  onChange: (p: Projekt) => void;
}) {
  const modul = modulById(projekt.modulId);
  const foto = projekt.gesamtFoto;
  const inputRef = useRef<HTMLInputElement>(null);
  // Fläche, deren Ecken gerade gesetzt werden (null = nur ansehen)
  const [platziereId, setPlatziereId] = useState<string | null>(null);
  // Erst First-/Trauflinie (legt die Ausrichtung fest), dann die 4 Ecken
  const [phase, setPhase] = useState<'first' | 'ecken'>('first');
  const [firstLinie, setFirstLinie] = useState<[Punkt, Punkt] | null>(null);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [mausPx, setMausPx] = useState<Punkt | null>(null);

  const starteMarkierung = (id: string | null) => {
    setPlatziereId(id);
    setPhase('first');
    setFirstLinie(null);
    setPunkte([]);
  };

  const px = (v: number) => (foto ? foto.breitePx * v : 0);

  const patchFlaeche = (id: string, patch: Partial<Flaeche>) =>
    onChange({
      ...projekt,
      flaechen: projekt.flaechen.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });

  const svgKoord = (e: React.MouseEvent<SVGSVGElement>): Punkt | null => {
    if (!foto) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [
      ((e.clientX - rect.left) / rect.width) * foto.breitePx,
      ((e.clientY - rect.top) / rect.height) * foto.hoehePx,
    ];
  };

  const klick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!platziereId) return;
    const k = svgKoord(e);
    if (!k) return;
    if (phase === 'first') {
      const neu: Punkt[] = [...punkte, k];
      if (neu.length < 2) return setPunkte(neu);
      setFirstLinie([neu[0]!, neu[1]!]);
      setPunkte([]);
      return setPhase('ecken');
    }
    const neu: Punkt[] = [...punkte, k];
    if (neu.length >= 4) {
      const vier: [Punkt, Punkt, Punkt, Punkt] = [neu[0]!, neu[1]!, neu[2]!, neu[3]!];
      const ecken = firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
      patchFlaeche(platziereId, { gesamtEckenPx: ecken });
      starteMarkierung(null);
      return;
    }
    setPunkte(neu);
  };

  const starteFoto = async (file: File) => {
    const bild = await dateiZuBild(file);
    starteMarkierung(null);
    onChange({ ...projekt, gesamtFoto: bild });
  };

  const platziert = projekt.flaechen.filter((f) => f.gesamtEckenPx).length;

  return (
    <div className="space-y-4">
      <Karte>
        <KartenTitel>Gesamtansicht — alle Flächen auf einem Drohnenfoto</KartenTitel>
        <p className="mb-3 text-sm text-slate-500">
          Ein Luftbild vom ganzen Dach hochladen, dann jede Fläche einzeichnen: erst die
          First-/Trauflinie (legt die Ausrichtung fest), dann die 4 Ecken. So entsteht eine
          Vorschau des komplett belegten Dachs — perspektivisch exakt, auch bei schrägen Aufnahmen.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) await starteFoto(file);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400"
            onClick={() => inputRef.current?.click()}
          >
            📷 {foto ? 'Anderes Gesamtfoto' : 'Gesamtfoto hochladen'}
          </button>
          {foto && (
            <button
              type="button"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-red-500 hover:border-red-300"
              onClick={() => {
                starteMarkierung(null);
                onChange({ ...projekt, gesamtFoto: undefined });
              }}
            >
              Gesamtfoto entfernen
            </button>
          )}
          {foto && (
            <span className="self-center text-sm text-slate-400">
              {platziert} / {projekt.flaechen.length} Flächen platziert
            </span>
          )}
        </div>

        {foto && (
          <>
            {/* Zonen-Leiste: je Fläche ein Knopf zum Einzeichnen */}
            <div className="mt-3 flex flex-wrap gap-2">
              {projekt.flaechen.map((f, i) => {
                const aktiv = platziereId === f.id;
                const gesetzt = !!f.gesamtEckenPx;
                return (
                  <div key={f.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => starteMarkierung(aktiv ? null : f.id)}
                      className={`h-9 rounded-lg border px-3 text-sm font-medium ${
                        aktiv
                          ? 'border-akzent bg-akzent text-white'
                          : gesetzt
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {gesetzt ? '✓ ' : ''}
                      {zonenLabel(i)} · {f.name}
                    </button>
                    {gesetzt && !aktiv && (
                      <button
                        type="button"
                        title="Traufe/First vertauscht? Zuordnung weiterdrehen"
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-600 hover:border-slate-400"
                        onClick={() => patchFlaeche(f.id, { gesamtEckenPx: traufeWechseln(f.gesamtEckenPx!) })}
                      >
                        ↻
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {platziereId && (
              <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <strong>{projekt.flaechen.find((f) => f.id === platziereId)?.name}:</strong>{' '}
                {phase === 'first' ? (
                  <>
                    <strong>First-/Trauflinie</strong> ziehen (2 Klicks entlang der waagerechten
                    Dachkante) — legt fest, was hoch und was quer ist.{' '}
                    <button type="button" className="underline" onClick={() => { setPunkte([]); setPhase('ecken'); }}>
                      Überspringen
                    </button>
                    {' · '}
                  </>
                ) : (
                  <>
                    die <strong>4 Ecken</strong> der Fläche anklicken (Reihenfolge egal). Ecke{' '}
                    {punkte.length + 1} von 4.{' '}
                  </>
                )}
                <button type="button" className="underline" onClick={() => starteMarkierung(null)}>
                  Abbrechen
                </button>
              </p>
            )}

            <div
              className="mx-auto mt-3 w-full overflow-hidden rounded-xl border border-slate-200"
              style={{
                aspectRatio: `${foto.breitePx} / ${foto.hoehePx}`,
                maxHeight: 520,
                maxWidth: (520 * foto.breitePx) / foto.hoehePx,
              }}
            >
              <svg
                viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
                className={`block h-full w-full ${platziereId ? 'cursor-crosshair' : ''}`}
                preserveAspectRatio="xMidYMid meet"
                onClick={klick}
                onMouseMove={(e) => platziereId && setMausPx(svgKoord(e))}
                onMouseLeave={() => setMausPx(null)}
              >
                <defs>
                  <ModulAsset id={GESAMT_ASSET_ID} modul={modul} />
                </defs>
                <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />

                {/* Platzierte Flächen (geteilt mit dem PDF-Export, GesamtSvg) */}
                {gesamtFlaechenInhalt({ projekt, foto, ausblendenId: platziereId })}

                {/* Gezogene First-/Trauflinie als Achs-Guide */}
                {firstLinie && (
                  <g>
                    <line
                      x1={firstLinie[0][0]} y1={firstLinie[0][1]}
                      x2={firstLinie[1][0]} y2={firstLinie[1][1]}
                      stroke="#0d9488" strokeWidth={px(0.003)} strokeLinecap="round"
                    />
                    {firstLinie.map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r={px(0.008)} fill="#0d9488" stroke="#fff" strokeWidth={px(0.002)} />
                    ))}
                  </g>
                )}

                {/* Fadenkreuz — kräftig mit weißem Halo + Zielring */}
                {platziereId && mausPx && (
                  <g style={{ pointerEvents: 'none' }}>
                    <g stroke="#ffffff" strokeOpacity={0.85} strokeWidth={px(0.0045)} fill="none">
                      <line x1={0} y1={mausPx[1]} x2={foto.breitePx} y2={mausPx[1]} />
                      <line x1={mausPx[0]} y1={0} x2={mausPx[0]} y2={foto.hoehePx} />
                      <circle cx={mausPx[0]} cy={mausPx[1]} r={px(0.013)} />
                    </g>
                    <g stroke="#0284c7" strokeOpacity={0.95} strokeWidth={px(0.002)} fill="none">
                      <line x1={0} y1={mausPx[1]} x2={foto.breitePx} y2={mausPx[1]} />
                      <line x1={mausPx[0]} y1={0} x2={mausPx[0]} y2={foto.hoehePx} />
                      <circle cx={mausPx[0]} cy={mausPx[1]} r={px(0.013)} />
                    </g>
                  </g>
                )}
                {platziereId && punkte.length >= 1 && mausPx && (
                  <line
                    x1={punkte[punkte.length - 1]![0]}
                    y1={punkte[punkte.length - 1]![1]}
                    x2={mausPx[0]}
                    y2={mausPx[1]}
                    stroke="#f97316"
                    strokeOpacity={0.7}
                    strokeWidth={px(0.0022)}
                    strokeDasharray={`${px(0.008)} ${px(0.005)}`}
                  />
                )}
                {platziereId && punkte.length >= 2 && (
                  <polyline
                    points={punkte.map(([qx, qy]) => `${qx},${qy}`).join(' ')}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth={px(0.0025)}
                    strokeDasharray={`${px(0.008)} ${px(0.005)}`}
                  />
                )}
                {platziereId &&
                  punkte.map(([qx, qy], i) => (
                    <circle key={i} cx={qx} cy={qy} r={px(0.007)} fill="#f97316" stroke="#fff" strokeWidth={px(0.002)} />
                  ))}
              </svg>
            </div>
          </>
        )}

        {!foto && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
            Noch kein Gesamtfoto. Optionaler Schritt — die Einzelbelegung je Fläche funktioniert
            auch ohne.
          </p>
        )}
      </Karte>
    </div>
  );
}
