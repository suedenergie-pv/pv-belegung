'use client';

import { useEffect, useRef, useState } from 'react';
import { useEntwurfNavigation } from './entwurf-navigation';

export const projektHash = (id: string | null) => id ? `#/projekt/${encodeURIComponent(id)}` : '';
const idAusHash = () => {
  const treffer = /^#\/projekt\/([^/]+)$/.exec(window.location.hash);
  try { return treffer ? decodeURIComponent(treffer[1]!) : null; }
  catch { return null; }
};

/** Navigation ist Ansichtszustand. aktivId merkt nur das zuletzt geöffnete Projekt.
 * Hash-URLs funktionieren auf dem VPS und im statischen Pages-Unterverzeichnis.
 */
export function useProjektNavigation({ bereit, vorhanden, onWechsel, onFehlt }: {
  bereit: boolean;
  vorhanden: (id: string) => boolean;
  onWechsel: (id: string | null) => void;
  onFehlt: () => void;
}) {
  const entwurf = useEntwurfNavigation();
  const [projektId, setProjektId] = useState<string | null>(null);
  const aktuell = useRef({ vorhanden, onWechsel, onFehlt });
  aktuell.current = { vorhanden, onWechsel, onFehlt };
  const position = useRef(0);
  const oeffnenRef = useRef<(id: string | null, ersetzen?: boolean) => void>(() => {});

  useEffect(() => {
    if (!bereit) return;
    const anwenden = (id: string | null) => {
      if (id && !aktuell.current.vorhanden(id)) {
        aktuell.current.onFehlt();
        id = null;
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      }
      setProjektId(id);
      aktuell.current.onWechsel(id);
    };
    const markieren = (index: number) => window.history.replaceState(
      { ...window.history.state, pvProjektPosition: index }, '', window.location.href,
    );
    position.current = Number.isInteger(window.history.state?.pvProjektPosition) ? window.history.state.pvProjektPosition : 0;
    markieren(position.current);
    anwenden(idAusHash());

    oeffnenRef.current = (id, ersetzen = false) => {
      const hash = projektHash(id);
      if (window.location.hash !== hash) {
        if (!ersetzen) position.current++;
        window.history[ersetzen ? 'replaceState' : 'pushState'](
          { ...window.history.state, pvProjektPosition: position.current }, '',
          window.location.pathname + window.location.search + hash,
        );
      }
      anwenden(id);
    };

    let nachRueckkehr: (() => void) | null = null;
    let freigegeben: number | null = null;
    const zurueckVor = (event: PopStateEvent) => {
      if (nachRueckkehr) {
        const fortsetzen = nachRueckkehr;
        nachRueckkehr = null;
        fortsetzen();
        return;
      }
      const ziel = Number.isInteger(event.state?.pvProjektPosition) ? event.state.pvProjektPosition : position.current + 1;
      const id = idAusHash();
      const delta = ziel - position.current;
      if (freigegeben !== ziel && delta && entwurf.hatEntwurf()) {
        // Zuerst den gültigen URL-/History-Stand wiederherstellen. Bleiben darf
        // weder die Projektansicht noch den nächsten Zurück-Schritt verändern.
        nachRueckkehr = () => entwurf.weiter(() => {
          freigegeben = ziel;
          window.history.go(delta);
        });
        window.history.go(-delta);
        return;
      }
      freigegeben = null;
      position.current = ziel;
      markieren(ziel);
      anwenden(id);
    };
    window.addEventListener('popstate', zurueckVor);
    return () => window.removeEventListener('popstate', zurueckVor);
  }, [bereit, entwurf]);

  return { projektId, oeffnen: (id: string | null, ersetzen = false) => oeffnenRef.current(id, ersetzen) };
}
