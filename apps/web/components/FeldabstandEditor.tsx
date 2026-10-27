"use client";
import { useEffect, useState } from 'react';
import { montageFuerFeld, montageGeometrie, type BelegungsFeldM, type FelderInput } from '@pv-belegung/engine';
import { MontageVorschau } from './MontageVorschau';
import { useEntwurfNavigation } from '../lib/entwurf-navigation';
import styles from './FlachdachFeldEditor.module.css';

export function FeldabstandEditor({ input, felder, onAendern }: {
  input: FelderInput; felder: BelegungsFeldM[]; onAendern: (abstand: number | undefined) => void;
}) {
  const m = input.montage!;
  const g = montageGeometrie(input.module, m, input.fugeM);
  const werte = felder.map(f => Math.max(0, montageFuerFeld(input, f)!.pitchM - g.footprintM));
  const gleich = werte.every(w => Math.abs(w - werte[0]!) < 1e-7);
  const start = gleich ? String(Math.round(werte[0]! * 1000) / 1000).replace('.', ',') : '';
  const [eingabe, setEingabe] = useState(start);
  const [fehler, setFehler] = useState(false);
  const wert = Number(eingabe.replace(',', '.'));
  const minimum = m.aufstaenderung === 'sued' ? .01 : 0;
  const gueltig = eingabe.trim() !== '' && Number.isFinite(wert) && wert >= minimum && wert <= 50;
  const navigation = useEntwurfNavigation();
  useEffect(() => { setEingabe(start); setFehler(false); }, [start]);
  const anwenden = () => { if (!gueltig) { setFehler(true); return; } setFehler(false); setEingabe(String(Math.round(wert * 1000) / 1000).replace('.', ',')); onAendern(wert); };
  useEffect(() => {
    if (eingabe === start) return;
    return navigation.registriere('feldabstand', { name: 'Feldabstand', gueltig: () => { setFehler(!gueltig); return gueltig; }, uebernehmen: anwenden, verwerfen: () => setEingabe(start) });
  });
  return <section className={styles.editor} aria-label="Abstände der ausgewählten Felder">
    <h4>{felder.length === 1 ? 'Abstand in diesem Feld' : `Abstand in ${felder.length} Feldern`}</h4>
    <p>Freier Platz zwischen {m.aufstaenderung === 'ostwest' ? 'zwei Ost-West-Doppeltischen' : 'zwei Tischreihen'}.{m.aufstaenderung === 'ostwest' ? ' Der Spalt am First bleibt unverändert.' : ''}</p>
    <div className={styles.winkel}><label>Freie Gasse<span><input aria-label="Freie Gasse im ausgewählten Feld" inputMode="decimal" value={eingabe} placeholder={gleich ? undefined : 'Verschiedene Abstände'} aria-invalid={fehler}
      onChange={e => { setEingabe(e.target.value); setFehler(false); }} onKeyDown={e => { if(e.key === 'Enter') {e.preventDefault(); anwenden();} }} />m</span></label>
      <button type="button" className={styles.primaer} onClick={anwenden}>Abstand übernehmen</button></div>
    {fehler && <p role="alert">Bitte einen Abstand zwischen {minimum.toLocaleString('de-DE')} und 50 m eingeben.</p>}
    {gueltig && <><MontageVorschau geometrie={g} pitchM={g.footprintM + wert} ostwest={m.aufstaenderung === 'ostwest'} winkelDeg={m.winkelDeg} />
      <p>{eingabe !== start ? 'Vorschau: ' : ''}{wert.toLocaleString('de-DE')} m frei · Tischbreite in Neigungsrichtung {g.footprintM.toLocaleString('de-DE',{maximumFractionDigits:2})} m.</p></>}
    <div className={styles.aktionen}><button type="button" onClick={() => setEingabe('0,05')}>Eng · 5 cm</button><button type="button" onClick={() => setEingabe('0,8')}>Gasse · 80 cm</button></div>
    <p>Beispielwerte, frei anpassbar. Zwischen getrennten Feldern entsteht der Weg durch deren Lage: Feld auswählen und verschieben.</p>
    {felder.some(f => f.freieGasseM !== undefined) && <button type="button" onClick={() => { setEingabe(start); onAendern(undefined); }}>Flächenvorgabe verwenden</button>}
  </section>;
}
