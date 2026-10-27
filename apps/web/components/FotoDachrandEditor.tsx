'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dachAusFotoReferenz, pruefeFotoUmriss } from '../lib/foto-referenz';
import { ziegelFeldImDach, ziegelReferenz, type ZiegelMessung } from '../lib/foto-ziegel';
import { homographie, projiziere, type Punkt, type Ecken } from '../lib/foto-geometrie';
import { fmtDe, type DachFoto, type Flaeche } from '../lib/model';
import { useEntwurfNavigation } from '../lib/entwurf-navigation';
import { useTouchBedienung } from '../lib/touch-bedienung';
import { EditorAktionen } from './EditorAktionen';
import type { FotoArbeitsbereich } from './FotoHintergrund';
import type { ReferenzDach } from './FotoReferenzEditor';
import styles from './FotoDachrandEditor.module.css';

const zahl = (s: string) => s.trim() ? Number(s.replace(',', '.')) : NaN;
const punktNamen = ['An der unteren Reihe links', 'Auf derselben Reihe rechts', 'Darüber auf derselben Ziegelspalte', 'Auf derselben oberen Reihe links'];
const richtungen = [[0, 'Nord'], [45, 'Nordost'], [90, 'Ost'], [135, 'Südost'], [180, 'Süd'], [225, 'Südwest'], [270, 'West'], [315, 'Nordwest']] as const;
const ziegelHinweis = (text: string) => text.replaceAll('gemessenen Rechtecks', 'markierten Ziegelfelds').replaceAll('gemessenen Rechteck', 'markierten Ziegelfeld').replaceAll('gemessene Rechteck', 'markierte Ziegelfeld').replaceAll('größeres Rechteck', 'größeres Ziegelfeld').replaceAll('größere Referenz', 'größeres Ziegelfeld');
const poly = (ps: readonly Punkt[]) => ps.map(p => p.join(',')).join(' ');

/** Echter Dachrand zuerst; sichtbare Ziegelabstände liefern anschließend Maßstab und Perspektive. */
export function FotoDachrandEditor({ foto, flaeche, ansichtZoom, onUebernehmen, onAbbrechen, renderArbeitsbereich }: {
  foto: DachFoto; flaeche: Flaeche; ansichtZoom: number;
  onUebernehmen: (dach: ReferenzDach) => void; onAbbrechen: () => void;
  renderArbeitsbereich: (bereich: FotoArbeitsbereich) => React.ReactNode;
}) {
  const alteMessung = foto.referenzMessung;
  const alt = alteMessung?.ziegel;
  const [schritt, setSchritt] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState(flaeche.name);
  const [neigung, setNeigung] = useState(String(flaeche.neigungDeg));
  const [azimut, setAzimut] = useState(flaeche.azimutDeg);
  const [spalten, setSpalten] = useState(alt ? String(alt.spalten) : '');
  const [reihen, setReihen] = useState(alt ? String(alt.reihen) : '');
  const [deckbreite, setDeckbreite] = useState(alt ? String(alt.deckbreiteCm) : '');
  const [decklaenge, setDecklaenge] = useState(alt ? String(alt.decklaengeCm) : '');
  const [umriss, setUmriss] = useState<Punkt[]>(alteMessung?.umrissPx.map(p => [...p] as Punkt) ?? []);
  const [ziegelPunkte, setZiegelPunkte] = useState<Punkt[]>(alt ? alteMessung!.eckenPx.map(p => [...p] as Punkt) : []);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [neuAnlegen, setNeuAnlegen] = useState(false);
  const [fehler, setFehler] = useState('');
  const [punkteBearbeiten, setPunkteBearbeiten] = useState(false);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [px, setPx] = useState(1);
  const [cursor, setCursor] = useState<Punkt>([foto.breitePx / 2, foto.hoehePx / 2]);
  const [touch, touchAn, touchAus] = useTouchBedienung();
  const [gegriffen, setGegriffen] = useState<number | null>(null);
  const drag = useRef<{ index: number; vorher: Punkt; pointerId: number } | null>(null);
  const klickSperre = useRef(0);
  const navigation = useEntwurfNavigation();
  const hatInhalte = !!flaeche.felder?.length || !!flaeche.hindernisse?.length;
  const messung: ZiegelMessung = { spalten: zahl(spalten), reihen: zahl(reihen), deckbreiteCm: zahl(deckbreite), decklaengeCm: zahl(decklaenge) };
  const referenz = ziegelReferenz({ ...messung, eckenPx: ziegelPunkte as Ecken });
  const ergebnis = referenz.ok ? dachAusFotoReferenz(referenz.referenz, umriss) : null;
  const feldImDach = ziegelPunkte.length === 4 && ziegelFeldImDach(ziegelPunkte as Ecken, umriss);
  const metadatenGueltig = name.trim().length > 0 && Number.isFinite(zahl(neigung)) && zahl(neigung) >= 0 && zahl(neigung) <= 90;
  const speicherbar = schritt === 2 && referenz.ok && ergebnis?.ok && feldImDach && bestaetigt && (!hatInhalte || neuAnlegen) && metadatenGueltig;
  const punkte = schritt === 0 ? umriss : ziegelPunkte;
  const setPunkte = schritt === 0 ? setUmriss : setZiegelPunkte;
  const korrekturAktiv = schritt === 0 ? punkteBearbeiten : ziegelPunkte.length === 4;
  const snapshot = JSON.stringify([name, neigung, azimut, spalten, reihen, deckbreite, decklaenge, umriss, ziegelPunkte]);
  const anfang = useRef(snapshot);
  const dirty = snapshot !== anfang.current;
  const aenderung = () => { setBestaetigt(false); setFehler(''); };
  const schrittWechsel = (s: 0 | 1 | 2) => { setSchritt(s); setGegriffen(null); setPunkteBearbeiten(false); setBestaetigt(false); setFehler(''); };
  const uebernehmen = () => {
    if (!speicherbar || !referenz.ok || !ergebnis?.ok) return;
    onUebernehmen({ ergebnis, name: name.trim(), neigungDeg: zahl(neigung), azimutDeg: azimut,
      messung: { ...referenz.referenz, ziegel: messung, umrissPx: umriss, rahmenBreiteM: ergebnis.breiteM, rahmenHoeheM: ergebnis.hoeheM, rahmenEckenPx: ergebnis.eckenPx } });
  };
  useEffect(() => {
    if (!dirty) return;
    return navigation.registriere('foto-dachrand-' + flaeche.id, { name: 'Dachrand und Ziegelmaßstab', gueltig: () => !!speicherbar, uebernehmen,
      verwerfen: () => { anfang.current = snapshot; setFehler(''); setGegriffen(null); setBestaetigt(false); onAbbrechen(); } });
  });
  useLayoutEffect(() => {
    if (!svg) return;
    const messen = () => { const m = svg.getScreenCTM(); if (m) setPx(1 / Math.max(.01, Math.hypot(m.a, m.b))); };
    messen(); const ro = new ResizeObserver(messen); ro.observe(svg); return () => ro.disconnect();
  }, [svg, ansichtZoom]);
  const bildPunkt = (x: number, y: number): Punkt | null => {
    const m = svg?.getScreenCTM(); if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return [Math.max(0, Math.min(foto.breitePx, p.x)), Math.max(0, Math.min(foto.hoehePx, p.y))];
  };
  const setzePunkt = (p: Punkt) => {
    if (schritt === 2 || (schritt === 0 && punkteBearbeiten) || (schritt === 1 && ziegelPunkte.length >= 4)) return;
    if (punkte.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < .001)) return;
    setPunkte(ps => [...ps, p]); aenderung();
  };
  const aenderePunkt = (i: number, p: Punkt) => { setPunkte(ps => ps.map((altP, k) => k === i ? p : altP)); aenderung(); };
  const abbrechenGeste = () => {
    if (drag.current) { const d = drag.current; setPunkte(ps => ps.map((p, i) => i === d.index ? d.vorher : p)); }
    drag.current = null; setGegriffen(null); klickSperre.current = Date.now() + 400;
  };
  const weiter = () => {
    if (schritt === 0) {
      if (!metadatenGueltig) { setFehler('Bitte einen Namen und eine Dachneigung zwischen 0 und 90 Grad eingeben.'); return; }
      const fehlerRand = pruefeFotoUmriss(umriss);
      if (fehlerRand) { setFehler(fehlerRand.grund); return; }
      schrittWechsel(1);
    } else if (schritt === 1) {
      if (!referenz.ok) { setFehler(referenz.grund); return; }
      if (!feldImDach) { setFehler('Alle vier Ziegelpunkte und die Verbindungen müssen innerhalb des gezeichneten Dachrands liegen. Wähle ein Ziegelfeld auf genau dieser Dachseite.'); return; }
      if (!ergebnis?.ok) { setFehler(ergebnis?.grund ?? 'Prüfe die Ziegelpunkte und den Dachrand.'); return; }
      schrittWechsel(2);
    }
  };
  const naechster = punkte.reduce((best, p, i) => { const abstand = Math.hypot(p[0] - cursor[0], p[1] - cursor[1]); return abstand < best.abstand ? { i, abstand } : best; }, { i: -1, abstand: 22 * px });
  const amKreuz = korrekturAktiv ? naechster.i : -1;
  const bestaetigePunkt = () => {
    if (gegriffen !== null) { aenderePunkt(gegriffen, cursor); setGegriffen(null); }
    else if (amKreuz >= 0) setGegriffen(amKreuz);
    else setzePunkt(cursor);
  };
  const grid: [Punkt, Punkt][] = [];
  // Diese Linien sind eine sichtbare Kontrolle der gezählten Fugen, kein zweiter Solver.
  if (ziegelPunkte.length === 4 && Number.isSafeInteger(messung.spalten) && messung.spalten > 0 && Number.isSafeInteger(messung.reihen) && messung.reihen > 0) {
    const h = homographie(messung.spalten, messung.reihen, ziegelPunkte as Ecken);
    if (h) {
      for (const [anzahl, quer] of [[messung.spalten, true], [messung.reihen, false]] as const) {
        const schrittweite = Math.max(1, Math.ceil(anzahl / 24));
        for (let i = schrittweite; i < anzahl; i += schrittweite) {
          const a: Punkt = quer ? [i, 0] : [0, i], b: Punkt = quer ? [i, messung.reihen] : [messung.spalten, i];
          const p = projiziere(h, a), q = projiziere(h, b);
          if ([...p, ...q].every(Number.isFinite)) grid.push([p, q]);
        }
      }
    }
  }
  const hinweis = schritt === 0 ? 'Echte Dachecken der Reihe nach anklicken. Eine Spitze bekommt genau einen Punkt.'
    : schritt === 1 ? ziegelPunkte.length < 4 ? `Ziegelpunkt ${ziegelPunkte.length + 1}: ${punktNamen[ziegelPunkte.length]}.` : 'Die Hilfslinien sollen den sichtbaren Ziegelfugen folgen. Prüfe Anzahl und Lage.'
      : 'Prüfe den Dachrand und die Maße. Jede anders geneigte Dachseite bleibt eine eigene Fläche.';
  const bild = <svg ref={setSvg} role="img" tabIndex={0} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter" aria-label="Dachrand und Ziegel im Foto markieren"
    viewBox={`0 0 ${foto.breitePx} ${foto.hoehePx}`} className={styles.bild}
    onFocus={e => { if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) touchAn(); }}
    onKeyDown={e => {
      if (e.target !== e.currentTarget || schritt === 2) return;
      const d: Record<string, Punkt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const v = d[e.key];
      if (v) { e.preventDefault(); touchAn(); setCursor(p => [Math.max(0, Math.min(foto.breitePx, p[0] + v[0] * px * (e.shiftKey ? 1 : 5))), Math.max(0, Math.min(foto.hoehePx, p[1] + v[1] * px * (e.shiftKey ? 1 : 5)))]); }
      else if (e.key === 'Enter') { e.preventDefault(); bestaetigePunkt(); }
    }}
    onClick={e => { if (touch || Date.now() < klickSperre.current) return; const p = bildPunkt(e.clientX, e.clientY); if (p) setzePunkt(p); }}
    onPointerMove={e => { const p = bildPunkt(e.clientX, e.clientY); if (!p) return; if (drag.current?.pointerId === e.pointerId) aenderePunkt(drag.current.index, p); else if (e.pointerType === 'mouse') setCursor(p); }}
    onPointerUp={e => { if (drag.current?.pointerId === e.pointerId) { drag.current = null; klickSperre.current = Date.now() + 150; } else if (e.pointerType === 'mouse' && e.button === 0 && !touch) { const p = bildPunkt(e.clientX, e.clientY); if (p) setzePunkt(p); klickSperre.current = Date.now() + 100; } }}
    onPointerCancel={abbrechenGeste}>
    <image href={foto.dataUrl} width={foto.breitePx} height={foto.hoehePx} />
    {umriss.length > 1 && <polyline points={poly(schritt > 0 ? [...umriss, umriss[0]!] : umriss)} fill={schritt === 2 ? '#20e7c820' : 'none'} stroke="#20e7c8" strokeWidth={2.5 * px} pointerEvents="none" />}
    {schritt > 0 && ziegelPunkte.length > 1 && <polyline points={poly(ziegelPunkte.length === 4 ? [...ziegelPunkte, ziegelPunkte[0]!] : ziegelPunkte)} fill="none" stroke="#f9f4be" strokeWidth={2 * px} pointerEvents="none" />}
    {schritt > 0 && grid.map(([a, b], i) => <line key={i} data-testid="ziegel-hilfslinie" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f9f4be" strokeWidth={px} strokeOpacity={.75} pointerEvents="none" />)}
    {schritt < 2 && punkte.map((p, i) => <g key={i} role="button" tabIndex={korrekturAktiv ? 0 : -1} aria-label={`${schritt === 0 ? 'Dachrand Ecke' : 'Ziegelpunkt'} ${i + 1} verschieben`} className={styles.griff} style={{ pointerEvents: korrekturAktiv ? undefined : 'none' }}
      onClick={e => { e.stopPropagation(); if (touch) { setCursor(p); setGegriffen(i); } }}
      onPointerDown={e => { if (e.pointerType !== 'mouse' || e.button !== 0 || !korrekturAktiv) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { index: i, vorher: p, pointerId: e.pointerId }; }}
      onKeyDown={e => { if (!korrekturAktiv) return; const d: Record<string, Punkt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const v = d[e.key]; if (v) { e.preventDefault(); aenderePunkt(i, [Math.max(0, Math.min(foto.breitePx, p[0] + v[0] * px * (e.shiftKey ? 10 : 1))), Math.max(0, Math.min(foto.hoehePx, p[1] + v[1] * px * (e.shiftKey ? 10 : 1)))]); } }}>
      <circle cx={p[0]} cy={p[1]} r={22 * px} fill="transparent" />
      <circle cx={p[0]} cy={p[1]} r={4 * px} fill="#243038" stroke="white" strokeWidth={1.5 * px} pointerEvents="none" />
      <circle className={styles.fokus} cx={p[0]} cy={p[1]} r={8 * px} fill="none" stroke="white" strokeWidth={2 * px} pointerEvents="none" />
      <title>{schritt === 0 ? `Dachecke ${i + 1}` : punktNamen[i]}</title>
    </g>)}
  </svg>;
  const steuerung = <div className={styles.panel}>
    {schritt === 0 && <>
      <p>Markiere die <strong>echten Ecken einer Dachseite</strong>. Bei einer Spitze sind es drei; bei einem Einschnitt entsprechend mehr. Eine Form musst du nicht auswählen.</p>
      <label>Name der Fläche<input value={name} maxLength={100} onChange={e => { setName(e.target.value); aenderung(); }} /></label>
      <p><strong>{umriss.length} Ecken markiert</strong></p>
      <details><summary>Neigung und Himmelsrichtung</summary><div className={styles.raster}>
        <label>Dachneigung (Grad)<input inputMode="decimal" value={neigung} onChange={e => { setNeigung(e.target.value); aenderung(); }} /></label>
        <label>Ausrichtung<select value={azimut} onChange={e => { setAzimut(Number(e.target.value)); aenderung(); }}>{richtungen.map(([v, l]) => <option key={v} value={v}>{l}</option>)}{!richtungen.some(([v]) => v === azimut) && <option value={azimut}>Eigene Richtung ({azimut}°)</option>}</select></label>
      </div></details>
      <p className={styles.hilfe}>Danach geben sichtbare Ziegelabstände den Maßstab vor. Dafür brauchst du die verlegte Deckbreite und Decklänge, etwa aus dem Aufmaß.</p>
    </>}
    {schritt === 1 && <>
      <p>Zoome auf gut sichtbare Ziegel <strong>innerhalb dieser Dachseite</strong>. Markiere die vier äußeren Fugenkreuzungen eines zusammenhängenden Ziegelfelds.</p>
      <div className={styles.reihenfolge}><svg viewBox="0 0 190 100" role="img" aria-label="Drei Abstände quer und zwei Reihen: vier Fugenlinien begrenzen drei Abstände"><path d="M30 20H150V70H30ZM70 20V70M110 20V70M30 45H150" fill="none" stroke="currentColor" strokeWidth="1.5" /><text x="20" y="80">1</text><text x="155" y="80">2</text><text x="155" y="20">3</text><text x="20" y="20">4</text><text x="90" y="96" textAnchor="middle">3 Abstände · 2 Reihen</text></svg><strong>{ziegelPunkte.length < 4 ? `${ziegelPunkte.length + 1}. ${punktNamen[ziegelPunkte.length]}` : 'Vier Ziegelpunkte gesetzt'}</strong></div>
      <p className={styles.hilfe}>„Unten“ ist zur Dachrinne, unabhängig von der Drehung des Fotos. Die unteren Punkte liegen auf derselben Reihe, die oberen jeweils auf derselben Ziegelspalte. Wähle möglichst viele gut erkennbare Reihen.</p>
      <div className={styles.raster}>
        <label>Abstände quer<input inputMode="numeric" value={spalten} placeholder="Anzahl" onChange={e => { setSpalten(e.target.value); aenderung(); }} /></label>
        <label>Reihen nach oben<input inputMode="numeric" value={reihen} placeholder="Anzahl" onChange={e => { setReihen(e.target.value); aenderung(); }} /></label>
      </div>
      <p className={styles.hilfe}>Zähle die Abstände zwischen gleichen Fugen, nicht die Randlinien. Vier Linien ergeben drei Abstände. Bei versetzten Reihen denselben Spalten folgen.</p>
      <div className={styles.raster}>
        <label>Deckbreite (cm)<input inputMode="decimal" value={deckbreite} placeholder="Verlegtes Maß" onChange={e => { setDeckbreite(e.target.value); aenderung(); }} /></label>
        <label>Decklänge (cm)<input inputMode="decimal" value={decklaenge} placeholder="Verlegtes Maß" onChange={e => { setDecklaenge(e.target.value); aenderung(); }} /></label>
      </div>
      <p className={styles.hilfe}>Gemeint ist das sichtbare Maß nach dem Überlappen. Die gesamte Ziegelgröße oder eine einzelne Welle liefert hier den falschen Maßstab.</p>
      {referenz.ok && <p className={styles.mass}>Markiertes Ziegelfeld: <strong>{fmtDe(referenz.referenz.breiteM, 2)} × {fmtDe(referenz.referenz.hoeheM, 2)} m</strong></p>}
      <details><summary>Keine verlässlichen Ziegelmaße?</summary><p>Prüfe die Deckmaße im Aufmaß oder am verlegten Ziegel. Ohne diese Werte ist das Foto noch nicht maßstäblich. Für Dächer ohne sichtbare Ziegel kannst du die vorhandenen Dachmaße oder die erweiterte Fotoeinrichtung nutzen.</p></details>
      <button type="button" onClick={() => schrittWechsel(0)}>Dachrand korrigieren</button>
    </>}
    {schritt < 2 && <div className={styles.korrekturen}>
      {schritt === 0 && punkte.length > 0 && <button type="button" aria-pressed={punkteBearbeiten} onClick={() => { setPunkteBearbeiten(v => !v); setGegriffen(null); }}>{punkteBearbeiten ? 'Weitere Ecke hinzufügen' : 'Gesetzte Ecken verschieben'}</button>}
      <button type="button" disabled={!punkte.length} onClick={() => { setPunkte(ps => ps.slice(0, -1)); setGegriffen(null); aenderung(); }}>Letzten Punkt zurück</button>
      <span>{schritt === 0 && !punkteBearbeiten ? 'Weiter am Dachrand entlang klicken. Zum Korrigieren „Gesetzte Ecken verschieben“ wählen.' : schritt === 1 && ziegelPunkte.length < 4 ? 'Erst die vier Ziegelpunkte setzen. Danach kannst du jeden Punkt verschieben.' : 'Punkte ziehen oder mit den Pfeiltasten verschieben.'}</span>
    </div>}
    {schritt === 2 && ergebnis?.ok && <>
      <p><strong>{name}</strong> · {umriss.length} Dachecken</p>
      <dl className={styles.ergebnis}><div><dt>Gesamtbreite</dt><dd>{fmtDe(ergebnis.breiteM, 2)} m</dd></div><div><dt>Tiefe auf dem Dach</dt><dd>{fmtDe(ergebnis.hoeheM, 2)} m</dd></div></dl>
      <p>Die Kontur begrenzt die Belegung. Passen die Dachmaße zum Gebäude und liegen die Hilfslinien auf den Ziegelfugen?</p>
      {ergebnis.meldungen.length > 0 && <div className={styles.warnung}>{ergebnis.meldungen.map(m => <p key={m}>{ziegelHinweis(m)}</p>)}</div>}
      <label className={styles.bestaetigung}><input type="checkbox" checked={bestaetigt} onChange={e => setBestaetigt(e.target.checked)} />Deckmaße geprüft; Ziegelfeld und Dachrand gehören zu derselben Dachseite</label>
      {hatInhalte && <div className={styles.warnung}><p>Das Neuaufmaß ersetzt die Einrichtung von {flaeche.name}. {flaeche.felder?.length ?? 0} Belegungsfelder und {flaeche.hindernisse?.length ?? 0} Aussparungen werden entfernt. Andere Dachflächen bleiben erhalten. Rückgängig stellt den bisherigen Stand wieder her.</p><label className={styles.bestaetigung}><input type="checkbox" checked={neuAnlegen} onChange={e => setNeuAnlegen(e.target.checked)} />Belegung und Aussparungen dieser Dachfläche neu anlegen</label></div>}
      {flaeche.art === 'flachdach' && <p className={styles.hilfe}>Anschließend Süden im Foto festlegen. Das Neuaufmaß legt die Planachsen neu an.</p>}
      {(flaeche.fotoZuordnungen?.length ?? 0) > 1 && <p className={styles.warnung}>Weitere Fotoperspektiven dieser Fläche müssen anschließend neu eingerichtet werden.</p>}
      <div className={styles.korrekturen}><button type="button" onClick={() => schrittWechsel(0)}>Dachrand korrigieren</button><button type="button" onClick={() => schrittWechsel(1)}>Ziegelmaßstab korrigieren</button></div>
    </>}
    {fehler && <p role="alert" className={styles.fehler}>{fehler}</p>}
    <EditorAktionen><button type="button" className={styles.primaer} disabled={schritt === 2 ? !speicherbar : schritt === 0 ? umriss.length < 3 : ziegelPunkte.length !== 4} onClick={schritt === 2 ? uebernehmen : weiter}>{schritt === 0 ? 'Dachrand fertig – weiter' : schritt === 1 ? 'Dachmaße prüfen' : 'Dachfläche übernehmen'}</button><button type="button" onClick={() => navigation.weiter(onAbbrechen)}>Abbrechen</button></EditorAktionen>
  </div>;
  return renderArbeitsbereich({ bild, steuerung, hinweis, aufgabe: { titel: ['Dachrand nachzeichnen', 'Ziegel als Maßstab', 'Dachfläche prüfen'][schritt]!, phase: `${name.trim() || flaeche.name} · ${schritt + 1} von 3` }, bildSeitenverhaeltnis: foto.breitePx / foto.hoehePx, abbrechen: abbrechenGeste,
    punktSteuerung: schritt === 2 ? undefined : { aktiv: touch, aktivieren: touchAn, deaktivieren: touchAus, punkt: cursor, breitePx: foto.breitePx, hoehePx: foto.hoehePx, onBewegen: setCursor,
      aktion: gegriffen !== null ? 'Punkt hier ablegen' : amKreuz >= 0 ? 'Punkt greifen' : schritt === 0 ? 'Dachecke setzen' : 'Ziegelpunkt setzen', deaktiviert: schritt === 1 && ziegelPunkte.length >= 4 && gegriffen === null && amKreuz < 0, onBestaetigen: bestaetigePunkt } });
}
