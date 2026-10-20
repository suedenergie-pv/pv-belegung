'use client';

import React from 'react';
import { eintragDatum, eintragName, type ProjektDb } from '../lib/model';
import { projektHash } from '../lib/projekt-navigation';
import styles from './ProjektUebersicht.module.css';

export function ProjektUebersicht({ db, onNeu, onOeffnen, verwaltung }: {
  db: ProjektDb;
  onNeu: () => void;
  onOeffnen: (id: string) => void;
  verwaltung: React.ReactNode;
}) {
  const projekte = [...db.projekte].sort((a, b) => b.geaendertAm - a.geaendertAm);
  return <section className={styles.uebersicht} aria-labelledby="projekt-uebersicht-titel">
    <div className={styles.kopf}>
      <div><h2 id="projekt-uebersicht-titel" tabIndex={-1}>Meine Projekte</h2><p>Neue Belegung starten oder an einem Kundenprojekt weiterarbeiten.</p></div>
      <button type="button" className="neues-projekt" onClick={onNeu}>+ Neues Projekt</button>
    </div>
    <div className={styles.listenKopf}><span>{projekte.length} {projekte.length === 1 ? 'Projekt' : 'Projekte'}</span><span>Lokal in diesem Browser</span></div>
    {projekte.length ? <ul className={styles.liste}>
      {projekte.map((eintrag) => <li key={eintrag.id}>
        <a href={projektHash(eintrag.id)} onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault(); onOeffnen(eintrag.id);
        }}>
          <div className={styles.identitaet}>
            {eintrag.id === db.aktivId && <span className={styles.zuletzt}>Zuletzt geöffnet</span>}
            <strong>{eintragName(eintrag)}</strong>
            <span>{eintrag.projekt.adresse || 'Noch keine Adresse'}</span>
          </div>
          <span className={styles.datum}>Bearbeitet {eintragDatum(eintrag)}</span>
          <span className={styles.oeffnen}>{eintrag.id === db.aktivId ? 'Fortsetzen' : 'Öffnen'} <span aria-hidden="true">→</span></span>
        </a>
      </li>)}
    </ul> : <div className={styles.leer}>
      <h3>Hier beginnen deine Belegungen.</h3>
      <p>Lege dein erstes Projekt an. Deine Kundenprojekte bleiben in diesem Browser erhalten.</p>
    </div>}
    <div className={styles.verwaltung}>{verwaltung}</div>
  </section>;
}
