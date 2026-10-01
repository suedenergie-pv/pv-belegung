'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** Reine Ansichtsdaten: keine metrische Geometrie, kein Export und keine Historie. */
export interface EditorAnsicht { zoom: number; x: number; y: number }
export const STANDARD_ANSICHT: EditorAnsicht = { zoom: 1, x: 0, y: 0 };
export interface EditorSitzung {
  aktiveFlaecheId: string | null;
  ansichtJeFlaeche: Record<string, string>;
  modus: { art: 'feld_neu' | 'zellen'; flaecheId: string } | null;
  auswahl: { flaecheId: string; indices: number[] } | null;
  mehrfachauswahl: boolean;
  ansichten: Record<string, EditorAnsicht>;
  verschieben: boolean;
  panel: string;
}
export const leereEditorSitzung = (): EditorSitzung => ({
  aktiveFlaecheId: null, ansichtJeFlaeche: {}, modus: null, auswahl: null, mehrfachauswahl: false,
  ansichten: {}, verschieben: false, panel: '',
});
type Patch = Partial<EditorSitzung> | ((alt: EditorSitzung) => Partial<EditorSitzung>);
type SitzungWert = [EditorSitzung, (patch: Patch) => void];
const EditorKontext = createContext<SitzungWert | null>(null);

/** Bleibt über Schritt- und Projektwechsel gemountet; Reload startet eine neue Sitzung. */
export function EditorSitzungProvider({ projektId, children }: { projektId: string; children: ReactNode }) {
  const sitzungen = useRef(new Map<string, EditorSitzung>());
  const [, aktualisieren] = useState(0);
  const aktuelleId = useRef(projektId);
  aktuelleId.current = projektId;
  if (!sitzungen.current.has(projektId)) sitzungen.current.set(projektId, leereEditorSitzung());
  const patch = useCallback((aenderung: Patch) => {
    const id = aktuelleId.current;
    const alt = sitzungen.current.get(id) ?? leereEditorSitzung();
    sitzungen.current.set(id, { ...alt, ...(typeof aenderung === 'function' ? aenderung(alt) : aenderung) });
    aktualisieren((nr) => nr + 1);
  }, []);
  return <EditorKontext.Provider value={[sitzungen.current.get(projektId)!, patch]}>{children}</EditorKontext.Provider>;
}

/** Eigenständige Komponenten/Tests bekommen dieselben Zustände ohne globale Modulvariablen. */
export function useEditorSitzung(): SitzungWert {
  const kontext = useContext(EditorKontext);
  const [lokal, setLokal] = useState(leereEditorSitzung);
  const patch = useCallback((wert: Patch) => setLokal((alt) => ({ ...alt, ...(typeof wert === 'function' ? wert(alt) : wert) })), []);
  return kontext ?? [lokal, patch];
}
