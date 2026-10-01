import type { ReactNode } from 'react';

export type WorkbenchSymbol = 'auswahl' | 'feld' | 'umriss' | 'aussparung' | 'gaube' | 'hand' | 'mehr' | 'flaeche' | 'foto' | 'details';
const formen: Record<WorkbenchSymbol, ReactNode> = {
  auswahl: <path d="m5 3 14 10-7 1-3 7-4-18Z" />,
  feld: <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M9 4v16M15 4v16M3 12h18" /></>,
  umriss: <><path d="m5 6 13-2 3 13-13 4-5-9Z" /><path d="M3 4h4v4H3zM16 2h4v4h-4zM19 15h4v4h-4zM6 19h4v4H6z" fill="currentColor" stroke="none" /></>,
  aussparung: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="m7 17 10-10M7 11l4-4m2 10 4-4" /></>,
  gaube: <><path d="m2 16 4-9 7-4 9 13M6 7l7 5 9 4M6 7v13h12V14M13 3v9" /><path d="M10 20v-6h4v6" /></>,
  hand: <path d="M8 12V5a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v7c0 6-3 8-7 8-3 0-4-1-6-4l-4-5a2 2 0 0 1 3-2l2 2Z" />,
  mehr: <><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>,
  flaeche: <><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5" /></>,
  foto: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 18 6-6 4 3 3-5 4 8" /></>,
  details: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /></>,
};

export function WorkbenchIcon({ symbol }: { symbol: WorkbenchSymbol }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{formen[symbol]}</svg>;
}
