'use client';

/** Kleine gemeinsame Bausteine im hellen Dashboard-CI (weiße Karten, große Touch-Targets). */

export function Karte({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
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
