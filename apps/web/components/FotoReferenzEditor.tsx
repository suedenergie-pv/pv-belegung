'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dachAusFotoReferenz, pruefeFotoReferenz, type FotoReferenz } from '../lib/foto-referenz';
import { fmtDe, type DachFoto, type Flaeche, type ReferenzMessung } from '../lib/model';
import type { Punkt, Ecken } from '../lib/foto-geometrie';
import { useEntwurfNavigation } from '../lib/entwurf-navigation';
import { useTouchBedienung } from '../lib/touch-bedienung';
import { EditorAktionen } from './EditorAktionen';
import type { FotoArbeitsbereich } from './FotoHintergrund';
import styles from './FotoReferenzEditor.module.css';

type Ergebnis = Extract<ReturnType<typeof dachAusFotoReferenz>, { ok: true }>;
export interface ReferenzDach { ergebnis: Ergebnis; messung: ReferenzMessung; name: string; neigungDeg: number; azimutDeg: number }
const zahl = (s: string) => s.trim() ? Number(s.replace(',', '.')) : NaN;
const punkteNamen = ['Unten links', 'Unten rechts', 'Oben rechts', 'Oben links'];

/** Eine gemessene Referenz bestimmt die Perspektive; der echte Dachrand darf jede einfache Polygonform haben. */
export function FotoReferenzEditor({ foto, flaeche, ansichtZoom, onUebernehmen, onAbbrechen, renderArbeitsbereich }: {
  foto: DachFoto; flaeche: Flaeche; ansichtZoom: number;
  onUebernehmen: (dach: ReferenzDach) => void; onAbbrechen: () => void;
  renderArbeitsbereich: (bereich: FotoArbeitsbereich) => React.ReactNode;
}) {
  const [schritt, setSchritt] = useState<0 | 1 | 2>(0);
  const [breite, setBreite] = useState(foto.referenzMessung ? String(foto.referenzMessung.breiteM) : '');
  const [tiefe, setTiefe] = useState(foto.referenzMessung ? String(foto.referenzMessung.hoeheM) : '');
  const [name, setName] = useState(flaeche.name);
  const [neigung, setNeigung] = useState(String(flaeche.neigungDeg));
  const [azimut, setAzimut] = useState(flaeche.azimutDeg);
  const [referenz, setReferenz] = useState<Punkt[]>(foto.referenzMessung?.eckenPx.map(p => [...p] as Punkt) ?? []);
  const [umriss, setUmriss] = useState<Punkt[]>(foto.referenzMessung?.umrissPx.map(p => [...p] as Punkt) ?? []);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [neuAnlegen, setNeuAnlegen] = useState(false);
  const hatInhalte = !!flaeche.felder?.length || !!flaeche.hindernisse?.length;
  const [fehler, setFehler] = useState('');
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [px, setPx] = useState(1);
  const [cursor, setCursor] = useState<Punkt>([foto.breitePx / 2, foto.hoehePx / 2]);
  const [touch, touchAn, touchAus] = useTouchBedienung();
  const [gegriffen, setGegriffen] = useState<number | null>(null);
  const [punkteBearbeiten, setPunkteBearbeiten] = useState(false);
  const drag = useRef<{ index: number; vorher: Punkt; pointerId: number } | null>(null);
  const klickSperre = useRef(0);
  const navigation = useEntwurfNavigation();
  const ref: FotoReferenz = { breiteM: zahl(breite), hoeheM: zahl(tiefe), eckenPx: referenz as Ecken };
  const referenzPruefung = pruefeFotoReferenz(ref);
  const ergebnis = dachAusFotoReferenz(ref, umriss);
  const metadatenGueltig = name.trim().length > 0 && Number.isFinite(zahl(neigung)) && zahl(neigung) >= 0 && zahl(neigung) <= 90;
  const speicherbar = schritt === 2 && ergebnis.ok && bestaetigt && (!hatInhalte || neuAnlegen) && metadatenGueltig;
  const punkte = schritt === 0 ? referenz : umriss;
  const setPunkte = schritt === 0 ? setReferenz : setUmriss;
  const dirty = referenz.length > 0 || umriss.length > 0 || !!breite || !!tiefe || name !== flaeche.name || neigung !== String(flaeche.neigungDeg) || azimut !== flaeche.azimutDeg;
  const uebernehmen = () => {
    if (!speicherbar || !ergebnis.ok) return;
    onUebernehmen({ ergebnis, name: name.trim(), neigungDeg: zahl(neigung), azimutDeg: azimut,
      messung: { ...ref, umrissPx: umriss, rahmenBreiteM: ergebnis.breiteM, rahmenHoeheM: ergebnis.hoeheM, rahmenEckenPx: ergebnis.eckenPx } });
  };
  useEffect(() => {
    if (!dirty) return;
    return navigation.registriere('foto-referenz-' + flaeche.id, { name: 'Dachrand und Referenz', gueltig: () => !!speicherbar, uebernehmen, verwerfen: () => { setSchritt(0); setReferenz([]); setUmriss([]); setBreite(''); setTiefe(''); setName(flaeche.name); setNeigung(String(flaeche.neigungDeg)); setAzimut(flaeche.azimutDeg); setBestaetigt(false); setGegriffen(null); setFehler(''); onAbbrechen(); } });
  });
  useLayoutEffect(() => {
    if (!svg) return;
    const messen = () => { const m = svg.getScreenCTM(); if (m) setPx(1 / Math.max(.01, Math.hypot(m.a, m.b))); };
    messen(); const ro = new ResizeObserver(messen); ro.observe(svg); return () => ro.disconnect();
  }, [svg, ansichtZoom]);
  const abbrechenGeste = () => {
    if (drag.current) { const d = drag.current; setPunkte(ps => ps.map((p, i) => i === d.index ? d.vorher : p)); }
    drag.current = null; setGegriffen(null); klickSperre.current = Date.now() + 400;
  };
  const bildPunkt = (x: number, y: number): Punkt | null => {
    const m = svg?.getScreenCTM(); if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return [Math.max(0, Math.min(foto.breitePx, p.x)), Math.max(0, Math.min(foto.hoehePx, p.y))];
  };
  const setzePunkt = (p: Punkt) => {
    if (punkteBearbeiten || schritt === 2 || (schritt === 0 && referenz.length >= 4)) return;
    if (punkte.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < .001)) return;
    setPunkte(ps => [...ps, p]); setFehler(''); setBestaetigt(false);
  };
  const aenderePunkt = (i: number, p: Punkt) => { setPunkte(ps => ps.map((alt, k) => k === i ? p : alt)); setBestaetigt(false); setFehler(''); };
  const weiter = () => {
    setGegriffen(null); setPunkteBearbeiten(false);
    if (schritt === 0) {
      if (!metadatenGueltig) { setFehler('Bitte einen Namen und eine Dachneigung zwischen 0 und 90 Grad eingeben.'); return; }
      if (!referenzPruefung.ok) { setFehler(referenzPruefung.grund); return; }
      setSchritt(1); setFehler('');
    } else if (schritt === 1) {
      if (!ergebnis.ok) { setFehler(ergebnis.grund); return; }
      setSchritt(2); setFehler('');
    }
  };
  const schrittTitel = ['Gemessenes Rechteck markieren', 'Echten Dachrand nachzeichnen', 'Dachfläche prüfen'][schritt]!;
  const hinweis = schritt === 0 ? referenz.length < 4 ? `Referenz: ${referenz.length + 1}. Ecke – ${punkteNamen[referenz.length]}.` : 'Vier Ecken gesetzt. Punkte bei Bedarf verschieben und Referenz bestätigen.'
    : schritt === 1 ? 'Dachrand: Ecken der Reihe nach setzen. Einschnitte mitzeichnen.' : 'Liegt die hervorgehobene Fläche genau auf dem gewünschten Dach?';
  const poly = (ps: Punkt[]) => ps.map(p => p.join(',')).join(' ');
  const bild = <svg ref={setSvg} role="img" tabIndex={0} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter" aria-label="Referenz und Dachrand im Foto markieren"
    onFocus={e => { if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) touchAn(); }}
    onKeyDown={e => { if (e.target !== e.currentTarget || schritt === 2) return; const v: Record<string, Punkt> = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }; const d = v[e.key]; if (d) { e.preventDefault(); touchAn(); setCursor(p => [Math.max(0,Math.min(foto.breitePx,p[0]+d[0]*px*(e.shiftKey?1:5))),Math.max(0,Math.min(foto.hoehePx,p[1]+d[1]*px*(e.shiftKey?1:5)))]); } else if (e.key === 'Enter') { e.preventDefault(); if (gegriffen !== null) { aenderePunkt(gegriffen,cursor); setGegriffen(null); } else if (amKreuz >= 0) setGegriffen(amKreuz); else setzePunkt(cursor); } }} viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`} className={styles.bild}
    onClick={e => { if (touch || Date.now() < klickSperre.current) return; const p = bildPunkt(e.clientX, e.clientY); if (p) setzePunkt(p); }}
    onPointerMove={e => { const p = bildPunkt(e.clientX, e.clientY); if (!p) return; if (drag.current?.pointerId === e.pointerId) aenderePunkt(drag.current.index, p); else if (e.pointerType === 'mouse') setCursor(p); }}
    onPointerUp={e => { if (drag.current?.pointerId === e.pointerId) { drag.current = null; klickSperre.current = Date.now() + 150; } else if (e.pointerType === 'mouse' && e.button === 0 && !touch) { const p = bildPunkt(e.clientX, e.clientY); if (p) setzePunkt(p); klickSperre.current = Date.now() + 100; } }}
    onPointerCancel={abbrechenGeste}>
    <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
    {referenz.length > 1 && <polyline points={poly(referenz.length === 4 ? [...referenz, referenz[0]!] : referenz)} fill={referenz.length === 4 ? '#e8603a30' : 'none'} stroke="#ffb494" strokeWidth={2.5 * px} pointerEvents="none" />}
    {umriss.length > 1 && <polyline points={poly(schritt === 2 ? [...umriss, umriss[0]!] : umriss)} fill={schritt === 2 ? '#05c7ac30' : 'none'} stroke="#20e7c8" strokeWidth={2.5 * px} pointerEvents="none" />}
    {schritt < 2 && punkte.map((p, i) => <g key={i} role="button" tabIndex={0} aria-label={`${schritt === 0 ? 'Referenz' : 'Dachrand'} Ecke ${i + 1} verschieben`} className={styles.griff} style={{ pointerEvents: schritt === 0 ? referenz.length === 4 ? undefined : 'none' : punkteBearbeiten ? undefined : 'none' }}
      onClick={e => { e.stopPropagation(); if (touch) { setCursor(p); setGegriffen(i); } }}
      onPointerDown={e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { index: i, vorher: p, pointerId: e.pointerId }; }}
      onKeyDown={e => { const d: Record<string, Punkt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const v = d[e.key]; if (v) { e.preventDefault(); aenderePunkt(i, [Math.max(0, Math.min(foto.breitePx, p[0] + v[0] * px * (e.shiftKey ? 10 : 1))), Math.max(0, Math.min(foto.hoehePx, p[1] + v[1] * px * (e.shiftKey ? 10 : 1)))]); } }}>
      <circle cx={p[0]} cy={p[1]} r={22 * px} fill="transparent" />
      <circle cx={p[0]} cy={p[1]} r={5 * px} fill="#243038" stroke="white" strokeWidth={1.7 * px} pointerEvents="none" />
      <circle className={styles.fokus} cx={p[0]} cy={p[1]} r={9 * px} fill="none" stroke="#ffb494" strokeWidth={2 * px} pointerEvents="none" />
      <title>{schritt === 0 ? punkteNamen[i] : `Dachecke ${i + 1}`}</title>
    </g>)}
  </svg>;
  const steuerung = <div className={styles.panel}>
    {schritt === 0 && <>
      {foto.referenzMessung && <p className={styles.hilfe}>Ursprüngliche Referenz geladen. Prüfe ihre Maße und den Dachrand erneut. Erst Übernehmen ersetzt die aktuelle Einrichtung dieser Fläche.</p>}
      <p>Für Dachspitzen, einseitig schräge Flächen und Einschnitte. Wähle ein <strong>echtes Rechteck auf dieser Dachfläche</strong>, dessen Breite und Tiefe du kennst – zum Beispiel ein ausgemessenes Ziegelfeld.</p>
      <label>Name der Fläche<input value={name} onChange={e => setName(e.target.value)} maxLength={100} /></label>
      <div className={styles.raster}><label>Referenzbreite in m<input inputMode="decimal" value={breite} onChange={e => { setBreite(e.target.value); setBestaetigt(false); }} placeholder="z. B. 4,20" /></label>
        <label>Referenztiefe in m<input inputMode="decimal" value={tiefe} onChange={e => { setTiefe(e.target.value); setBestaetigt(false); }} placeholder="z. B. 3,60" /></label></div>
      <p className={styles.hilfe}>Zum genauen Setzen ins Foto zoomen. „Unten“ zeigt zur Dachrinne, auch bei gedrehtem Foto. Beide Längen auf der Dachfläche messen. Das Rechteck liegt vollständig in dieser Ebene; eine Nachbarfläche eignet sich nicht.</p>
      <div className={styles.raster}><label>Dachneigung (Grad)<input inputMode="decimal" value={neigung} onChange={e => setNeigung(e.target.value)} /></label>
        <label>Ausrichtung<select value={azimut} onChange={e => setAzimut(Number(e.target.value))}>{[[0,'Nord'],[45,'Nordost'],[90,'Ost'],[135,'Südost'],[180,'Süd'],[225,'Südwest'],[270,'West'],[315,'Nordwest']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}{![0,45,90,135,180,225,270,315].includes(azimut) && <option value={azimut}>Eigene Richtung ({azimut}°)</option>}</select></label></div>
      <div className={styles.reihenfolge}><svg viewBox="0 0 220 90" aria-label="Reihenfolge der vier Referenzecken" role="img"><path d="M35 60H185V15H35Z" fill="none" stroke="currentColor" strokeWidth="2"/>{[[35,60,'1'],[185,60,'2'],[185,15,'3'],[35,15,'4']].map(([x,y,n])=><g key={n}><circle cx={x} cy={y} r="10" fill="#243038"/><text x={x} y={Number(y)+4} fill="white" textAnchor="middle" fontSize="12">{n}</text></g>)}<text x="110" y="84" textAnchor="middle" fontSize="12">Breite · zur Dachrinne</text></svg><strong>{referenz.length < 4 ? `${referenz.length+1}. ${punkteNamen[referenz.length]}` : 'Alle vier Ecken gesetzt'}</strong></div>
      <details><summary>Kein gemessenes Rechteck vorhanden?</summary><p>Nutze ein Aufmaß für einen Plan ohne Fotoperspektive. Eine Dachspitze allein liefert im schrägen Foto keinen verlässlichen Maßstab.</p><button type="button" onClick={() => navigation.weiter(onAbbrechen)}>Zurück zu den Dachmaßen</button></details>
    </>}
    {schritt === 1 && <><p>Markiere nur <strong>{name.trim() || flaeche.name}</strong>. Folge dem echten Rand einschließlich aller Einschnitte. Die nächste Dachseite richtest du anschließend als eigene Fläche ein.</p><p><strong>{umriss.length} Ecken markiert</strong> · mindestens 3</p><button type="button" onClick={() => { setSchritt(0); setPunkteBearbeiten(false); setGegriffen(null); setFehler(''); }}>Referenz korrigieren</button></>}
    {schritt < 2 && <div className={styles.korrekturen}>{schritt === 1 && punkte.length > 0 && <button type="button" aria-pressed={punkteBearbeiten} onClick={() => { setPunkteBearbeiten(v => !v); setGegriffen(null); }}>{punkteBearbeiten ? 'Weitere Ecke hinzufügen' : 'Gesetzte Ecken verschieben'}</button>}<button type="button" disabled={!punkte.length} onClick={() => { setPunkte(ps => ps.slice(0,-1)); setGegriffen(null); setFehler(''); }}>Letzte Ecke zurück</button><span>{schritt === 0 && referenz.length < 4 ? 'Zuerst alle vier Ecken setzen. Danach kannst du sie korrigieren.' : schritt === 1 && !punkteBearbeiten ? 'Weiter am Dachrand entlang klicken. Zum Korrigieren „Gesetzte Ecken verschieben“ wählen.' : 'Punkte ziehen oder mit Pfeiltasten verschieben.'}</span></div>}
    {schritt === 2 && ergebnis.ok && <><p><strong>{name}</strong> · {umriss.length} Dachecken</p>{flaeche.art === 'flachdach' && <p className={styles.hilfe}>Anschließend Süden im Foto festlegen. Das Neuaufmaß legt die Planachsen neu an.</p>}<dl className={styles.ergebnis}><div><dt>Gesamtbreite</dt><dd>{fmtDe(ergebnis.breiteM, 2)} m</dd></div><div><dt>Tiefe auf dem Dach</dt><dd>{fmtDe(ergebnis.hoeheM, 2)} m</dd></div></dl><p className={styles.hilfe}>Aus der gemessenen Referenz berechnet. Die grüne Kontur begrenzt später die Belegung.</p>{ergebnis.meldungen.length > 0 && <div className={styles.warnung}>{ergebnis.meldungen.map(m => <p key={m}>{m}</p>)}</div>}<label className={styles.bestaetigung}><input type="checkbox" checked={bestaetigt} onChange={e => setBestaetigt(e.target.checked)} />Referenz liegt auf dieser Dachfläche und ihre Maße sind gemessen</label>{hatInhalte && <div className={styles.warnung}><p>Das Neuaufmaß ersetzt die Einrichtung von {flaeche.name}. {flaeche.felder?.length ?? 0} Belegungsfelder und {flaeche.hindernisse?.length ?? 0} Aussparungen werden entfernt. Die anderen Dachflächen bleiben erhalten. Rückgängig stellt den bisherigen Stand wieder her.</p><label className={styles.bestaetigung}><input type="checkbox" checked={neuAnlegen} onChange={e => setNeuAnlegen(e.target.checked)} />Belegung und Aussparungen dieser Dachfläche neu anlegen</label></div>}{(flaeche.fotoZuordnungen?.length ?? 0) > 1 && <p className={styles.warnung}>Weitere Fotoperspektiven dieser Fläche müssen anschließend neu eingerichtet werden.</p>}<button type="button" onClick={() => { setSchritt(1); setBestaetigt(false); }}>Dachrand korrigieren</button></>}
    {fehler && <p role="alert" className={styles.fehler}>{fehler}</p>}
    <EditorAktionen><button type="button" className={styles.primaer} disabled={schritt === 2 ? !speicherbar : schritt === 0 ? referenz.length !== 4 : umriss.length < 3} onClick={schritt === 2 ? uebernehmen : weiter}>{schritt === 0 ? 'Referenz bestätigen' : schritt === 1 ? 'Dachrand prüfen' : 'Dachfläche übernehmen'}</button><button type="button" onClick={() => navigation.weiter(onAbbrechen)}>Abbrechen</button></EditorAktionen>
  </div>;
  const korrekturAktiv = schritt === 0 ? referenz.length === 4 : punkteBearbeiten;
  const naechster = punkte.reduce((best, p, i) => { const abstand = Math.hypot(p[0]-cursor[0], p[1]-cursor[1]); return abstand < best.abstand ? { i, abstand } : best; }, { i: -1, abstand: 22 * px });
  const amKreuz = korrekturAktiv ? naechster.i : -1;
  return renderArbeitsbereich({ bild, steuerung, hinweis, aufgabe: { titel: schrittTitel, phase: `${flaeche.name} · ${schritt+1} von 3` }, bildSeitenverhaeltnis: foto.breitePx / foto.hoehePx, abbrechen: abbrechenGeste,
    punktSteuerung: schritt === 2 ? undefined : { aktiv: touch, aktivieren: touchAn, deaktivieren: touchAus, punkt: cursor, breitePx: foto.breitePx, hoehePx: foto.hoehePx, onBewegen: setCursor,
      aktion: gegriffen !== null ? 'Ecke hier ablegen' : amKreuz >= 0 ? 'Ecke greifen' : 'Ecke setzen', deaktiviert: schritt === 0 && referenz.length >= 4 && gegriffen === null && amKreuz < 0,
      onBestaetigen: () => { if (gegriffen !== null) { aenderePunkt(gegriffen,cursor); setGegriffen(null); } else if (amKreuz >= 0) setGegriffen(amKreuz); else setzePunkt(cursor); } } });
}
