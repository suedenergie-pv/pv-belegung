'use client';

/**
 * Einheitlicher Linien-Icon-Satz für den Belegungs-Planer (Genrih 08.07.2026:
 * „dass die App mal nach was aussieht"). Alle Icons: 24er-viewBox, currentColor,
 * gleiche Strichstärke/Rundungen — sie erben die Textfarbe des Knopfes (weiß wenn
 * aktiv, grau sonst). Kein externes Icon-Paket, damit der statische Export schlank
 * bleibt und nichts nachgeladen wird.
 */

type IconProps = { className?: string; size?: number };

function Icon({
  className,
  size = 18,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* ---------- Modul-Ausrichtung ---------- */

/** EIN Modul quer (liegend) mit Zell-Raster. */
export function IconModulQuer(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="6" width="20" height="12" rx="1.6" />
      <g strokeWidth={0.9} opacity={0.55}>
        <line x1="7" y1="6" x2="7" y2="18" />
        <line x1="12" y1="6" x2="12" y2="18" />
        <line x1="17" y1="6" x2="17" y2="18" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </g>
    </Icon>
  );
}

/** EIN Modul hochkant (stehend) mit Zell-Raster. */
export function IconModulHoch(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="6" y="2" width="12" height="20" rx="1.6" />
      <g strokeWidth={0.9} opacity={0.55}>
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="6" y1="7" x2="18" y2="7" />
        <line x1="6" y1="12" x2="18" y2="12" />
        <line x1="6" y1="17" x2="18" y2="17" />
      </g>
    </Icon>
  );
}

/* ---------- Dachform ---------- */

/** Rechteck-Dach. */
export function IconFormRechteck(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3.5" y="6" width="17" height="12" rx="1" />
    </Icon>
  );
}

/** Trapez / Walm: breite Traufe unten, schmaler First oben. */
export function IconFormTrapez(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7.5 6 H16.5 L20.5 18 H3.5 Z" />
    </Icon>
  );
}

/** Schief / Parallelogramm: First seitlich versetzt. */
export function IconFormSchief(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6.5 18 H17.5 L20.5 6 H9.5 Z" />
    </Icon>
  );
}

/* ---------- Werkzeuge ---------- */

/** Antippen (Cursor/Zeiger). */
export function IconAntippen(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 3 L10.07 19.97 L12.58 12.58 L19.97 10.07 Z" />
    </Icon>
  );
}

/** Verschieben (4-Wege-Pfeile). */
export function IconVerschieben(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 2 V22 M2 12 H22" />
      <path d="M9 5 L12 2 L15 5 M9 19 L12 22 L15 19 M5 9 L2 12 L5 15 M19 9 L22 12 L19 15" />
    </Icon>
  );
}

/** Modul setzen (Rechteck mit Plus). */
export function IconModulSetzen(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="3.5" width="18" height="17" rx="2.4" />
      <path d="M12 8.5 V15.5 M8.5 12 H15.5" />
    </Icon>
  );
}

/** Reihe drehen (Kreispfeil). */
export function IconReiheDrehen(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M21 12 a9 9 0 1 1 -3 -6.7 L21 8" />
      <path d="M21 3 v5 h-5" />
    </Icon>
  );
}

/** Reihen frei versetzen (versetzte Balken = Treppe). */
export function IconReihenVersetzen(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2.5" y="5" width="12" height="3.4" rx="0.9" />
      <rect x="7" y="10.3" width="12" height="3.4" rx="0.9" />
      <rect x="4" y="15.6" width="12" height="3.4" rx="0.9" />
    </Icon>
  );
}

/** Maße (Lineal). */
export function IconMasse(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2.5" y="9" width="19" height="6" rx="1.2" />
      <path d="M6 9 v2.4 M9.5 9 v3.2 M13 9 v2.4 M16.5 9 v3.2" />
    </Icon>
  );
}

/** Leeren (Papierkorb). */
export function IconLeeren(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3.5 6 H20.5" />
      <path d="M8.5 6 V4.4 A1.2 1.2 0 0 1 9.7 3.2 H14.3 A1.2 1.2 0 0 1 15.5 4.4 V6" />
      <path d="M6 6 L7 19.4 A1.6 1.6 0 0 0 8.6 20.8 H15.4 A1.6 1.6 0 0 0 17 19.4 L18 6" />
      <path d="M10 10.5 V16.5 M14 10.5 V16.5" />
    </Icon>
  );
}

/** Drohnenfoto (Kamera). */
export function IconFoto(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 8.5 A1.5 1.5 0 0 1 4.5 7 H7 L8.2 5 H15.8 L17 7 H19.5 A1.5 1.5 0 0 1 21 8.5 V17.5 A1.5 1.5 0 0 1 19.5 19 H4.5 A1.5 1.5 0 0 1 3 17.5 Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </Icon>
  );
}

/** Umriss zeichnen (Polygon). */
export function IconUmriss(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3 L20 9 L17 19 H7 L4 9 Z" />
    </Icon>
  );
}

/** Hindernis markieren (ausgespartes Feld). */
export function IconHindernis(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="4" y="4" width="16" height="16" rx="1.6" />
      <path d="M9 9 L15 15 M15 9 L9 15" />
    </Icon>
  );
}

/** Alle zeigen (Auge = versteckte Module wieder einblenden). */
export function IconAlleZeigen(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2.5 12 C5 7.5 8.5 5.5 12 5.5 s7 2 9.5 6.5 c-2.5 4.5 -6 6.5 -9.5 6.5 S5 16.5 2.5 12 Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Icon>
  );
}
