'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type OffenerEntwurf = { name: string; gueltig: () => boolean; uebernehmen: () => void; verwerfen: () => void };
type Navigation = { registriere: (id: string, entwurf: OffenerEntwurf) => () => void; weiter: (aktion: () => void) => void };
const Kontext = createContext<Navigation>({ registriere: () => () => {}, weiter: (aktion) => aktion() });
export const useEntwurfNavigation = () => useContext(Kontext);

/** Ungespeicherte Geometrieentwürfe vor einem Wechsel bewusst auflösen. */
export function EntwurfNavigationProvider({ children }: { children: React.ReactNode }) {
  const entwuerfe = useRef(new Map<string, OffenerEntwurf>());
  const fortsetzung = useRef<(() => void) | null>(null);
  const [offen, setOffen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const vorherigerFokus = useRef<HTMLElement | null>(null);
  const api = useRef<Navigation>({
    registriere(id, entwurf) {
      entwuerfe.current.set(id, entwurf);
      return () => { entwuerfe.current.delete(id); };
    },
    weiter(aktion) {
      if (!entwuerfe.current.size) { aktion(); return; }
      fortsetzung.current = aktion;
      vorherigerFokus.current = document.activeElement as HTMLElement;
      setOffen(true);
    },
  }).current;
  useEffect(() => {
    if (offen) dialogRef.current?.showModal?.();
    else dialogRef.current?.close?.();
  }, [offen]);
  useEffect(() => {
    const warnen = (event: BeforeUnloadEvent) => {
      if (entwuerfe.current.size) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, []);
  const bleiben = () => {
    fortsetzung.current = null;
    setOffen(false);
    vorherigerFokus.current?.focus();
  };
  const abschliessen = (uebernehmen: boolean) => {
    const liste = [...entwuerfe.current.values()];
    // Erst alle prüfen: eine ungültige zweite Fläche darf keine erste speichern.
    if (uebernehmen && liste.some((entwurf) => !entwurf.gueltig())) { bleiben(); return; }
    for (const entwurf of liste) {
      if (uebernehmen) entwurf.uebernehmen();
      else entwurf.verwerfen();
    }
    entwuerfe.current.clear();
    const weiter = fortsetzung.current;
    fortsetzung.current = null;
    setOffen(false);
    weiter?.();
  };
  return <Kontext.Provider value={api}>
    {children}
    <dialog ref={dialogRef} aria-labelledby="entwurf-dialog-titel" onCancel={(e) => { e.preventDefault(); bleiben(); }} className="max-w-md rounded-2xl border border-slate-300 p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
      {offen && <>
        <h2 id="entwurf-dialog-titel" className="text-lg font-semibold">Maßentwurf noch offen</h2>
        <p className="my-3 text-sm text-slate-600">Änderungen an {Array.from(entwuerfe.current.values()).map((e) => e.name).join(', ')} sind noch nicht übernommen.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => abschliessen(true)} className="rounded-lg bg-akzent px-4 text-sm font-semibold text-white">Übernehmen</button>
          <button type="button" onClick={() => abschliessen(false)} className="rounded-lg border border-slate-300 px-4 text-sm font-semibold">Verwerfen</button>
          <button autoFocus type="button" onClick={bleiben} className="rounded-lg border border-slate-300 px-4 text-sm font-semibold">Bleiben</button>
        </div>
      </>}
    </dialog>
  </Kontext.Provider>;
}
