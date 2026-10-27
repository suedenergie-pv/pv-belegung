'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SPEICHER_SCHLUESSEL } from './speicher';

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

// Der bestehende Projektspeicher trennt SüdEnergie, LCV und dort die Konten.
// Nur die Auswahl merken: Werkzeugmodi und ungespeicherte Entwürfe nicht wiederbeleben.
const auswahlKey = (projektId: string) => `${SPEICHER_SCHLUESSEL.aktuell}:editor-auswahl-v1:${encodeURIComponent(projektId)}`;
function ladeAuswahl(projektId: string): Pick<EditorSitzung, 'aktiveFlaecheId' | 'ansichtJeFlaeche'> {
  const leer = { aktiveFlaecheId: null, ansichtJeFlaeche: {} };
  try {
    const roh: unknown = JSON.parse(window.sessionStorage.getItem(auswahlKey(projektId)) ?? 'null');
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return leer;
    const wert = roh as Record<string, unknown>;
    const ansichten = wert.ansichtJeFlaeche;
    return {
      aktiveFlaecheId: typeof wert.aktiveFlaecheId === 'string' && wert.aktiveFlaecheId ? wert.aktiveFlaecheId : null,
      ansichtJeFlaeche: ansichten && typeof ansichten === 'object' && !Array.isArray(ansichten)
        ? Object.fromEntries(Object.entries(ansichten).filter(([id, foto]) => id && typeof foto === 'string' && foto))
        : {},
    };
  } catch { return leer; }
}
function speichereAuswahl(projektId: string, sitzung: EditorSitzung) {
  try {
    window.sessionStorage.setItem(auswahlKey(projektId), JSON.stringify({
      aktiveFlaecheId: sitzung.aktiveFlaecheId, ansichtJeFlaeche: sitzung.ansichtJeFlaeche,
    }));
  } catch { /* Gesperrter Browserspeicher darf das Bearbeiten nicht unterbrechen. */ }
}

/** Bleibt über Schritt-/Projektwechsel erhalten; nach Reload dieselbe Dachfläche öffnen. */
export function EditorSitzungProvider({ projektId, children }: { projektId: string; children: ReactNode }) {
  const sitzungen = useRef(new Map<string, EditorSitzung>());
  const geladen = useRef(new Set<string>());
  const [, aktualisieren] = useState(0);
  const aktuelleId = useRef(projektId);
  aktuelleId.current = projektId;
  if (!sitzungen.current.has(projektId)) sitzungen.current.set(projektId, leereEditorSitzung());
  useEffect(() => {
    if (geladen.current.has(projektId)) return;
    geladen.current.add(projektId);
    sitzungen.current.set(projektId, { ...sitzungen.current.get(projektId)!, ...ladeAuswahl(projektId) });
    aktualisieren((nr) => nr + 1);
  }, [projektId]);
  const patch = useCallback((aenderung: Patch) => {
    const id = aktuelleId.current;
    const alt = sitzungen.current.get(id) ?? leereEditorSitzung();
    const neu = { ...alt, ...(typeof aenderung === 'function' ? aenderung(alt) : aenderung) };
    sitzungen.current.set(id, neu);
    if (alt.aktiveFlaecheId !== neu.aktiveFlaecheId || alt.ansichtJeFlaeche !== neu.ansichtJeFlaeche) speichereAuswahl(id, neu);
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
