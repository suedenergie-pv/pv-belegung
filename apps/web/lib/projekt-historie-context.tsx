'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Projekt } from './model';
import { ProjektHistorien } from './projekt-historie';

export interface ProjektHistorie {
  begin: (geste?: string) => void;
  end: (geste?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  /** Only undo/redo changes this value, so editors can discard transient selections. */
  revision: number;
  zentral: boolean;
}

export const ProjektHistorieContext = createContext<ProjektHistorie | null>(null);
export const useProjektHistorie = () => useContext(ProjektHistorieContext);

export function useHistorienVerwaltung(
  projektId: string,
  projekt: Projekt,
  onWiederherstellen: (projekt: Projekt) => void,
  zentral = true,
) {
  const speicher = useRef(new ProjektHistorien());
  const aktuell = useRef({ projektId, projekt, onWiederherstellen });
  aktuell.current = { projektId, projekt, onWiederherstellen };
  const [, render] = useState(0);
  const [revision, setRevision] = useState(0);
  const neuZeigen = () => render((wert) => wert + 1);
  const record = (vorher: Projekt, nachher: Projekt) => {
    speicher.current.record(aktuell.current.projektId, vorher, nachher);
    aktuell.current.projekt = nachher;
    neuZeigen();
  };
  const wiederherstellen = (richtung: 'undo' | 'redo') => {
    const wert = aktuell.current;
    const stand = speicher.current[richtung](wert.projektId, wert.projekt);
    if (!stand) return;
    aktuell.current.projekt = stand;
    wert.onWiederherstellen(stand);
    setRevision((revision) => revision + 1);
    neuZeigen();
  };
  const status = speicher.current.status(projektId);
  const historie: ProjektHistorie = {
    begin: (geste = 'aenderung') => speicher.current.begin(aktuell.current.projektId, geste),
    end: (geste) => { speicher.current.end(aktuell.current.projektId, geste); neuZeigen(); },
    undo: () => wiederherstellen('undo'),
    redo: () => wiederherstellen('redo'),
    canUndo: status.undoCount > 0,
    canRedo: status.redoCount > 0,
    ...status,
    revision,
    zentral,
  };
  return { historie, record, forget: (id: string) => speicher.current.forget(id) };
}

function istEingabe(ziel: EventTarget | null) {
  return ziel instanceof HTMLTextAreaElement ||
    (ziel instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'file', 'submit'].includes(ziel.type));
}

/** A completed input and a held arrow key are single commands, not one command per event. */
export function HistorienEingaben({ children }: { children: React.ReactNode }) {
  const historie = useProjektHistorie();
  const ref = useRef(historie);
  ref.current = historie;
  useEffect(() => {
    const tasteLos = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) ref.current?.end(`taste-${event.key}`);
    };
    const fokusVerloren = () => ref.current?.end();
    window.addEventListener('keyup', tasteLos);
    window.addEventListener('blur', fokusVerloren);
    return () => {
      window.removeEventListener('keyup', tasteLos);
      window.removeEventListener('blur', fokusVerloren);
    };
  }, []);
  return <div
    className="contents"
    onFocusCapture={(event) => { if (istEingabe(event.target)) historie?.begin('eingabe'); }}
    onBlur={(event) => { if (istEingabe(event.target)) historie?.end('eingabe'); }}
    onKeyDownCapture={(event) => {
      if (istEingabe(event.target)) return;
      if (event.key.startsWith('Arrow')) historie?.begin(`taste-${event.key}`);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) historie?.redo(); else historie?.undo();
      }
    }}
  >{children}</div>;
}

/** Standalone consumers use the same implementation; the application always provides the central history. */
export function LokaleProjektHistorie({ projekt, onChange, children }: {
  projekt: Projekt;
  onChange: (projekt: Projekt) => void;
  children: (onChange: (projekt: Projekt) => void) => React.ReactNode;
}) {
  const { historie, record } = useHistorienVerwaltung('einzelprojekt', projekt, onChange, false);
  const ref = useRef(projekt);
  ref.current = projekt;
  return <ProjektHistorieContext.Provider value={historie}>
    <HistorienEingaben>{children((neu) => {
      record(ref.current, neu);
      ref.current = neu;
      onChange(neu);
    })}</HistorienEingaben>
  </ProjektHistorieContext.Provider>;
}
