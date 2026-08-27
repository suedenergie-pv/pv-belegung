import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: './fonts/InterVariable.woff2',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Belegungsplaner · SüdEnergie',
  description: 'Interne Dachbelegung und Vorplanung für den Vertrieb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-3">
            <span className="inline-block h-3.5 w-3.5 rounded-full bg-akzent" />
            <h1 className="text-lg font-semibold tracking-tight">
              SüdEnergie <span className="text-slate-400">·</span> Belegungsplaner
            </h1>
            <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              intern · Vorplanung
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1800px] px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 pt-2 text-center text-xs text-slate-400">
          Vorplanung für den Vertrieb — keine Fachplanung. Finale Auslegung durch die
          Projektleitung (PV*SOL). Engine-Regelwerk R1–R12, noch nicht gegen PV*SOL kalibriert.
        </footer>
      </body>
    </html>
  );
}
