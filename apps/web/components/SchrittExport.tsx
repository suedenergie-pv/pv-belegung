'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  aktiveModule,
  ausrichtungenVon,
  flaechenAusrichtungsLabel,
  bauePayload,
  downloadDateiname,
  flaechenTitel,
  flaecheM2,
  fmtDe,
  kwpGesamt,
  modulById,
  projektFreigabe,
  rasterFuer,
  wrById,
  type Projekt,
} from '../lib/model';
import { erzeugeBelegungsPdf } from '../lib/pdf-export';
import { ProjektFotoSvg } from './GesamtSvg';
import { Karte, KartenTitel } from './ui';

export function SchrittExport({
  projekt,
  onChange,
  onSpringeZu,
}: {
  projekt: Projekt;
  onChange: (projekt: Projekt) => void;
  onSpringeZu?: (schritt: 0 | 1 | 2, sprungziel: string) => void;
}) {
  const modul = modulById(projekt.modulId);
  const freigabe = useMemo(() => projektFreigabe(projekt), [projekt]);
  const result = freigabe.stringResult;
  const [kopiert, setKopiert] = useState(false);
  const [statusMeldung, setStatusMeldung] = useState<string | null>(null);
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  const [pdfFehler, setPdfFehler] = useState<string | null>(null);
  const [eskalationsgrund, setEskalationsgrund] = useState(projekt.eskalationsgrund ?? '');
  const renderRef = useRef<HTMLDivElement>(null);

  const stringExportGesperrt = freigabe.fehler.some((f) => f.bereich === 'stringplan');
  const exportGesperrt = !freigabe.json;
  const payload = useMemo(() => bauePayload(projekt, result), [projekt, result]);
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const pdfHerunterladen = async () => {
    setPdfLaeuft(true);
    setPdfFehler(null);
    try {
      await erzeugeBelegungsPdf(
        projekt,
        result,
        (fotoId) =>
          renderRef.current?.querySelector<SVGSVGElement>(`[data-foto="${fotoId}"] svg`) ??
          null,
      );
    } catch (e) {
      setPdfFehler(e instanceof Error ? e.message : 'PDF-Erzeugung fehlgeschlagen');
    } finally {
      setPdfLaeuft(false);
    }
  };

  const dateiHerunterladen = (inhalt: string, name: string) => {
    try {
      const blob = new Blob([inhalt], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      // Firefox/Safari brauchen die URL noch bis nach dem abgeschlossenen Klickzyklus.
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatusMeldung(`${name} wurde zum Download bereitgestellt.`);
    } catch (e) {
      setStatusMeldung(e instanceof Error ? e.message : 'Download fehlgeschlagen.');
    }
  };

  const springeZu = (bereich: 'projekt' | 'belegung' | 'stringplan', ziel: string) => {
    onSpringeZu?.(bereich === 'projekt' ? 0 : bereich === 'belegung' ? 1 : 2, ziel);
  };

  return (
    <div className="space-y-4">
      <Karte>
        <KartenTitel>Zusammenfassung</KartenTitel>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <span className="text-4xl font-bold">{fmtDe(kwpGesamt(projekt), 2)}</span>
            <span className="ml-1 text-lg font-semibold text-slate-500">kWp</span>
          </div>
          {projekt.kunde && <span className="text-slate-500">{projekt.kunde}</span>}
          {projekt.adresse && <span className="text-slate-400">{projekt.adresse}</span>}
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-slate-500">Modul</dt>
            <dd className="font-medium">{modul.name}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-slate-500">Wechselrichter</dt>
            <dd className="font-medium">{projekt.wrId ? wrById(projekt.wrId).name : '— (nur Belegung)'}</dd>
          </div>
          {projekt.flaechen.map((f, i) => {
            const raster = rasterFuer(f, modul);
            const ausrichtungen = ausrichtungenVon(f, raster);
            return (
              <div key={f.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">
                  {flaechenTitel(f, i)} · {f.neigungDeg}° · {flaechenAusrichtungsLabel(f)}
                </dt>
                <dd className="font-medium">
                  {aktiveModule(f, raster)} Module ({ausrichtungen.bezeichnung}) ·{' '}
                  {fmtDe(flaecheM2(f), 1)} m²
                </dd>
              </div>
            );
          })}
          {result && (
            <div
              className={`rounded-lg px-3 py-2 ${result.valid ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <dt className="text-slate-500">Regelprüfung R1–R12</dt>
              <dd className={`font-medium ${result.valid ? 'text-green-700' : 'text-red-700'}`}>
                {result.valid ? 'bestanden' : 'NICHT bestanden'}
              </dd>
            </div>
          )}
        </dl>
      </Karte>

      <Karte>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <KartenTitel>Belegungsplan (PDF)</KartenTitel>
          <button
            type="button"
            disabled={pdfLaeuft || !freigabe.pdf}
            className="ml-auto h-12 rounded-xl bg-akzent px-6 text-sm font-semibold text-white transition enabled:hover:bg-akzent/90 disabled:cursor-wait disabled:opacity-60"
            onClick={() => void pdfHerunterladen()}
          >
            {pdfLaeuft ? 'Erzeuge PDF …' : 'PDF herunterladen'}
          </button>
        </div>
        {result && !result.valid && (
          <p className="text-sm text-slate-500">
            Der aktuelle Stringplan ist ungültig und wird im PDF weggelassen.
          </p>
        )}
        {!freigabe.pdf && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <strong>PDF noch gesperrt. Bitte korrigieren:</strong>
            <ul className="mt-2 space-y-1">
              {freigabe.fehler.map((fehler) => (
                <li key={fehler.id} className="flex items-center justify-between gap-3">
                  <span>{fehler.meldung}</span>
                  <button
                    type="button"
                    className="touch-target shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-semibold"
                    onClick={() => springeZu(fehler.bereich, fehler.sprungziel)}
                  >
                    Zum Fehler
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pdfFehler && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pdfFehler}</p>
        )}
      </Karte>

      <Karte>
        <details>
          <summary className="touch-target flex cursor-pointer list-none items-center gap-3 text-sm font-semibold text-slate-700">
            Technische Daten (JSON)
            <span className="ml-auto text-xs font-normal text-slate-400">für das Ticketsystem</span>
          </summary>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={exportGesperrt}
              className="h-12 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                void navigator.clipboard.writeText(json).then(
                  () => {
                    setKopiert(true);
                    setStatusMeldung('JSON wurde kopiert.');
                    setTimeout(() => setKopiert(false), 2000);
                  },
                  () => setStatusMeldung('Kopieren fehlgeschlagen. Bitte JSON-Datei herunterladen.'),
                );
              }}
            >
              {kopiert ? '✓ Kopiert' : 'JSON kopieren'}
            </button>
            <button
              type="button"
              disabled={exportGesperrt}
              className="h-12 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => dateiHerunterladen(json, downloadDateiname(projekt, 'belegung', 'json'))}
            >
              JSON-Datei herunterladen
            </button>
            </div>
          </div>
          {exportGesperrt && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="min-w-60 flex-1">
              Export gesperrt. Die konkrete Fehlerliste steht oben beim PDF.
            </p>
            {stringExportGesperrt && <button
              type="button"
              className="touch-target rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold text-red-700 hover:bg-red-100"
              onClick={() => onChange({ ...projekt, wrId: null, mppts: [] })}
            >
              Alten Stringplan entfernen
            </button>}
          </div>
          )}
          <pre className="max-h-60 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
            {json}
          </pre>
          <p className="mt-2 text-xs text-slate-400">
            Anbindung an das Ticketsystem („Vorplanung Vertrieb") folgt — bis dahin JSON kopieren
            oder als Datei ans Ticket hängen.
          </p>
        </details>
      </Karte>

      <Karte id="export-stringplan">
        <KartenTitel>Komplexes Dach eskalieren</KartenTitel>
        <p className="mb-3 text-sm text-slate-600">
          Wenn die Geometrie im Foto nicht zuverlässig lösbar ist, Rohdaten sichern und das
          Projekt bewusst an die Projektleitung geben. Die direkte Ticketerstellung folgt erst
          nach Freigabe der Ticketsystem-Kategorie.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="h-12 flex-1 rounded-xl border border-slate-300 px-3 text-base"
            value={eskalationsgrund}
            onChange={(e) => setEskalationsgrund(e.target.value)}
            placeholder="Grund, optional"
            aria-label="Eskalationsgrund"
          />
          <button
            type="button"
            className="touch-target rounded-xl border border-akzent bg-white px-4 font-semibold text-akzent"
            onClick={() => {
              onChange({
                ...projekt,
                eskaliert: true,
                eskalationsgrund: eskalationsgrund.trim() || undefined,
              });
              setStatusMeldung('Projekt ist als komplexes Dach für die Projektleitung markiert.');
            }}
          >
            Komplexes Dach → an PL
          </button>
          <button
            type="button"
            className="touch-target rounded-xl bg-slate-800 px-4 font-semibold text-white"
            onClick={() => dateiHerunterladen(
              JSON.stringify({ format: 'pvbelegung-rohdaten', version: 1, projekt }, null, 2),
              `rohdaten-${downloadDateiname(projekt, 'belegung', 'json')}`,
            )}
          >
            Rohdaten sichern
          </button>
        </div>
        {projekt.eskaliert && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            Eskaliert{projekt.eskalationsgrund ? `: ${projekt.eskalationsgrund}` : ''}
          </p>
        )}
      </Karte>

      <div aria-live="polite" className="sr-only">
        {statusMeldung}
      </div>

      {/* Offscreen-Render der Foto-Gruppen für den foto-basierten PDF-Export. */}
      <div
        ref={renderRef}
        aria-hidden
        className="pointer-events-none fixed top-0 h-0 overflow-hidden"
        style={{ left: -10000, width: 1400 }}
      >
        {projekt.fotos.map((foto) => (
          <div key={foto.id} data-foto={foto.id} style={{ width: 1400 }}>
            <ProjektFotoSvg projekt={projekt} foto={foto} nurFertige />
          </div>
        ))}
      </div>
    </div>
  );
}
