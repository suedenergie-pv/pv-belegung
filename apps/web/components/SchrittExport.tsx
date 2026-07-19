'use client';

import { useMemo, useRef, useState } from 'react';
import {
  aktiveModule,
  ausrichtungenVon,
  flaechenAusrichtungsLabel,
  bauePayload,
  dachFotoVon,
  flaechenTitel,
  flaecheM2,
  fmtDe,
  kwpGesamt,
  modulById,
  pruefeStringplan,
  rasterFuer,
  wrById,
  zuordnungsHinweise,
  type Projekt,
} from '../lib/model';
import { erzeugeBelegungsPdf } from '../lib/pdf-export';
import { DachSvg } from './DachSvg';
import { ProjektFotoSvg } from './GesamtSvg';
import { Karte, KartenTitel } from './ui';

export function SchrittExport({ projekt }: { projekt: Projekt }) {
  const modul = modulById(projekt.modulId);
  const result = useMemo(() => pruefeStringplan(projekt), [projekt]);
  const zuordnung = zuordnungsHinweise(projekt);
  const [kopiert, setKopiert] = useState(false);
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  const [pdfFehler, setPdfFehler] = useState<string | null>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  const exportGesperrt = (result !== null && !result.valid) || zuordnung.fehler.length > 0;
  const payload = useMemo(() => bauePayload(projekt, result), [projekt, result]);
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const pdfHerunterladen = async () => {
    setPdfLaeuft(true);
    setPdfFehler(null);
    try {
      await erzeugeBelegungsPdf(
        projekt,
        result,
        (flaecheId) =>
          renderRef.current?.querySelector<SVGSVGElement>(`[data-flaeche="${flaecheId}"] svg`) ??
          null,
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
            disabled={pdfLaeuft}
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
        {pdfFehler && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pdfFehler}</p>
        )}
      </Karte>

      <Karte>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <KartenTitel>Ticketsystem-Payload (JSON)</KartenTitel>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={exportGesperrt}
              className="h-12 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                void navigator.clipboard.writeText(json).then(() => {
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 2000);
                });
              }}
            >
              {kopiert ? '✓ Kopiert' : 'JSON kopieren'}
            </button>
            <button
              type="button"
              disabled={exportGesperrt}
              className="h-12 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `belegung-${(projekt.kunde || 'projekt').toLowerCase().replace(/\s+/g, '-')}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download
            </button>
          </div>
        </div>
        {exportGesperrt && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            JSON-Export gesperrt: Der hinterlegte Stringplan ist ungültig (SPEC §7) oder es sind
            mehr Module verstringt als belegt. (Wechselrichter/Strings stammen aus einer früheren
            Planung — der Stringcheck-Schritt ist ausgeblendet.) Das PDF oben bleibt verfügbar.
          </p>
        )}
        <pre className="max-h-60 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          {json}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Anbindung an das Ticketsystem („Vorplanung Vertrieb") folgt — bis dahin JSON kopieren
          oder als Datei ans Ticket hängen.
        </p>
      </Karte>

      {/* Offscreen-Render für die PDF-Rasterung: identische DachSvg-Komponenten,
          Maße bleiben mm × Maßstab (SPEC §3.5) — nur unsichtbar positioniert. */}
      <div
        ref={renderRef}
        aria-hidden
        className="pointer-events-none fixed top-0 h-0 overflow-hidden"
        style={{ left: -10000, width: 1400 }}
      >
        {projekt.flaechen.map((f) => {
          const foto = dachFotoVon(projekt, f);
          const renderFlaeche = foto ? { ...f, foto } : f;
          return (
            <div key={f.id} data-flaeche={f.id} style={{ width: 1400 }}>
              <DachSvg
                flaeche={renderFlaeche}
                raster={rasterFuer(f, modul)}
                modul={modul}
                druck
              />
            </div>
          );
        })}
        {projekt.fotos.map((foto) => (
          <div key={foto.id} data-foto={foto.id} style={{ width: 1400 }}>
            <ProjektFotoSvg projekt={projekt} foto={foto} nurFertige />
          </div>
        ))}
      </div>
    </div>
  );
}
