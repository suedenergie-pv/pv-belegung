'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './FlaecheEntfernenDialog.module.css';

export type FlaechenLoeschauftrag = {
  titel: string;
  text: string;
  entfernen: () => void;
};

/** Die Löschbestätigung bleibt bedienbar, auch wenn der Browser confirm unterdrückt. */
export function FlaecheEntfernenDialog({ auftrag, onSchliessen }: {
  auftrag: FlaechenLoeschauftrag;
  onSchliessen: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const erledigt = useRef(false);
  const titelId = useId();
  const textId = useId();
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const schliessen = (entfernen: boolean) => {
    if (erledigt.current) return;
    erledigt.current = true;
    dialogRef.current?.close();
    onSchliessen();
    if (entfernen) {
      auftrag.entfernen();
      requestAnimationFrame(() => document.getElementById('aktive-dachflaeche')?.focus());
    }
  };
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titelId} aria-describedby={textId}
    onCancel={(event) => { event.preventDefault(); schliessen(false); }}>
    <h2 id={titelId}>{auftrag.titel}</h2>
    <p id={textId}>{auftrag.text}</p>
    <div className={styles.aktionen}>
      <button autoFocus type="button" onClick={() => schliessen(false)}>Abbrechen</button>
      <button type="button" className={styles.entfernen} onClick={() => schliessen(true)}>Entfernen</button>
    </div>
  </dialog>;
}
