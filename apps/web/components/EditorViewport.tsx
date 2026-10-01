'use client';

import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { bildRahmen, begrenzeAnsicht, transformiereAnsicht, type AnsichtPunkt, type BildRahmen } from '../lib/editor-ansicht';
import { STANDARD_ANSICHT, type EditorAnsicht } from '../lib/editor-sitzung';
import styles from './EditorViewport.module.css';

export interface FotoPunktSteuerung {
  aktiv: boolean;
  aktivieren: () => void;
  punkt: [number, number];
  breitePx: number;
  hoehePx: number;
  onBewegen: (punkt: [number, number]) => void;
  onBestaetigen: () => void;
  aktion: string;
  deaktiviert?: boolean;
}

interface Props {
  ansicht?: EditorAnsicht;
  onAnsichtChange: (ansicht: EditorAnsicht) => void;
  verschieben?: boolean;
  onGesteAbbrechen?: () => void;
  bildSeitenverhaeltnis: number;
  children: ReactNode;
  className?: string;
  punktSteuerung?: FotoPunktSteuerung;
}
interface Geste { start: EditorAnsicht; mitte: AnsichtPunkt; abstand: number; rahmen: BildRahmen }
const mitte = (punkte: AnsichtPunkt[]) => ({ x: punkte.reduce((n, p) => n + p.x, 0) / punkte.length, y: punkte.reduce((n, p) => n + p.y, 0) / punkte.length });
const distanz = (p: AnsichtPunkt[]) => p.length > 1 ? Math.max(1, Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y)) : 0;

/** CSS-Ansichtstransformation: die SVG-Projektion bleibt unverändert und liest ihre transformierte Client-Box. */
export function EditorViewport({ ansicht = STANDARD_ANSICHT, onAnsichtChange, verschieben = false, onGesteAbbrechen, bildSeitenverhaeltnis, children, className = '', punktSteuerung }: Props) {
  const fenster = useRef<HTMLDivElement>(null);
  const [groesse, setGroesse] = useState({ breite: 1, hoehe: 1 });
  const rahmen = bildRahmen(groesse.breite, groesse.hoehe, bildSeitenverhaeltnis);
  const sichtbar = begrenzeAnsicht(ansicht);
  const refs = useRef({ ansicht: sichtbar, onAnsichtChange, onGesteAbbrechen, verschieben, rahmen, punktSteuerung });
  refs.current = { ansicht: sichtbar, onAnsichtChange, onGesteAbbrechen, verschieben, rahmen, punktSteuerung };
  const cursorGeste = useRef<{ id: number; x: number; y: number } | null>(null);
  const [fingerUnten, setFingerUnten] = useState(false);
  const bestaetigungsFinger = useRef<{ id: number; x: number; y: number } | null>(null);
  const bestaetigungsKlickSperre = useRef(0);
  const pointer = useRef(new Map<number, AnsichtPunkt>());
  const geste = useRef<Geste | null>(null);
  const ansichtGeste = useRef(false);
  const klickSperreBis = useRef(0);
  const schreibe = (wert: EditorAnsicht) => {
    const neu = begrenzeAnsicht(wert);
    refs.current.ansicht = neu;
    refs.current.onAnsichtChange(neu);
  };
  const punkt = (e: { clientX: number; clientY: number }): AnsichtPunkt => {
    const rect = fenster.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const neuAnkern = () => {
    const p = [...pointer.current.values()].slice(0, 2);
    geste.current = p.length ? { start: refs.current.ansicht, mitte: mitte(p), abstand: distanz(p), rahmen: refs.current.rahmen } : null;
  };
  const stoppeModellGeste = () => {
    cursorGeste.current = null;
    refs.current.onGesteAbbrechen?.();
    ansichtGeste.current = true;
    klickSperreBis.current = Date.now() + 500;
  };
  const abbrechen = () => {
    if (pointer.current.size) refs.current.onGesteAbbrechen?.();
    pointer.current.clear(); geste.current = null; ansichtGeste.current = false;
    cursorGeste.current = null; setFingerUnten(false);
  };

  const bewegeKreuz = (x: number, y: number) => {
    const { punktSteuerung: p, rahmen: r, ansicht: a } = refs.current;
    if (!p || r.bildBreite <= 1 || r.bildHoehe <= 1) return;
    const w = r.bildBreite * a.zoom, h = r.bildHoehe * a.zoom;
    const links = (r.breite - w) / 2 + a.x * r.bildBreite;
    const oben = (r.hoehe - h) / 2 + a.y * r.bildHoehe;
    const minX = Math.max(0, -links / w * p.breitePx), maxX = Math.min(p.breitePx, (r.breite - links) / w * p.breitePx);
    const minY = Math.max(0, -oben / h * p.hoehePx), maxY = Math.min(p.hoehePx, (r.hoehe - oben) / h * p.hoehePx);
    const neu: [number, number] = [Math.max(minX, Math.min(maxX, x)), Math.max(minY, Math.min(maxY, y))];
    if (neu[0] !== p.punkt[0] || neu[1] !== p.punkt[1]) {
      refs.current.punktSteuerung = { ...p, punkt: neu };
      p.onBewegen(neu);
    }
  };
  useEffect(() => {
    if (punktSteuerung?.aktiv) bewegeKreuz(...punktSteuerung.punkt);
  }, [sichtbar.x, sichtbar.y, sichtbar.zoom, groesse.breite, groesse.hoehe, punktSteuerung?.aktiv]);
  useEffect(() => {
    if (punktSteuerung?.aktiv) fenster.current?.parentElement?.scrollIntoView?.({ block: 'center' });
  }, [punktSteuerung?.aktiv]);

  useEffect(() => {
    const node = fenster.current;
    if (!node) return;
    const messen = () => {
      const rect = node.getBoundingClientRect();
      setGroesse({ breite: rect.width || node.clientWidth || 1, hoehe: rect.height || node.clientHeight || 1 });
    };
    messen();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    observer?.observe(node);
    window.addEventListener('resize', messen);
    const rad = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const p = punkt(e);
      const aktuell = refs.current;
      schreibe(transformiereAnsicht(aktuell.ansicht, aktuell.rahmen, p, p, aktuell.ansicht.zoom * Math.exp(-e.deltaY * .008)));
    };
    const endeAusserhalb = (e: PointerEvent) => {
      if (!pointer.current.has(e.pointerId)) return;
      pointer.current.delete(e.pointerId);
      if (!pointer.current.size) { geste.current = null; ansichtGeste.current = false; cursorGeste.current = null; setFingerUnten(false); }
      else neuAnkern();
    };
    node.addEventListener('wheel', rad, { passive: false });
    window.addEventListener('pointerup', endeAusserhalb);
    window.addEventListener('pointercancel', abbrechen);
    window.addEventListener('blur', abbrechen);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', messen);
      node.removeEventListener('wheel', rad);
      window.removeEventListener('pointerup', endeAusserhalb);
      window.removeEventListener('pointercancel', abbrechen);
      window.removeEventListener('blur', abbrechen);
    };
  }, []);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointer.current.set(e.pointerId, punkt(e));
    setFingerUnten(true);
    if (refs.current.verschieben || pointer.current.size >= 2 || ansichtGeste.current) {
      stoppeModellGeste();
      e.preventDefault(); e.stopPropagation();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Browser kann einen bereits beendeten Pointer melden. */ }
      neuAnkern();
    } else if (refs.current.punktSteuerung && (refs.current.punktSteuerung.aktiv || e.pointerType === 'touch')) {
      // Vor den SVG-Handlern abfangen: Fingerbewegung ist niemals ein Modellklick.
      refs.current.punktSteuerung.aktivieren();
      cursorGeste.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      e.preventDefault(); e.stopPropagation();
      klickSperreBis.current = Date.now() + 500;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Synthetischer Pointer. */ }
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointer.current.has(e.pointerId)) return;
    pointer.current.set(e.pointerId, punkt(e));
    const cursor = cursorGeste.current, steuerung = refs.current.punktSteuerung;
    if (!ansichtGeste.current && cursor?.id === e.pointerId && steuerung) {
      e.preventDefault(); e.stopPropagation();
      const { rahmen: r, ansicht: a } = refs.current;
      bewegeKreuz(steuerung.punkt[0] + (e.clientX - cursor.x) / (r.bildBreite * a.zoom) * steuerung.breitePx,
        steuerung.punkt[1] + (e.clientY - cursor.y) / (r.bildHoehe * a.zoom) * steuerung.hoehePx);
      cursorGeste.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    if (!ansichtGeste.current || !geste.current) return;
    e.preventDefault(); e.stopPropagation();
    const p = [...pointer.current.values()].slice(0, 2); const start = geste.current;
    const zoom = start.abstand > 0 && p.length > 1 ? start.start.zoom * distanz(p) / start.abstand : start.start.zoom;
    schreibe(transformiereAnsicht(start.start, start.rahmen, start.mitte, mitte(p), zoom));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (ansichtGeste.current || cursorGeste.current) {
      e.preventDefault(); e.stopPropagation(); klickSperreBis.current = Date.now() + 500;
    }
    pointer.current.delete(e.pointerId);
    if (!pointer.current.size) { geste.current = null; ansichtGeste.current = false; cursorGeste.current = null; setFingerUnten(false); }
    else if (ansichtGeste.current) neuAnkern();
  };
  const zoom = (faktor: number) => {
    const aktuell = refs.current;
    const p = { x: aktuell.rahmen.breite / 2, y: aktuell.rahmen.hoehe / 2 };
    schreibe(transformiereAnsicht(aktuell.ansicht, aktuell.rahmen, p, p, aktuell.ansicht.zoom * faktor));
  };
  const schieben = (x: number, y: number) => schreibe({ ...refs.current.ansicht, x: refs.current.ansicht.x + x * 44 / refs.current.rahmen.bildBreite, y: refs.current.ansicht.y + y * 44 / refs.current.rahmen.bildHoehe });
  return <section className={`${styles.rahmen} ${className}`} aria-label="Fotoansicht" data-punkt-steuerung={punktSteuerung?.aktiv || undefined}>
    <div ref={fenster} className={`${styles.fenster} ${verschieben ? styles.pan : ''}`} data-testid="editor-viewport"
      onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={up}
      onPointerCancelCapture={(e) => { e.stopPropagation(); klickSperreBis.current = Date.now() + 500; abbrechen(); }}
      onClickCapture={(e) => { if (punktSteuerung?.aktiv || verschieben || Date.now() < klickSperreBis.current) { e.stopPropagation(); e.preventDefault(); } }}
      onKeyDownCapture={(e) => {
        const v: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (verschieben && v[e.key]) { e.preventDefault(); e.stopPropagation(); schieben(...v[e.key]!); }
      }}>
      <div className={styles.inhalt} data-testid="editor-bild-transform" style={{
        width: rahmen.bildBreite, height: rahmen.bildHoehe,
        left: (rahmen.breite - rahmen.bildBreite) / 2, top: (rahmen.hoehe - rahmen.bildHoehe) / 2,
        transform: `translate(${sichtbar.x * rahmen.bildBreite}px, ${sichtbar.y * rahmen.bildHoehe}px) scale(${sichtbar.zoom})`,
      }}>{children}
        {punktSteuerung?.aktiv && <svg className={styles.fadenkreuz} viewBox={`0 0 ${punktSteuerung.breitePx} ${punktSteuerung.hoehePx}`} aria-hidden="true"
          data-testid="foto-fadenkreuz" data-x={punktSteuerung.punkt[0]} data-y={punktSteuerung.punkt[1]}>
          <path d={`M${punktSteuerung.punkt[0]},0 V${punktSteuerung.hoehePx} M0,${punktSteuerung.punkt[1]} H${punktSteuerung.breitePx}`} fill="none" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <path d={`M${punktSteuerung.punkt[0]},0 V${punktSteuerung.hoehePx} M0,${punktSteuerung.punkt[1]} H${punktSteuerung.breitePx}`} fill="none" stroke="#0284c7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx={punktSteuerung.punkt[0]} cy={punktSteuerung.punkt[1]} r={punktSteuerung.breitePx * .006} fill="none" stroke="#0284c7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>}
      </div>
    </div>
    <div className={styles.leiste} aria-label="Bildansicht steuern">
      {punktSteuerung?.aktiv ? <div className={styles.punktAktion}>
        <span>Ein Finger: Fadenkreuz · Zwei Finger: Foto</span>
        <button type="button" className={styles.bestaetigen} disabled={fingerUnten || punktSteuerung.deaktiviert}
          onPointerDown={(e) => { if (e.pointerType !== 'mouse') bestaetigungsFinger.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }}
          onPointerMove={(e) => { const f = bestaetigungsFinger.current; if (f && Math.hypot(e.clientX - f.x, e.clientY - f.y) > 10) bestaetigungsFinger.current = null; }}
          onPointerCancel={() => { bestaetigungsFinger.current = null; }}
          onPointerUp={(e) => {
            const f = bestaetigungsFinger.current; bestaetigungsFinger.current = null;
            if (!f || f.id !== e.pointerId || pointer.current.size) return;
            e.preventDefault();
            bestaetigungsKlickSperre.current = Date.now() + 700;
            refs.current.punktSteuerung?.onBestaetigen();
          }}
          onClick={(e) => {
            if (e.detail !== 0 && Date.now() < bestaetigungsKlickSperre.current) return;
            if (!pointer.current.size) refs.current.punktSteuerung?.onBestaetigen();
          }}>{punktSteuerung.aktion}</button>
      </div> : verschieben ? <div className={styles.pfeile} aria-label="Ansicht schrittweise verschieben">
        <button type="button" aria-label="Ansicht nach links" onClick={() => schieben(-1, 0)}>←</button>
        <button type="button" aria-label="Ansicht nach oben" onClick={() => schieben(0, -1)}>↑</button>
        <button type="button" aria-label="Ansicht nach unten" onClick={() => schieben(0, 1)}>↓</button>
        <button type="button" aria-label="Ansicht nach rechts" onClick={() => schieben(1, 0)}>→</button>
      </div> : <span className={styles.hinweis}>Zwei Finger: Bild verschieben und zoomen</span>}
      <button type="button" aria-label="Verkleinern" disabled={sichtbar.zoom <= 1} onClick={() => zoom(1 / 1.25)}>−</button>
      <span className={styles.prozent} aria-label={`Zoom ${Math.round(sichtbar.zoom * 100)} Prozent`}>{Math.round(sichtbar.zoom * 100)}%</span>
      <button type="button" aria-label="Vergrößern" disabled={sichtbar.zoom >= 8} onClick={() => zoom(1.25)}>+</button>
      <button type="button" aria-label="Alles anzeigen" onClick={() => { abbrechen(); schreibe(STANDARD_ANSICHT); }}>⛶ <span className={styles.allesText}>Alles anzeigen</span></button>
    </div>
  </section>;
}
