'use client';

import { useMemo, useState } from 'react';
import {
  gaubenAussparungAusFoto,
  gaubenMasseAusElternfoto,
  satteldachMasseAusElternfoto,
  satteldachSeitenEcken,
  type GaubenSeitenMass,
} from '../lib/gauben-geometrie';
import { sortiereEcken, type Ecken, type Punkt } from '../lib/foto-geometrie';
import {
  fmtDe,
  type Flaeche,
  type GaubenMessung,
  type GaubenTyp,
  type RechteckM,
} from '../lib/model';
import { ToggleButton } from './ui';

export interface NeueGaubeAusFoto {
  typ: GaubenTyp;
  aussen: Ecken;
  seiten?: { links: Ecken; rechts: Ecken };
  seitenMasse?: { links: GaubenSeitenMass; rechts: GaubenSeitenMass };
  breiteM: number;
  hoeheM: number;
  messung: GaubenMessung;
  aussparung: RechteckM;
}

export interface AktualisierteGaubenMarkierung {
  aussen: Ecken;
  seiten?: { links: Ecken; rechts: Ecken };
  aussparung: RechteckM;
}

function GaubenMassEditor({
  flaeche,
  onSpeichern,
}: {
  flaeche: Flaeche;
  onSpeichern: (breiteM: number, hoeheM: number, messung: GaubenMessung) => void;
}) {
  const alt = flaeche.gaubenMessung;
  const [quelle, setQuelle] = useState<'aufmass' | 'ziegel'>(alt?.quelle === 'ziegel' ? 'ziegel' : 'aufmass');
  const [breiteM, setBreiteM] = useState(flaeche.breiteM);
  const [hoeheM, setHoeheM] = useState(flaeche.hoeheM);
  const [quer, setQuer] = useState(alt?.ziegelQuer ?? 10);
  const [deck, setDeck] = useState(alt?.deckbreiteCm ?? 30);
  const [reihen, setReihen] = useState(alt?.ziegelReihen ?? 8);
  const [abstand, setAbstand] = useState(alt?.reihenabstandCm ?? 34);
  const b = quelle === 'ziegel' ? (quer * deck) / 100 : breiteM;
  const h = quelle === 'ziegel' ? (reihen * abstand) / 100 : hoeheM;
  return (
    <details className="mt-2 border-t border-sky-100 pt-2">
      <summary className="cursor-pointer text-xs font-semibold text-sky-800">Maß verbessern</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        <ToggleButton aktiv={quelle === 'aufmass'} onClick={() => setQuelle('aufmass')}>Aufmaß</ToggleButton>
        <ToggleButton aktiv={quelle === 'ziegel'} onClick={() => setQuelle('ziegel')}>Ziegel zählen</ToggleButton>
      </div>
      <div className={`mt-2 grid gap-2 ${quelle === 'ziegel' ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
        {quelle === 'aufmass' ? (
          <>
            <ZahlenEingabe label="Breite" value={breiteM} onChange={setBreiteM} einheit="m" />
            <ZahlenEingabe label="Traufe bis First" value={hoeheM} onChange={setHoeheM} einheit="m" />
          </>
        ) : (
          <>
            <ZahlenEingabe label="Ziegel quer" value={quer} onChange={setQuer} einheit="Stk." min={1} />
            <ZahlenEingabe label="Deckbreite" value={deck} onChange={setDeck} einheit="cm" min={1} />
            <ZahlenEingabe label="Reihen" value={reihen} onChange={setReihen} einheit="Stk." min={1} />
            <ZahlenEingabe label="Reihenabstand" value={abstand} onChange={setAbstand} einheit="cm" min={1} />
          </>
        )}
      </div>
      <button
        type="button"
        className="mt-2 h-10 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white"
        onClick={() =>
          onSpeichern(Math.round(b * 100) / 100, Math.round(h * 100) / 100, {
            quelle,
            qualitaet: quelle === 'aufmass' ? 'bestaetigt' : 'gemessen',
            ...(quelle === 'ziegel'
              ? { ziegelQuer: quer, deckbreiteCm: deck, ziegelReihen: reihen, reihenabstandCm: abstand }
              : {}),
          })
        }
      >
        {fmtDe(b, 2)} × {fmtDe(h, 2)} m übernehmen
      </button>
    </details>
  );
}

const sekundar =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40';

function ZahlenEingabe({
  label,
  value,
  onChange,
  einheit,
  min = 0.1,
}: {
  label: string;
  value: number;
  onChange: (wert: number) => void;
  einheit: string;
  min?: number;
}) {
  return (
    <label className="block text-sm text-slate-600">
      <span className="mb-1 block font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={einheit === 'm' ? 0.1 : 1}
          value={value}
          onChange={(e) => {
            const n = Number.parseFloat(e.target.value);
            if (Number.isFinite(n) && n >= min) onChange(n);
          }}
          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30"
        />
        <span>{einheit}</span>
      </span>
    </label>
  );
}

export function GaubenEditor({
  eltern,
  gauben,
  onErstellen,
  onLoeschen,
  onMasseAendern,
  onMarkierungAendern,
}: {
  eltern: Flaeche;
  gauben: Flaeche[];
  onErstellen: (gaube: NeueGaubeAusFoto) => void;
  onLoeschen: (gruppenId: string) => void;
  onMasseAendern: (
    gruppenId: string,
    flaecheId: string,
    breiteM: number,
    hoeheM: number,
    messung: GaubenMessung,
  ) => void;
  onMarkierungAendern: (
    gruppenId: string,
    markierung: AktualisierteGaubenMarkierung,
  ) => void;
}) {
  const foto = eltern.foto;
  const [offen, setOffen] = useState(false);
  const [typ, setTyp] = useState<GaubenTyp>('flachdach');
  const [quelle, setQuelle] = useState<GaubenMessung['quelle']>('nachbardach');
  const [breiteM, setBreiteM] = useState(3);
  const [hoeheM, setHoeheM] = useState(2.5);
  const [ziegelQuer, setZiegelQuer] = useState(10);
  const [deckbreiteCm, setDeckbreiteCm] = useState(30);
  const [ziegelReihen, setZiegelReihen] = useState(8);
  const [reihenabstandCm, setReihenabstandCm] = useState(34);
  const [markieren, setMarkieren] = useState(false);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);

  const gruppen = useMemo(() => {
    const map = new Map<string, Flaeche[]>();
    for (const gaube of gauben) {
      const id = gaube.gaubenGruppeId ?? gaube.id;
      map.set(id, [...(map.get(id) ?? []), gaube]);
    }
    return [...map.entries()];
  }, [gauben]);

  if (!foto?.eckenPx) return null;

  const erwartet = typ === 'satteldach' ? 6 : 4;
  const aussen =
    punkte.length >= 4
      ? sortiereEcken([punkte[0]!, punkte[1]!, punkte[2]!, punkte[3]!])
      : null;
  const schaetzung = aussen ? gaubenMasseAusElternfoto(eltern, aussen) : null;
  const seiten =
    typ === 'satteldach' && aussen && punkte.length >= 6
      ? satteldachSeitenEcken(aussen, [punkte[4]!, punkte[5]!], eltern)
      : undefined;
  const seitenSchaetzung =
    seiten && punkte.length >= 6
      ? satteldachMasseAusElternfoto(eltern, seiten, [punkte[4]!, punkte[5]!])
      : null;
  const sichtbareSchaetzung =
    typ === 'satteldach' && seitenSchaetzung
      ? {
          breiteM: (seitenSchaetzung.links.breiteM + seitenSchaetzung.rechts.breiteM) / 2,
          hoeheM: (seitenSchaetzung.links.hoeheM + seitenSchaetzung.rechts.hoeheM) / 2,
        }
      : typ === 'flachdach'
        ? schaetzung
        : null;

  const reset = () => {
    setOffen(false);
    setMarkieren(false);
    setPunkte([]);
    setBearbeiteId(null);
  };

  const starten = () => {
    setPunkte([]);
    setMarkieren(true);
  };

  const markierungNeu = (gruppenId: string, flaechen: Flaeche[]) => {
    setTyp(flaechen[0]?.gaubenTyp ?? 'flachdach');
    setQuelle(flaechen[0]?.gaubenMessung?.quelle ?? 'aufmass');
    setBearbeiteId(gruppenId);
    setPunkte([]);
    setOffen(true);
    setMarkieren(true);
  };

  const erstellen = () => {
    if (!aussen || punkte.length < erwartet) return;
    const aussparung = gaubenAussparungAusFoto(eltern, aussen);
    if (!aussparung) return;
    if (typ === 'satteldach' && !seiten) return;

    if (bearbeiteId) {
      onMarkierungAendern(bearbeiteId, {
        aussen,
        ...(seiten ? { seiten } : {}),
        aussparung,
      });
      reset();
      return;
    }

    const masse =
      quelle === 'ziegel'
        ? {
            breiteM: (ziegelQuer * deckbreiteCm) / 100,
            hoeheM: (ziegelReihen * reihenabstandCm) / 100,
          }
        : quelle === 'nachbardach'
          ? sichtbareSchaetzung
          : { breiteM, hoeheM };
    if (!masse || masse.breiteM <= 0 || masse.hoeheM <= 0) return;

    onErstellen({
      typ,
      aussen,
      ...(seiten ? { seiten } : {}),
      ...(quelle === 'nachbardach' && seitenSchaetzung ? { seitenMasse: seitenSchaetzung } : {}),
      breiteM: Math.round(masse.breiteM * 100) / 100,
      hoeheM: Math.round(masse.hoeheM * 100) / 100,
      messung: {
        quelle,
        qualitaet:
          quelle === 'aufmass' ? 'bestaetigt' : quelle === 'ziegel' ? 'gemessen' : 'geschaetzt',
        ...(quelle === 'ziegel'
          ? { ziegelQuer, deckbreiteCm, ziegelReihen, reihenabstandCm }
          : {}),
      },
      aussparung,
    });
    reset();
  };

  return (
    <section className="mb-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <strong className="block text-sm text-sky-950">Gauben auf dieser Dachfläche</strong>
          <span className="text-xs text-sky-700">Im selben Foto markieren – Zuordnung und Aussparung passieren automatisch.</span>
        </div>
        {!offen && (
          <button
            type="button"
            className="ml-auto h-11 rounded-lg bg-akzent px-4 text-sm font-semibold text-white hover:bg-orange-700"
            onClick={() => setOffen(true)}
          >
            + Gaube
          </button>
        )}
      </div>

      {gruppen.length > 0 && (
        <div className="mt-3 grid gap-2">
          {gruppen.map(([id, flaechen], index) => {
            const erste = flaechen[0]!;
            const q = erste.gaubenMessung?.qualitaet;
            return (
              <div key={id} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>Gaube {index + 1}</strong>
                  <span className="text-slate-600">
                    {erste.gaubenTyp === 'satteldach' ? 'Satteldach' : 'Flachdach · Stehfalz'} ·{' '}
                    {fmtDe(erste.breiteM, 2)} × {fmtDe(erste.hoeheM, 2)} m
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      q === 'bestaetigt'
                        ? 'bg-emerald-100 text-emerald-800'
                        : q === 'gemessen'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {q === 'bestaetigt' ? 'Aufmaß bestätigt' : q === 'gemessen' ? 'Ziegel gemessen' : q === 'geschaetzt' ? 'geschätzt' : 'Maße aus Altprojekt'}
                  </span>
                  <button
                    type="button"
                    className="ml-auto h-9 rounded-lg border border-sky-300 px-3 text-xs font-medium text-sky-800 hover:bg-sky-50"
                    onClick={() => markierungNeu(id, flaechen)}
                  >
                    Markierung neu
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={() => onLoeschen(id)}
                  >
                    Entfernen
                  </button>
                </div>
                {!flaechen.every((f) => f.fotoZuordnung?.eckenPx) && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                    Die Gaube ist dem Foto noch zugeordnet, muss nach dem Fotoaustausch aber neu
                    markiert werden. Maße und bisherige Belegung bleiben erhalten.
                  </p>
                )}
                {flaechen.map((gaubenFlaeche) => (
                  <div key={gaubenFlaeche.id}>
                    {flaechen.length > 1 && (
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        Dachseite {gaubenFlaeche.gaubenSeite === 'links' ? 'links' : 'rechts'}
                      </p>
                    )}
                    <GaubenMassEditor
                      flaeche={gaubenFlaeche}
                      onSpeichern={(b, h, messung) =>
                        onMasseAendern(id, gaubenFlaeche.id, b, h, messung)
                      }
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {offen && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            <ToggleButton aktiv={typ === 'flachdach'} onClick={() => setTyp('flachdach')}>
              Flachdachgaube · Stehfalz
            </ToggleButton>
            <ToggleButton aktiv={typ === 'satteldach'} onClick={() => setTyp('satteldach')}>
              Satteldachgaube
            </ToggleButton>
          </div>

          {!markieren && (
            <>
              <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Wie kommen die Maße zustande?</p>
              <div className="flex flex-wrap gap-2">
                <ToggleButton aktiv={quelle === 'aufmass'} onClick={() => setQuelle('aufmass')}>
                  Aufmaß vorhanden
                </ToggleButton>
                <ToggleButton aktiv={quelle === 'ziegel'} onClick={() => setQuelle('ziegel')}>
                  Ziegel zählen
                </ToggleButton>
                <ToggleButton aktiv={quelle === 'nachbardach'} onClick={() => setQuelle('nachbardach')}>
                  Aus Nachbardach schätzen
                </ToggleButton>
              </div>

              {quelle === 'aufmass' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ZahlenEingabe label="Breite der belegbaren Fläche" value={breiteM} onChange={setBreiteM} einheit="m" />
                  <ZahlenEingabe label="Länge Traufe bis First" value={hoeheM} onChange={setHoeheM} einheit="m" />
                </div>
              )}
              {quelle === 'ziegel' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <ZahlenEingabe label="Ziegel quer" value={ziegelQuer} onChange={setZiegelQuer} einheit="Stk." min={1} />
                  <ZahlenEingabe label="Deckbreite" value={deckbreiteCm} onChange={setDeckbreiteCm} einheit="cm" min={1} />
                  <ZahlenEingabe label="Ziegelreihen" value={ziegelReihen} onChange={setZiegelReihen} einheit="Stk." min={1} />
                  <ZahlenEingabe label="Reihenabstand" value={reihenabstandCm} onChange={setReihenabstandCm} einheit="cm" min={1} />
                  <p className="sm:col-span-4 text-sm text-sky-800">
                    Ergibt {fmtDe((ziegelQuer * deckbreiteCm) / 100, 2)} ×{' '}
                    {fmtDe((ziegelReihen * reihenabstandCm) / 100, 2)} m. Quer und längs werden bewusst getrennt gezählt.
                  </p>
                </div>
              )}
              {quelle === 'nachbardach' && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Für Stehfalz ohne sicheres Aufmaß: Das Programm überträgt den lokalen Maßstab des Hauptdachs. Das Ergebnis bleibt sichtbar als <strong>geschätzt</strong> markiert.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="h-11 rounded-lg bg-akzent px-4 text-sm font-semibold text-white" onClick={starten}>
                  Im Foto markieren →
                </button>
                <button type="button" className={sekundar} onClick={reset}>Abbrechen</button>
              </div>
            </>
          )}

          {markieren && (
            <>
              <p className="mb-2 mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
                <strong>{punkte.length < 4 ? `Gaubenumriss: ${4 - punkte.length} Ecke(n) anklicken.` : typ === 'satteldach' && punkte.length < 6 ? `Jetzt die Firstlinie: ${6 - punkte.length} Punkt(e) anklicken.` : 'Markierung vollständig.'}</strong>{' '}
                Die gesetzten Punkte werden nicht automatisch verschoben.
              </p>
              <svg
                viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`}
                className="block w-full cursor-crosshair rounded-xl border border-slate-200 bg-slate-100"
                style={{ aspectRatio: `${foto.breitePx} / ${foto.hoehePx}` }}
                onClick={(e) => {
                  if (punkte.length >= erwartet) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (!rect.width || !rect.height) return;
                  setPunkte([
                    ...punkte,
                    [
                      ((e.clientX - rect.left) / rect.width) * foto.breitePx,
                      ((e.clientY - rect.top) / rect.height) * foto.hoehePx,
                    ],
                  ]);
                }}
                role="img"
                aria-label="Gaube im Dachfoto markieren"
              >
                <image href={foto.dataUrl} x="0" y="0" width={foto.breitePx} height={foto.hoehePx} />
                {punkte.length >= 2 && (
                  <polyline
                    points={punkte.slice(0, 4).map((p) => p.join(',')).join(' ')}
                    fill="none"
                    stroke="#e8603a"
                    strokeWidth={Math.max(3, foto.breitePx * 0.004)}
                  />
                )}
                {punkte.length >= 4 && (
                  <line
                    x1={punkte[3]![0]}
                    y1={punkte[3]![1]}
                    x2={punkte[0]![0]}
                    y2={punkte[0]![1]}
                    stroke="#e8603a"
                    strokeWidth={Math.max(3, foto.breitePx * 0.004)}
                  />
                )}
                {punkte.length >= 5 && (
                  <line
                    x1={punkte[4]![0]}
                    y1={punkte[4]![1]}
                    x2={punkte[5]?.[0] ?? punkte[4]![0]}
                    y2={punkte[5]?.[1] ?? punkte[4]![1]}
                    stroke="#0ea5e9"
                    strokeWidth={Math.max(3, foto.breitePx * 0.004)}
                    strokeDasharray="10 7"
                  />
                )}
                {punkte.map((p, i) => (
                  <g key={i}>
                    <circle cx={p[0]} cy={p[1]} r={Math.max(6, foto.breitePx * 0.008)} fill={i >= 4 ? '#0ea5e9' : '#e8603a'} stroke="white" strokeWidth="3" />
                    <text x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={Math.max(10, foto.breitePx * 0.012)} fontWeight="700">{i + 1}</text>
                  </g>
                ))}
              </svg>

              {quelle === 'nachbardach' && sichtbareSchaetzung && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Geschätztes Maß je Dachseite: <strong>{fmtDe(sichtbareSchaetzung.breiteM, 2)} × {fmtDe(sichtbareSchaetzung.hoeheM, 2)} m</strong>. Für eine genauere Belegung später Aufmaß oder Ziegelwerte verwenden.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
                  disabled={
                    punkte.length < erwartet ||
                    (!bearbeiteId && quelle === 'nachbardach' && !sichtbareSchaetzung)
                  }
                  onClick={erstellen}
                >
                  {bearbeiteId ? 'Markierung übernehmen' : 'Gaube anlegen'}
                </button>
                <button type="button" className={sekundar} disabled={punkte.length === 0} onClick={() => setPunkte(punkte.slice(0, -1))}>Punkt zurück</button>
                <button
                  type="button"
                  className={sekundar}
                  onClick={() => {
                    if (bearbeiteId) reset();
                    else {
                      setMarkieren(false);
                      setPunkte([]);
                    }
                  }}
                >
                  {bearbeiteId ? 'Abbrechen' : 'Maße ändern'}
                </button>
                {!bearbeiteId && <button type="button" className={sekundar} onClick={reset}>Abbrechen</button>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
