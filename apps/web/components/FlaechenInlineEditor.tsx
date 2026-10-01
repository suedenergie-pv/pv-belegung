'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { artVon, fmtDe, massFreigabe, modulById, rasterFuer, aktiveModule, type Flaeche, type Projekt, zonenVon } from '../lib/model';
import { useEntwurfNavigation } from '../lib/entwurf-navigation';
import { geometrieEntwurfAufStand } from '../lib/geometrie-entwurf';
import { patchFlaechenGeometrie } from '../lib/model';
import { SchrittFlaechen } from './SchrittFlaechen';
import { ZonenBadge } from './ui';
import styles from './FlaechenInlineEditor.module.css';

export function FlaechenInlineEditor({
  projekt, flaeche, index, onPatch, onFotoPruefen,
  fotoFokusAktiv = false, onLoeschen, flaecheKwp, massVorschlag,
  kompakt = false, initialOffen = false, onVorschau, onSchliessen,
}: {
  projekt: Projekt; flaeche: Flaeche; index: number;
  onProjektChange: (projekt: Projekt) => void;
  onPatch: (patch: Partial<Flaeche>) => void;
  onFotoPruefen?: () => void; fotoFokusAktiv?: boolean;
  onLoeschen?: () => void; flaecheKwp: number; gesamtKwp: number;
  massVorschlag?: { breiteM: number; hoeheM: number };
  /** Aufrufbares Detailpanel im gemeinsamen Editor, ohne zweite Flächenkarte. */
  kompakt?: boolean;
  initialOffen?: boolean;
  onVorschau?: (flaeche: Flaeche | null) => void;
  onSchliessen?: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Flaeche | null>(() => initialOffen || !flaeche.grunddatenFertig || !massFreigabe(flaeche).belegen ? flaeche : null);
  const basis = useRef(flaeche);
  const [geaendert, setGeaendert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const formularRef = useRef<HTMLDivElement>(null);
  const navigation = useEntwurfNavigation();
  const entwurfAbmelden = useRef<(() => void) | null>(null);
  const vorschau = useMemo(() => entwurf ? geometrieEntwurfAufStand(basis.current, entwurf, flaeche) : null, [entwurf, flaeche]);
  const vorschauCallback = useRef(onVorschau);
  vorschauCallback.current = onVorschau;
  useEffect(() => { vorschauCallback.current?.(vorschau); }, [vorschau]);
  useEffect(() => () => vorschauCallback.current?.(null), []);
  const aktuell = useRef({ entwurf: vorschau, onPatch });
  aktuell.current = { entwurf: vorschau, onPatch };
  const verwerfen = (schliessen = true) => {
    entwurfAbmelden.current?.();
    entwurfAbmelden.current = null;
    setEntwurf(null); setGeaendert(false); setFehler(null); vorschauCallback.current?.(null);
    if (schliessen) onSchliessen?.();
  };
  const gueltig = () => {
    const stand = aktuell.current.entwurf;
    const ungueltig = formularRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]');
    if (stand && (ungueltig || !massFreigabe(stand).gueltig)) {
      setFehler('Bitte die markierten Angaben korrigieren. Der bisherige Plan bleibt erhalten.');
      ungueltig?.focus();
      return false;
    }
    return true;
  };
  const uebernehmen = (schliessen = true) => {
    if (!gueltig() || !aktuell.current.entwurf) return;
    // Entwurf enthält bereits metrisch skalierte Felder; Elternkomponente übernimmt atomar.
    aktuell.current.onPatch({ ...aktuell.current.entwurf, grunddatenFertig: true, massStatus: 'bestaetigt' });
    verwerfen(schliessen);
  };
  const callbacks = useRef({ gueltig, uebernehmen, verwerfen });
  callbacks.current = { gueltig, uebernehmen, verwerfen };
  useEffect(() => {
    if (!geaendert) return;
    const abmelden = navigation.registriere(`masse-${flaeche.id}`, {
      name: flaeche.name,
      gueltig: () => callbacks.current.gueltig(),
      uebernehmen: () => callbacks.current.uebernehmen(false),
      verwerfen: () => callbacks.current.verwerfen(false),
    });
    entwurfAbmelden.current = abmelden;
    return abmelden;
  }, [geaendert, flaeche.id, flaeche.name, navigation]);
  useEffect(() => { if (!geaendert) { basis.current = flaeche; setEntwurf((alt) => alt ? flaeche : null); } }, [flaeche, geaendert]);
  useEffect(() => {
    if (!massVorschlag) return;
    setEntwurf((alt) => patchFlaechenGeometrie(alt ?? basis.current, massVorschlag));
    setGeaendert(true);
    setFehler(null);
    document.getElementById(`flaechen-masse-${basis.current.id}`)?.scrollIntoView?.({ block: 'start' });
  }, [massVorschlag]);
  const modul = modulById(projekt.modulId);
  const vorher = aktiveModule(flaeche, rasterFuer(flaeche, modul));
  const nachher = vorschau ? aktiveModule(vorschau, rasterFuer(vorschau, modul)) : vorher;
  const freigabe = massFreigabe(flaeche);
  const neuKalibrieren = !!vorschau?.fotoZuordnungen?.some((z) => z.perspektiveBestaetigt === false) && !!flaeche.fotoZuordnungen?.some((z) => z.perspektiveBestaetigt === true);
  return <div id={`flaechen-masse-${flaeche.id}`} className={kompakt ? styles.kompakt : 'mb-4 rounded-xl border border-slate-200 bg-white p-3'} data-masspanel={kompakt || undefined}>
    <div className="flex flex-wrap items-center gap-3">
      {!kompakt && <ZonenBadge label={zonenVon(flaeche, index)} />}
      <div className="min-w-0 flex-1">
        {!kompakt && <strong className="block text-sm text-slate-800">{flaeche.name}</strong>}
        <span className="text-sm text-slate-600">{artVon(flaeche) === 'flachdach' ? 'Flachdach' : artVon(flaeche) === 'fassade' ? 'Fassade' : 'Schrägdach'} · {fmtDe(flaeche.breiteM)} × {fmtDe(flaeche.hoeheM)} m</span>
      </div>
      {!kompakt && <span aria-label={`Leistung ${flaeche.name}: ${fmtDe(flaecheKwp, 2)} kWp`} className="text-sm font-semibold text-slate-800">{vorher} Module · {fmtDe(flaecheKwp, 2)} kWp</span>}
      {!entwurf && <button type="button" onClick={() => { basis.current = flaeche; setEntwurf(flaeche); setFehler(null); }} className="rounded-lg border border-slate-300 px-3 text-sm font-semibold">{freigabe.belegen ? 'Maße & Dachform' : 'Maße bestätigen'}</button>}
      {onFotoPruefen && <button type="button" aria-pressed={fotoFokusAktiv} onClick={onFotoPruefen} className="rounded-lg border border-slate-300 px-3 text-sm font-semibold">{fotoFokusAktiv ? 'Foto im Blick' : 'Am Foto anpassen'}</button>}
      {onLoeschen && <button type="button" onClick={() => navigation.weiter(onLoeschen)} className="rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700">Entfernen</button>}
    </div>
    <p className="mt-2 text-xs text-slate-600">Maße: {freigabe.status === 'bestaetigt' ? 'von dir bestätigt' : freigabe.status === 'bestand' ? 'aus bestehender Belegung übernommen' : 'Entwurf · noch nicht bestätigt'}</p>
    {entwurf && <div ref={formularRef} className="mt-4 border-t border-slate-200 pt-4" data-geometrie-entwurf onChange={() => setGeaendert(true)}>
      <p className="mb-3 text-sm font-medium text-slate-700">{kompakt ? 'Wahre Maße eingeben und Vorschau prüfen.' : 'Maßentwurf – der bisherige Plan bleibt bis zur Übernahme erhalten.'}</p>
      <SchrittFlaechen projekt={{ ...projekt, flaechen: projekt.flaechen.map((f) => f.id === vorschau!.id ? vorschau! : f) }} onChange={(p) => {
        setEntwurf(p.flaechen.find((f) => f.id === flaeche.id) ?? null);
        setGeaendert(true); setFehler(null);
      }} nurFlaecheId={flaeche.id} eingebettet entwurfsModus />
      <p className="my-3 text-sm font-semibold text-slate-800" aria-live="polite">Vorschau: {vorher} → {nachher} Module</p>
      {neuKalibrieren && <p className="mb-3 text-sm text-amber-900">Nach dem Übernehmen müssen die Dachecken neu bestätigt werden.</p>}
      {fehler && <p role="alert" className="mb-3 text-sm text-red-700">{fehler}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => uebernehmen()} className="rounded-lg bg-akzent px-4 text-sm font-semibold text-white">Maße übernehmen</button>
        <button type="button" onClick={() => verwerfen()} className="rounded-lg border border-slate-300 px-4 text-sm font-semibold">Abbrechen</button>
      </div>
      <p className="mt-2 text-xs text-slate-600">Übernehmen bestätigt deine Angaben; es ersetzt keine unabhängige Vermessung.</p>
    </div>}
  </div>;
}
