'use client';

import React from 'react';
import { useEffect, useRef } from 'react';
import { useProjektHistorie } from '../lib/projekt-historie-context';

/** Kleine gemeinsame Bausteine im hellen Dashboard-CI (weiße Karten, große Touch-Targets). */

/**
 * Knopf, der beim GEDRÜCKTHALTEN wiederholt auslöst (16.07.2026, Genrih): einmal
 * sofort, danach alle 130 ms — dasselbe Gefühl wie eine gehaltene Pfeiltaste, nur
 * per Finger. Wichtig für die Tablet-Version, wo es keine Tastatur gibt.
 * Pointer-Events (nicht Mouse), damit Touch/Stift dieselbe Bahn nehmen.
 */
export function HoldButton({
  onTrigger,
  className,
  title,
  disabled,
  children,
  intervallMs = 130,
}: {
  onTrigger: () => void;
  className?: string;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
  intervallMs?: number;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const historie = useProjektHistorie();
  const historieRef = useRef(historie);
  historieRef.current = historie;
  const aktiv = useRef(false);
  // Frische Closure: onTrigger darf sich zwischen Renders ändern, ohne den Timer zu verlieren
  const fn = useRef(onTrigger);
  fn.current = onTrigger;

  const stop = () => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (aktiv.current) {
      aktiv.current = false;
      historieRef.current?.end('halteknopf');
    }
  };
  // Timer nie über das Unmount hinaus laufen lassen
  useEffect(() => {
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      stop();
    };
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      className={className}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault(); // Der gehaltene Knopf darf die Arbeitsfläche nicht verschieben.
        stop();
        // Eine noch fokussierte Formulareingabe zuerst abschließen; sie gehört
        // nicht zur folgenden Halte-Geste. Fokus ohne Scrollsprung übernehmen.
        e.currentTarget.focus({ preventScroll: true });
        aktiv.current = true;
        historieRef.current?.begin('halteknopf');
        // Erst auslösen, dann Capture: der Klick darf NIE daran scheitern, dass
        // setPointerCapture wirft (NotFoundError, wenn der Pointer nicht mehr
        // aktiv ist) — sonst wäre der Knopf still funktionslos.
        fn.current();
        timer.current = setInterval(() => fn.current(), intervallMs);
        try {
          e.currentTarget.setPointerCapture(e.pointerId); // Finger darf abrutschen
        } catch {
          // ohne Capture endet das Halten über pointerup/-leave — gut genug
        }
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onLostPointerCapture={stop}
      onClick={(event) => { if (event.detail === 0 && !aktiv.current) fn.current(); }}
    >
      {children}
    </button>
  );
}

export function Karte({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function KartenTitel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-base font-semibold text-slate-800">{children}</h2>;
}

/** Zonen-Kennzeichen A/B/C… je Dachfläche (durchgängig in allen Schritten + PDF). */
export function ZonenBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-akzent text-sm font-bold text-white">
      {label}
    </span>
  );
}

export function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputKlasse =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-akzent focus:outline-none focus:ring-2 focus:ring-akzent/30';

export function ToggleButton({
  aktiv,
  onClick,
  children,
  disabled = false,
  title,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Ausgegraut mit Tooltip statt versteckt — der Nutzer sieht, DASS es die Funktion gibt. */
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={aktiv}
      title={title}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
          : aktiv
            ? 'border-akzent bg-akzent text-white'
            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  );
}
