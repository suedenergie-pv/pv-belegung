'use client';

import { useRef, useState } from 'react';
import { dateiZuBild } from '../lib/bild';
import {
  hindernisAusKlicks,
  homographie,
  orientiereEcken,
  projPfad,
  sortiereEcken,
  traufeWechseln,
  umrissAusKlicks,
  type Punkt,
} from '../lib/foto-geometrie';
import { fmtDe, modulById, zonenLabel, type Flaeche, type Projekt } from '../lib/model';
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
  // Fläche, die gerade markiert/bearbeitet wird (null = nur ansehen)
  const [platziereId, setPlatziereId] = useState<string | null>(null);
  // Ablauf: first → ecken (platzieren); danach edit mit umriss/hindernis (bearbeiten)
  const [phase, setPhase] = useState<'first' | 'ecken' | 'edit' | 'umriss' | 'hindernis'>('first');
  const [firstLinie, setFirstLinie] = useState<[Punkt, Punkt] | null>(null);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [mausPx, setMausPx] = useState<Punkt | null>(null);

  // Beim Anwählen: platzierte Fläche → direkt in den Bearbeiten-Modus, sonst platzieren.
  const starteMarkierung = (id: string | null) => {
    setPlatziereId(id);
    const f = id ? projekt.flaechen.find((x) => x.id === id) : null;
    setPhase(f?.gesamtEckenPx ? 'edit' : 'first');
    setFirstLinie(null);
    setPunkte([]);
  };

  const px = (v: number) => (foto ? foto.breitePx * v : 0);
  const knopf =
    'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400';

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
    if (!platziereId || !foto) return;
    const k = svgKoord(e);
    if (!k) return;
    const f = projekt.flaechen.find((x) => x.id === platziereId);
    if (!f) return;

    if (phase === 'first') {
      const neu: Punkt[] = [...punkte, k];
      if (neu.length < 2) return setPunkte(neu);
      setFirstLinie([neu[0]!, neu[1]!]);
      setPunkte([]);
      return setPhase('ecken');
    }

    if (phase === 'ecken') {
      const neu: Punkt[] = [...punkte, k];
      if (neu.length >= 4) {
        const vier: [Punkt, Punkt, Punkt, Punkt] = [neu[0]!, neu[1]!, neu[2]!, neu[3]!];
        const ecken = firstLinie ? orientiereEcken(vier, firstLinie) : sortiereEcken(vier);
        // Neu platziert → Umriss/Hindernisse zurücksetzen, in den Bearbeiten-Modus
        patchFlaeche(platziereId, { gesamtEckenPx: ecken, umrissM: undefined, hindernisse: [], inaktiv: [] });
        setPunkte([]);
        setFirstLinie(null);
        return setPhase('edit');
      }
      return setPunkte(neu);
    }

    if (phase === 'umriss') {
      if (!f.gesamtEckenPx) return;
      // Klick nahe erstem Punkt schließt (ab 3 Ecken)
      if (punkte.length >= 3) {
        const [fx, fy] = punkte[0]!;
        if (Math.hypot(k[0] - fx, k[1] - fy) <= foto.breitePx * 0.025) {
          const umrissM = umrissAusKlicks(punkte, f.breiteM, f.hoeheM, f.gesamtEckenPx);
          if (umrissM) patchFlaeche(platziereId, { umrissM, inaktiv: [] });
          setPunkte([]);
          return setPhase('edit');
        }
      }
      return setPunkte([...punkte, k]);
    }

    if (phase === 'hindernis') {
      if (!f.gesamtEckenPx) return;
      const neu: Punkt[] = [...punkte, k];
      if (neu.length < 2) return setPunkte(neu);
      const rect = hindernisAusKlicks(neu[0]!, neu[1]!, f.breiteM, f.hoeheM, f.gesamtEckenPx);
      if (rect) patchFlaeche(platziereId, { hindernisse: [...(f.hindernisse ?? []), rect], inaktiv: [] });
      return setPunkte([]);
    }
    // phase 'edit': Klicks steuern nichts (die Knöpfe schalten den Modus)
  };

  const umrissAbschliessen = () => {
    const f = projekt.flaechen.find((x) => x.id === platziereId);
    if (!f?.gesamtEckenPx) return;
    const umrissM = umrissAusKlicks(punkte, f.breiteM, f.hoeheM, f.gesamtEckenPx);
    if (umrissM) patchFlaeche(f.id, { umrissM, inaktiv: [] });
    setPunkte([]);
    setPhase('edit');
  };

  const starteFoto = async (file: File) => {
    const bild = await dateiZuBild(file);
    starteMarkierung(null);
    onChange({ ...projekt, gesamtFoto: bild });
  };

  const platziert = projekt.flaechen.filter((f) => f.gesamtEckenPx).length;
  const platF = platziereId ? projekt.flaechen.find((f) => f.id === platziereId) : undefined;
  const platHom =
    platF?.gesamtEckenPx ? homographie(platF.breiteM, platF.hoeheM, platF.gesamtEckenPx) : null;
  // Nur beim aktiven Zeichnen die Fläche ausblenden (leeres Dach); im „edit"-Ruhezustand
  // bleiben die Module sichtbar — dann keine Skizzenlinien in der Ansicht.
  const zeichnetGerade =
    phase === 'first' || phase === 'ecken' || phase === 'umriss' || phase === 'hindernis';

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

            {platziereId && platF && (
              <div className="mt-3 space-y-2">
                {phase === 'edit' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{platF.name}:</span>
                    <button type="button" className={knopf} onClick={() => { setPunkte([]); setPhase('umriss'); }}>
                      ⬠ Umriss zeichnen{platF.umrissM ? ' (neu)' : ''}
                    </button>
                    <button type="button" className={knopf} onClick={() => { setPunkte([]); setPhase('hindernis'); }}>
                      ▭ Hindernis markieren
                    </button>
                    {platF.umrissM && (
                      <button type="button" className={knopf} onClick={() => patchFlaeche(platF.id, { umrissM: undefined, inaktiv: [] })}>
                        Umriss entfernen
                      </button>
                    )}
                    <button type="button" className={knopf} onClick={() => { setFirstLinie(null); setPunkte([]); setPhase('first'); }}>
                      Ausrichtung neu
                    </button>
                    <button
                      type="button"
                      className="ml-auto h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                      onClick={() => starteMarkierung(null)}
                    >
                      ✓ Fertig
                    </button>
                  </div>
                )}

                {(phase === 'edit' || phase === 'hindernis') && (platF.hindernisse ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(platF.hindernisse ?? []).map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        title="Hindernis entfernen"
                        className="h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm font-medium text-red-700 hover:border-red-300"
                        onClick={() =>
                          patchFlaeche(platF.id, {
                            hindernisse: (platF.hindernisse ?? []).filter((_, j) => j !== i),
                            inaktiv: [],
                          })
                        }
                      >
                        {fmtDe(h.breiteM, 1)} × {fmtDe(h.hoeheM, 1)} m ✕
                      </button>
                    ))}
                  </div>
                )}

                <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  {phase === 'first' ? (
                    <>
                      <strong>{platF.name} — First-/Trauflinie:</strong> 2 Klicks entlang der
                      waagerechten Dachkante.{' '}
                      <button type="button" className="underline" onClick={() => { setPunkte([]); setPhase('ecken'); }}>
                        Überspringen
                      </button>{' '}
                    </>
                  ) : phase === 'ecken' ? (
                    <>
                      <strong>{platF.name} — 4 Ecken</strong> anklicken (Reihenfolge egal). Ecke{' '}
                      {punkte.length + 1} von 4.{' '}
                    </>
                  ) : phase === 'umriss' ? (
                    <>
                      <strong>Umriss zeichnen:</strong> den Rand der Fläche der Reihe nach anklicken;
                      schließen mit dem ersten Punkt oder „Umriss fertig".{' '}
                      <button
                        type="button"
                        disabled={punkte.length < 3}
                        className="font-semibold text-emerald-700 underline disabled:opacity-40"
                        onClick={umrissAbschliessen}
                      >
                        ✓ Umriss fertig ({punkte.length})
                      </button>{' '}
                      <button
                        type="button"
                        disabled={punkte.length === 0}
                        className="underline disabled:opacity-40"
                        onClick={() => setPunkte(punkte.slice(0, -1))}
                      >
                        ↶ Punkt zurück
                      </button>{' '}
                    </>
                  ) : phase === 'hindernis' ? (
                    <>
                      <strong>Hindernis markieren:</strong>{' '}
                      {punkte.length === 0 ? 'erste Ecke' : 'gegenüberliegende Ecke'} anklicken
                      (Kamin/Fenster/SAT).{' '}
                      <button type="button" className="underline" onClick={() => { setPunkte([]); setPhase('edit'); }}>
                        ✓ Fertig
                      </button>{' '}
                    </>
                  ) : (
                    <>
                      <strong>{platF.name}</strong> ist platziert. Umriss/Hindernisse zeichnen oder
                      „Fertig".{' '}
                    </>
                  )}
                  {phase !== 'edit' && (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setPunkte([]);
                        if (platF.gesamtEckenPx) setPhase('edit');
                        else starteMarkierung(null);
                      }}
                    >
                      Abbrechen
                    </button>
                  )}
                </p>
              </div>
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

                {/* Platzierte Flächen (geteilt mit dem PDF-Export, GesamtSvg). Nur WÄHREND
                    des aktiven Zeichnens wird die bearbeitete Fläche ausgeblendet (leeres Dach
                    zum Zeichnen); sonst bleiben die Module sichtbar — keine Skizzenlinien. */}
                {gesamtFlaechenInhalt({ projekt, foto, ausblendenId: zeichnetGerade ? platziereId : undefined })}

                {/* Beim Hindernis-Zeichnen die bereits gesetzten Hindernisse (rot) zeigen —
                    kein oranger Umriss (der Umriss ist an den Modulen/an der Zeichenvorschau
                    ablesbar). */}
                {platHom && platF && phase === 'hindernis' &&
                  (platF.hindernisse ?? []).map((r, i) => (
                    <path
                      key={i}
                      d={projPfad(platHom, [
                        [r.xM, r.yM],
                        [r.xM + r.breiteM, r.yM],
                        [r.xM + r.breiteM, r.yM + r.hoeheM],
                        [r.xM, r.yM + r.hoeheM],
                      ] as Punkt[])}
                      fill="rgba(239,68,68,0.4)"
                      stroke="#ef4444"
                      strokeWidth={px(0.002)}
                    />
                  ))}

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
                {phase === 'umriss' && punkte.length >= 3 && (
                  <line
                    x1={punkte[punkte.length - 1]![0]}
                    y1={punkte[punkte.length - 1]![1]}
                    x2={punkte[0]![0]}
                    y2={punkte[0]![1]}
                    stroke="#f97316"
                    strokeOpacity={0.4}
                    strokeWidth={px(0.0016)}
                    strokeDasharray={`${px(0.004)} ${px(0.004)}`}
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
