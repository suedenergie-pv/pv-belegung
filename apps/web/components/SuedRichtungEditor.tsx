"use client";
import { useState } from 'react';
import type { PunktM } from '../lib/model';
import styles from './FlachdachFeldEditor.module.css';
export type SuedEntwurf = { flaecheId: string; start?: PunktM; ende?: PunktM; winkel: number | null; mitdrehen: boolean; bearbeitet?: boolean };
export function SuedRichtungEditor({ entwurf, felder, onChange }: {
  entwurf: SuedEntwurf; felder: number; onChange: (e: SuedEntwurf) => void;
}) {
  const [zahl,setZahl] = useState('');
  const [fehler,setFehler] = useState(false);
  return <section className={styles.editor} aria-label="Südrichtung festlegen">
    <h4>Wo liegt Süden?</h4>
    {entwurf.winkel === null && <ol className="list-decimal pl-5 text-sm space-y-2"><li>Startpunkt auf der Fläche antippen.</li><li>Von dort einen zweiten Punkt <strong>in Richtung Süden</strong> antippen.</li></ol>}
    <p role="status">{!entwurf.start ? 'Jetzt den Startpunkt im Bild setzen.' : entwurf.winkel === null ? 'Jetzt weiter in Richtung Süden tippen. Die Punkte müssen auseinanderliegen.' : 'Der Pfeil zeigt nach Süden. Ausrichtung prüfen und übernehmen.'}</p>
    {felder > 0 && <label className="flex items-start gap-3 py-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={entwurf.mitdrehen} onChange={e => onChange({...entwurf,mitdrehen:e.target.checked})} /><span><strong>{felder} vorhandene {felder === 1 ? 'Feld' : 'Felder'} mitdrehen</strong><span className="block">Am Rand kann sich die Modulzahl ändern.</span></span></label>}
    <details className="my-3"><summary>Woher kenne ich die Richtung?</summary><p>Das Foto erkennt Süden nicht automatisch. Verwende einen Lageplan oder einen Kompass vor Ort. Beide Punkte müssen auf derselben ebenen Fläche liegen; die Foto-Perspektive wird berücksichtigt. Beim Mitdrehen bleiben eigene Winkelabweichungen der Felder erhalten. Im Bild funktionieren auch Pfeiltasten und Enter.</p></details>
    <div className={styles.aktionen}><button type="button" onClick={() => onChange({...entwurf,start:undefined,ende:undefined,winkel:null})}>Pfeil neu setzen</button></div>
    <details className="my-3"><summary>Ohne Klicken einstellen</summary>
      <div className={styles.aktionen}>{[['Oben',0],['Rechts',90],['Unten',180],['Links',270]].map(([name,w]) => <button type="button" key={name} onClick={() => { onChange({...entwurf,start:undefined,ende:undefined,winkel:Number(w)}); setFehler(false); }}>Süden {name}</button>)}</div>
      <div className={`${styles.winkel} mt-2`}><label>Südrichtung im Flächenplan<span><input aria-label="Südrichtung in Grad" inputMode="decimal" value={zahl} onChange={e=>{setZahl(e.target.value);const n=Number(e.target.value.replace(',', '.'));onChange({...entwurf,start:undefined,ende:undefined,winkel:e.target.value.trim() && Number.isFinite(n) && n>=0 && n<=360 ? n : null,bearbeitet:true});}} aria-invalid={fehler} />°</span></label>
        <button type="button" onClick={()=>{const n=Number(zahl.replace(',','.'));if(!zahl.trim()||!Number.isFinite(n)||n<0||n>360){setFehler(true);return;}setFehler(false);onChange({...entwurf,start:undefined,ende:undefined,winkel:n});}}>Richtung anzeigen</button></div>
      <p>0° = oben, 90° = rechts, 180° = unten, 270° = links im entzerrten Flächenplan.</p>{fehler && <p role="alert">Bitte 0 bis 360° eingeben.</p>}
    </details>


  </section>;
}
