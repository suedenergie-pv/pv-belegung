'use client';

import { createContext, useContext, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';

const Kontext = createContext<{ ziel: HTMLDivElement | null; setZiel: Dispatch<SetStateAction<HTMLDivElement | null>> } | null>(null);

/** Eine Aktion, ein DOM-Ort: Formularlogik bleibt beim Werkzeug, die Aktion im festen Fuß. */
export function EditorAktionsRahmen({ children }: { children: ReactNode }) {
  const [ziel, setZiel] = useState<HTMLDivElement | null>(null);
  const wert = useMemo(() => ({ ziel, setZiel }), [ziel]);
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}
export function EditorAktionsZiel() {
  const kontext = useContext(Kontext);
  return <div ref={kontext?.setZiel} data-editor-aktionsziel />;
}
export function EditorAktionen({ children }: { children: ReactNode }) {
  const kontext = useContext(Kontext);
  const inhalt = <div data-editor-aktionen>{children}</div>;
  return kontext ? kontext.ziel ? createPortal(inhalt, kontext.ziel) : null : inhalt;
}
