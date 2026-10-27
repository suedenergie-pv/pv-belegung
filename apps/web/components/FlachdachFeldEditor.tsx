'use client';

import { useEffect, useState } from 'react';
import styles from './FlachdachFeldEditor.module.css';

/** Auswahlbezogene Drehung; Montage-Neigung und Dachkompass bleiben getrennt. */
export function FlachdachFeldEditor({ winkel, anzahl, module, onWinkel, onDrehen, onFertig, suedWinkel = 0, suedBestaetigt = true, onSuedFestlegen }: {
  winkel: number | null; anzahl: number; module: number;
  onWinkel: (grad: number) => void; onDrehen: (delta: number) => void;
  onFertig?: () => void; suedWinkel?: number; suedBestaetigt?: boolean; onSuedFestlegen?: () => void;
}) {
  const [eingabe, setEingabe] = useState(winkel === null ? '' : String(Math.round(winkel * 10) / 10));
  const [fehler, setFehler] = useState(false);
  useEffect(() => { setEingabe(winkel === null ? '' : String(Math.round(winkel * 10) / 10)); setFehler(false); }, [winkel]);
  const uebernehmen = () => {
    const wert = Number(eingabe.replace(',', '.'));
    if (!eingabe.trim() || !Number.isFinite(wert) || wert < -360 || wert > 360) { setFehler(true); return; }
    setFehler(false); onWinkel(wert);
  };
  return <section className={styles.editor} aria-label="Flachdachfelder ausrichten">
    <div className={styles.kopf}><h4>{anzahl === 1 ? 'Feld drehen' : `${anzahl} Felder drehen`}</h4>
      {onFertig && <button type="button" className={styles.fertig} onClick={onFertig}>Fertig</button>}
    </div>
    <div className={styles.winkel}>
      <label>Winkel zum Dachplan
        <span><input aria-label="Felddrehung in Grad" inputMode="decimal" value={eingabe} placeholder={winkel === null ? 'Verschiedene' : undefined}
          aria-invalid={fehler} onChange={e => { setEingabe(e.target.value); setFehler(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); } }} />°</span>
      </label>
      <button type="button" onClick={uebernehmen}>Winkel setzen</button>
    </div>
    {fehler && <p role="alert">Winkel zwischen −360° und 360° eingeben.</p>}
    <div className={styles.aktionen}>
      <button type="button" onClick={() => onDrehen(-5)} aria-label="Feld 5 Grad nach links drehen">↶ 5°</button>
      <button type="button" onClick={() => onDrehen(5)} aria-label="Feld 5 Grad nach rechts drehen">↷ 5°</button>
      <button type="button" onClick={() => suedBestaetigt ? onWinkel(suedWinkel) : onSuedFestlegen?.()}>{suedBestaetigt ? 'Am Kompass ausrichten' : 'Zuerst Süden festlegen'}</button>
    </div>
    <p>Am runden Griff frei drehen. Der Winkel bezieht sich auf den Flächenplan. „Am Kompass ausrichten“ übernimmt die festgelegte Süd- bzw. Ost-West-Richtung.</p>
    <output aria-live="polite">{module} Module in der Auswahl</output>
    {module === 0 && <p>Kein Modul passt innerhalb von Dachrand und Aussparungen. Feld verschieben, vergrößern oder am Kompass ausrichten.</p>}
  </section>;
}
